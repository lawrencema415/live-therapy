// Custom hook for managing LiveKit room connection

import { useState, useRef, useCallback } from 'react';
import { Room, RoomEvent, createLocalAudioTrack, ParticipantKind, LocalAudioTrack, RemoteParticipant } from 'livekit-client';
import type { TranscriptMessage, TextStreamReader, ParticipantIdentity } from '@/types/room';
import { loadTranscriptsFromStorage } from '@/utils/transcriptStorage';
import type { SessionSummary } from '@/utils/userSessionStorage';

interface UseRoomConnectionProps {
	onTranscriptsUpdate: (transcripts: TranscriptMessage[]) => void;
	onTranscriptReceived: (message: TranscriptMessage) => void;
	onSummariesReceived?: (summaries: SessionSummary[]) => void;
}

export function useRoomConnection({
	onTranscriptsUpdate,
	onTranscriptReceived,
	onSummariesReceived,
}: UseRoomConnectionProps) {
	const [isConnected, setIsConnected] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);
	const [isAgentConnected, setIsAgentConnected] = useState(false);
	const [isWaitingForAgent, setIsWaitingForAgent] = useState(false);
	const [isMuted, setIsMuted] = useState(false);
	const roomRef = useRef<Room | null>(null);
	const micTrackRef = useRef<LocalAudioTrack | null>(null);
	const shouldAutoUnmuteRef = useRef(false);
	const ignoreDisconnectRef = useRef(false); // Prevent disconnect event from updating state when user cancels navigation

	const connectToRoom = useCallback(async (
		userName: string
	) => {
		if (!userName.trim() || isConnecting) {
			return;
		}

		setIsConnecting(true);
		try {
			// Get token from API - no need to send transcripts/summaries
			// Agent will fetch them securely from Supabase using authenticated user ID
			const res = await fetch('/api/token');

			if (!res.ok) {
				const errorData = await res
					.json()
					.catch(() => ({ error: 'Unknown error' }));
				throw new Error(
					`Token generation failed: ${errorData.error || res.statusText}`
				);
			}

			const { token } = await res.json();

			if (!token) {
				throw new Error('No token received from server');
			}

			// Get LiveKit URL
			const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
			if (!livekitUrl) {
				throw new Error(
					'NEXT_PUBLIC_LIVEKIT_URL is not set. Please check your environment variables.'
				);
			}

			console.log('Connecting to LiveKit:', livekitUrl);
			console.log('User name:', userName.trim());
			console.log('Agent will fetch transcripts/summaries from Supabase using authenticated user ID');

			const currentRoom = new Room();
			roomRef.current = currentRoom;

			await currentRoom.connect(livekitUrl, token);
			console.log('Connected to room:', {
				name: currentRoom.name,
				localParticipant: currentRoom.localParticipant.identity,
				numParticipants: currentRoom.numParticipants,
			});

			// Note: No longer sending user info via data track
			// Agent will fetch transcripts/summaries securely from Supabase using user ID from token metadata
			console.log(`[RoomConnection] Participant identity: ${currentRoom.localParticipant.identity}`);
			console.log(`[RoomConnection] Agent will fetch data from Supabase using authenticated user ID`);

			// Listen for room disconnect events
			currentRoom.on(RoomEvent.Disconnected, () => {
				console.log('Room disconnected');
				// Only update state if we're not ignoring disconnects (user cancelled navigation)
				if (!ignoreDisconnectRef.current) {
					setIsConnected(false);
					roomRef.current = null;
				} else {
					console.log('[RoomConnection] Ignoring disconnect event - user cancelled navigation');
					// Reset the flag after handling
					ignoreDisconnectRef.current = false;
				}
			});

			// Load existing transcripts from storage
			// Note: This is only for loading previous session transcripts on reconnect
			// New transcripts come via text stream handlers, not from storage
			setTimeout(async () => {
				const loadedTranscripts = await loadTranscriptsFromStorage(currentRoom);
				if (loadedTranscripts.length > 0) {
					console.log(`[RoomConnection] Loaded ${loadedTranscripts.length} transcripts from storage (previous session)`);
					onTranscriptsUpdate(loadedTranscripts);
				}
			}, 1000);

			// Listen for participant attribute changes to update transcripts and load summaries
			// Note: This should only update if transcripts are actually different (not duplicate)
			currentRoom.on(RoomEvent.ParticipantAttributesChanged, async () => {
				const loadedTranscripts = await loadTranscriptsFromStorage(currentRoom);
				if (loadedTranscripts.length > 0) {
					console.log(`[RoomConnection] Participant attributes changed, loaded ${loadedTranscripts.length} transcripts from storage`);
					// Only update if we have new transcripts (setTranscriptsFromStorage will deduplicate)
					onTranscriptsUpdate(loadedTranscripts);
				}
				
				// Check for summaries from agent participant (stored with key summaries_{userName})
				if (onSummariesReceived) {
					try {
						// Find agent participant (usually has kind === AGENT or is not the local participant)
						const remoteParticipants = Array.from(currentRoom.remoteParticipants.values());
						for (const participant of remoteParticipants) {
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							const attributes = (participant as any).attributes;
							if (attributes) {
								const summariesKey = `summaries_${userName.trim()}`;
								let summariesJson: string | undefined;
								
								if (typeof attributes.get === 'function') {
									summariesJson = attributes.get(summariesKey);
								} else if (typeof attributes === 'object') {
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
									summariesJson = (attributes as any)[summariesKey];
								}
								
								if (summariesJson && typeof summariesJson === 'string') {
									try {
										const summaries = JSON.parse(summariesJson);
										if (Array.isArray(summaries) && summaries.length > 0) {
											console.log(`[RoomConnection] Received ${summaries.length} summaries from agent`);
											onSummariesReceived(summaries);
										}
									} catch (e) {
										console.warn('[RoomConnection] Failed to parse summaries:', e);
									}
								}
							}
						}
					} catch (error) {
						console.error('[RoomConnection] Error checking for summaries:', error);
					}
				}
			});

			// Publish microphone audio
			const mic = await createLocalAudioTrack();
			micTrackRef.current = mic;
			// Mute by default until agent connects
			mic.mute();
			setIsMuted(true);
			shouldAutoUnmuteRef.current = true; // Flag to auto-unmute when agent connects
			await currentRoom.localParticipant.publishTrack(mic);
			console.log('Microphone track published (muted by default until agent connects)');

			// Listen to remote audio tracks (agent voice)
			currentRoom.on(RoomEvent.TrackSubscribed, (track) => {
				if (track.kind === 'audio') {
					const el = track.attach();
					document.body.appendChild(el);
				}
			});

			// Register text stream handler for transcriptions
			setupTranscriptHandlers(currentRoom, onTranscriptReceived);

			// Check for agent connection
			let agentCheckInterval: NodeJS.Timeout | null = null;
			const checkAgentConnection = () => {
				// Safety check - ensure room and participants are available
				if (!currentRoom || !currentRoom.remoteParticipants) {
					return;
				}

				try {
					const remoteParticipants = Array.from(currentRoom.remoteParticipants.values());
					const localIdentity = currentRoom.localParticipant?.identity || '';
					
					// Check for AGENT kind participants (proper way to detect agents)
					const hasAgent = remoteParticipants.length > 0 && remoteParticipants.some(
						(p) => {
							if (!p) return false;
							
							const pIdentity = p.identity || '';
							const isAgent = p.kind === ParticipantKind.AGENT;
							
							// Also check if it's not the local user (extra safety)
							const isNotLocalUser = pIdentity !== localIdentity && 
							                       pIdentity !== userName.trim() && 
							                       pIdentity.length > 0;
							
							// Check if participant has audio tracks (agent typically publishes audio)
							// Safely check audio tracks - may not exist immediately
							let hasAudioTracks = false;
							try {
								const trackPublications = Array.from(p.trackPublications.values());
								hasAudioTracks = trackPublications.some(
									(trackPub) => trackPub.kind === 'audio'
								);
							} catch {
								// Audio tracks not available yet, that's okay
							}
							
							// Log for debugging
							if (isNotLocalUser) {
								console.log(`[RoomConnection] Found remote participant: ${pIdentity}, kind: ${p.kind}, isAgent: ${isAgent}, audio tracks: ${hasAudioTracks}`);
							}
							
							// Primary check: must be AGENT kind
							// Secondary check: must not be local user
							return isAgent && isNotLocalUser;
						}
					);
				
					if (hasAgent) {
						setIsAgentConnected(true);
						setIsWaitingForAgent(false);
						console.log('[RoomConnection] ✓ Agent detected in room');
						
						// Automatically unmute microphone when agent connects
						if (micTrackRef.current && shouldAutoUnmuteRef.current) {
							micTrackRef.current.unmute();
							setIsMuted(false);
							shouldAutoUnmuteRef.current = false; // Clear flag after unmuting
							console.log('[RoomConnection] Microphone unmuted automatically - agent connected');
						}
						
						if (agentCheckInterval) {
							clearInterval(agentCheckInterval);
							agentCheckInterval = null;
						}
					} else {
						// Only set waiting state if we're still connected
						if (currentRoom.state === 'connected') {
							setIsAgentConnected(false);
							setIsWaitingForAgent(true);
						}
					}
				} catch (error) {
					console.error('[RoomConnection] Error checking agent connection:', error);
					// Don't throw - just log and continue
				}
			};

			// Check immediately
			checkAgentConnection();

			// Listen for participant connected events to detect agent
			const participantConnectedHandler = (participant: RemoteParticipant) => {
				if (!participant) return;
				const pKind = participant.kind || undefined;
				const pIdentity = participant.identity || 'unknown';
				console.log(`[RoomConnection] Participant connected: ${pIdentity}, kind: ${pKind}`);
				
				// If this is an AGENT participant, check immediately
				if (pKind === ParticipantKind.AGENT) {
					console.log('[RoomConnection] ✓ AGENT participant detected!');
					setTimeout(() => {
						checkAgentConnection();
					}, 100);
				} else {
					// For other participants, also check (might help detect agent)
					setTimeout(() => {
						checkAgentConnection();
					}, 100);
				}
			};

			const participantDisconnectedHandler = (participant: RemoteParticipant) => {
				if (!participant) return;
				console.log('[RoomConnection] Participant disconnected:', participant.identity || 'unknown');
				checkAgentConnection();
			};

			currentRoom.on(RoomEvent.ParticipantConnected, participantConnectedHandler);
			currentRoom.on(RoomEvent.ParticipantDisconnected, participantDisconnectedHandler);

			// Poll for agent connection more frequently initially, then less frequently
			let pollCount = 0;
			agentCheckInterval = setInterval(() => {
				pollCount++;
				checkAgentConnection();
				
				// Log every 5 seconds
				if (pollCount % 5 === 0) {
					try {
						if (currentRoom && currentRoom.remoteParticipants) {
							const remoteParticipants = Array.from(currentRoom.remoteParticipants.values());
							console.log(`[RoomConnection] Agent check (${pollCount}s): ${remoteParticipants.length} remote participants`);
						}
					} catch (error) {
						console.error('[RoomConnection] Error logging participant count:', error);
					}
				}
			}, 1000);

			// Keep checking indefinitely (don't stop after timeout)
			// The agent should connect when user joins, but might take time
			// Only stop checking if we disconnect or agent is found
			currentRoom.on(RoomEvent.Disconnected, () => {
				if (agentCheckInterval) {
					clearInterval(agentCheckInterval);
					agentCheckInterval = null;
				}
			});

			// Log warning after 30 seconds but keep checking
			setTimeout(() => {
				if (!isAgentConnected) {
					console.warn('[RoomConnection] Agent has not connected after 30 seconds, continuing to wait...');
					console.warn('[RoomConnection] Agent should connect automatically when participant joins');
				}
			}, 30000);

			setIsConnected(true);
		} catch (error) {
			console.error('Error connecting to room:', error);
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error occurred';
			alert(`Failed to connect to room: ${errorMessage}`);
			throw error;
		} finally {
			setIsConnecting(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [onTranscriptsUpdate, onTranscriptReceived, onSummariesReceived]);

	const toggleMute = useCallback(() => {
		if (micTrackRef.current) {
			if (isMuted) {
				micTrackRef.current.unmute();
				setIsMuted(false);
				shouldAutoUnmuteRef.current = false; // User manually unmuted, don't auto-unmute
				console.log('[RoomConnection] Microphone unmuted');
			} else {
				micTrackRef.current.mute();
				setIsMuted(true);
				console.log('[RoomConnection] Microphone muted');
			}
		}
	}, [isMuted]);

	// Force mute microphone (used when modal opens)
	const muteMicrophone = useCallback(() => {
		if (micTrackRef.current && !isMuted) {
			micTrackRef.current.mute();
			setIsMuted(true);
			console.log('[RoomConnection] Microphone force muted');
		}
	}, [isMuted]);

	// Pause agent audio by setting volume to 0 and pausing playback
	const pauseAgentAudio = useCallback(() => {
		const audioElements = Array.from(document.querySelectorAll('audio'));
		audioElements.forEach((audio) => {
			audio.volume = 0;
			audio.pause();
		});
		console.log('[RoomConnection] Agent audio paused');
	}, []);

	const disconnect = useCallback(async () => {
		if (roomRef.current) {
			try {
				console.log('[RoomConnection] Disconnecting from room and ending agent session...');
				
				// Clean up microphone track
				if (micTrackRef.current) {
					micTrackRef.current.stop();
					micTrackRef.current = null;
				}
				shouldAutoUnmuteRef.current = false;
				
				// Disconnect from room - this will trigger agent job to end
				// When all participants leave, the agent job ends automatically
				await roomRef.current.disconnect();
				console.log('[RoomConnection] Successfully disconnected from room');
				
				// Give a moment for cleanup
				await new Promise(resolve => setTimeout(resolve, 100));
			} catch (error) {
				console.error('[RoomConnection] Error during disconnect:', error);
			} finally {
				roomRef.current = null;
			}
		}
		setIsConnected(false);
		setIsAgentConnected(false);
		setIsWaitingForAgent(false);
		setIsMuted(false);
	}, []);

	// Function to ignore disconnect events (used when user cancels navigation)
	const ignoreDisconnect = useCallback(() => {
		ignoreDisconnectRef.current = true;
		console.log('[RoomConnection] Ignoring next disconnect event - user cancelled navigation');
	}, []);

	return {
		isConnected,
		isConnecting,
		isAgentConnected,
		isWaitingForAgent,
		isMuted,
		connectToRoom,
		disconnect,
		toggleMute,
		muteMicrophone,
		pauseAgentAudio,
		ignoreDisconnect,
		getRoom: () => roomRef.current,
	};
}

/**
 * Setup transcript handlers for the room
 */
function setupTranscriptHandlers(
	room: Room,
	onTranscriptReceived: (message: TranscriptMessage) => void
) {
	console.log('Registering text stream handler for transcriptions...');

	// Store agent participant identity when detected
	let agentParticipantIdentity: string | null = null;
	const localParticipantIdentity = room.localParticipant?.identity || '';

	// Function to identify if a participant is the agent
	const identifyAgent = (participantIdentity: string): boolean => {
		// If we've already identified the agent, use that
		if (agentParticipantIdentity && participantIdentity === agentParticipantIdentity) {
			return true;
		}
		
		// Check remote participants
		try {
			const remoteParticipants = Array.from(room.remoteParticipants.values());
			for (const participant of remoteParticipants) {
				if (participant.identity === participantIdentity) {
					if (participant.kind === ParticipantKind.AGENT) {
						// Store for future reference
						agentParticipantIdentity = participantIdentity;
						console.log(`[RoomConnection] ✓ Identified and stored agent participant identity: ${participantIdentity}`);
						return true;
					}
					// If it's not the local user, it might be the agent (fallback)
					if (participantIdentity !== localParticipantIdentity) {
						// Check if it's not a user participant (STANDARD kind)
						if (participant.kind !== ParticipantKind.STANDARD) {
							agentParticipantIdentity = participantIdentity;
							console.log(`[RoomConnection] ✓ Identified agent by process of elimination: ${participantIdentity} (kind: ${participant.kind})`);
							return true;
						}
					}
				}
			}
			
			// Also check all remote participants to proactively identify agent
			for (const participant of remoteParticipants) {
				if (participant.kind === ParticipantKind.AGENT && participant.identity !== localParticipantIdentity) {
					agentParticipantIdentity = participant.identity;
					console.log(`[RoomConnection] ✓ Proactively identified agent participant: ${participant.identity}`);
					// Check if this matches the current identity
					if (participantIdentity === participant.identity) {
						return true;
					}
				}
			}
		} catch (e) {
			console.warn('[RoomConnection] Error checking participant:', e);
		}
		
		// Fallback: if it's not the local participant, assume it's the agent
		// This is important because agent transcriptions might come through before participant is fully registered
		if (participantIdentity !== localParticipantIdentity && participantIdentity !== 'user' && participantIdentity !== 'unknown' && participantIdentity.trim() !== '') {
			// Only set if we haven't identified the agent yet
			if (!agentParticipantIdentity) {
				agentParticipantIdentity = participantIdentity;
				console.log(`[RoomConnection] ✓ Assuming agent identity (fallback): ${participantIdentity}`);
			}
			return participantIdentity === agentParticipantIdentity;
		}
		
		return false;
	};

	// Try to use registerTextStreamHandler (available in livekit-client v2+)
	const hasTextStreamHandler =
		typeof (room as unknown as { registerTextStreamHandler?: (topic: string, handler: unknown) => void }).registerTextStreamHandler === 'function';

	if (hasTextStreamHandler) {
		console.log('Using registerTextStreamHandler method...');
		(room as unknown as { registerTextStreamHandler: (topic: string, handler: (reader: TextStreamReader, participantInfo: ParticipantIdentity | string) => Promise<void>) => void }).registerTextStreamHandler(
			'lk.transcription',
			async (
				reader: TextStreamReader,
				participantInfo: ParticipantIdentity | string
			) => {
				const info = reader.info;
				const segmentId = info.attributes['lk.segment_id'] || info.id;

				// Determine speaker identity
				let speakerIdentity: string;
				if (typeof participantInfo === 'string') {
					speakerIdentity = participantInfo;
				} else {
					speakerIdentity = participantInfo?.identity || 'unknown';
				}

				// Determine if this is from the agent
				let speaker: string;
				if (
					speakerIdentity === localParticipantIdentity ||
					speakerIdentity === 'user'
				) {
					speaker = 'user';
				} else if (identifyAgent(speakerIdentity)) {
					speaker = 'agent';
				} else {
					if (
						speakerIdentity !== localParticipantIdentity &&
						speakerIdentity !== 'unknown' &&
						speakerIdentity.trim() !== ''
					) {
						speaker = 'agent';
						if (!agentParticipantIdentity) {
							agentParticipantIdentity = speakerIdentity;
							console.log(
								`[RoomConnection] ✓ Assumed agent from unknown identity: ${speakerIdentity}`
							);
						}
					} else {
						speaker = speakerIdentity;
						console.warn(
							`[RoomConnection] ⚠️ Unknown speaker identity: ${speakerIdentity}, using as-is`
						);
					}
				}

				const streamStartTimestamp = Date.now();
				let aggregatedText = '';

				const emitTranscript = (
					text: string,
					isFinal: boolean,
					timestampOverride?: number
				) => {
					const trimmed = text.trim();
					if (!trimmed) {
						return;
					}

					const message: TranscriptMessage = {
						id: segmentId,
						speaker,
						text: trimmed,
						isFinal,
						timestamp: timestampOverride ?? Date.now(),
					};

					if (speaker === 'agent') {
						console.log(
							`[RoomConnection] 🎯 AGENT TRANSCRIPT - Speaker: ${speaker}, Identity: ${speakerIdentity}, Text: "${trimmed.substring(0, 80)}${
								trimmed.length > 80 ? '...' : ''
							}", Final: ${isFinal}`
						);
					} else {
						console.log(
							`[RoomConnection] Received transcript - Speaker: ${speaker} (identity: ${speakerIdentity}), Text: "${trimmed.substring(0, 50)}${
								trimmed.length > 50 ? '...' : ''
							}", Final: ${isFinal}`
						);
					}

					onTranscriptReceived(message);
				};

				const processStream = async () => {
					try {
						for await (const chunk of (reader as unknown as AsyncIterable<string>)) {
							if (!chunk) continue;
							aggregatedText += chunk;
							emitTranscript(aggregatedText, false, streamStartTimestamp);
						}

						emitTranscript(aggregatedText, true, streamStartTimestamp);
					} catch (err) {
						console.error('Error reading transcription stream:', err);
					}
				};

				processStream().catch((err) =>
					console.error('Failed to process transcription stream:', err)
				);
			}
		);
		console.log('Text stream handler registered successfully');
	} else {
		console.warn(
			'registerTextStreamHandler not available. Using DataReceived event as fallback.'
		);
		// Fallback: Listen to DataReceived events
		room.on(RoomEvent.DataReceived, (payload, participant) => {
			if (!participant) return;

			try {
				const decoder = new TextDecoder();
				const text = decoder.decode(payload);
				const data = JSON.parse(text);

				if (data.type === 'transcript') {
					const message: TranscriptMessage = {
						id: `data-${Date.now()}-${Math.random()}`,
						speaker: participant.identity || 'unknown',
						text: data.text,
						isFinal: true,
						timestamp: Date.now(),
					};

					onTranscriptReceived(message);
				}
			} catch (err) {
				// Not JSON or not a transcript, ignore
				console.debug('DataReceived event (not transcript):', err);
			}
		});
	}
}


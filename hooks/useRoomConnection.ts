// Custom hook for managing LiveKit room connection

import { useState, useRef, useCallback } from 'react';
import { Room, RoomEvent, createLocalAudioTrack, ParticipantKind } from 'livekit-client';
import type { TranscriptMessage, TextStreamReader, ParticipantIdentity, StoredTranscript } from '@/types/room';
import { storeTranscriptsInStorage, loadTranscriptsFromStorage } from '@/utils/transcriptStorage';

interface UseRoomConnectionProps {
	onTranscriptsUpdate: (transcripts: TranscriptMessage[]) => void;
	onTranscriptReceived: (message: TranscriptMessage) => void;
}

export function useRoomConnection({
	onTranscriptsUpdate,
	onTranscriptReceived,
}: UseRoomConnectionProps) {
	const [isConnected, setIsConnected] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);
	const [isAgentConnected, setIsAgentConnected] = useState(false);
	const [isWaitingForAgent, setIsWaitingForAgent] = useState(false);
	const roomRef = useRef<Room | null>(null);

	const connectToRoom = useCallback(async (userName: string, previousTranscripts: StoredTranscript[] = []) => {
		if (!userName.trim() || isConnecting) {
			return;
		}

		setIsConnecting(true);
		try {
			// Use userName as identity
			const identity = userName.trim();

			// Get token from API with userName and previous transcripts
			const tokenParams = new URLSearchParams({
				identity: identity,
				userName: identity,
			});

			// Add previous transcripts as JSON if available
			if (previousTranscripts.length > 0) {
				tokenParams.append('previousTranscripts', JSON.stringify(previousTranscripts));
			}

			const res = await fetch(`/api/token?${tokenParams.toString()}`);

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
			console.log('Previous transcripts:', previousTranscripts.length);

			const currentRoom = new Room();
			roomRef.current = currentRoom;

			await currentRoom.connect(livekitUrl, token);
			console.log('Connected to room:', {
				name: currentRoom.name,
				localParticipant: currentRoom.localParticipant.identity,
				numParticipants: currentRoom.numParticipants,
			});

			// Send user info via data track (since setAttributes requires permissions)
			// The agent can read this from the data track or use identity (which is userName)
			try {
				if (previousTranscripts.length > 0) {
					const userInfoData = {
						type: 'user_info',
						userName: userName.trim(),
						previousTranscripts: previousTranscripts,
					};
					
					const data = new TextEncoder().encode(JSON.stringify(userInfoData));
					await currentRoom.localParticipant.publishData(data, {
						reliable: true,
						topic: 'user_info',
					});
					
					console.log(`[RoomConnection] ✓ Sent user info via data track: "${userName.trim()}" with ${previousTranscripts.length} transcripts`);
					console.log(`[RoomConnection] Sample transcripts:`, previousTranscripts.slice(0, 2).map(t => `${t.role}: ${t.text.substring(0, 30)}...`));
				} else {
					console.log(`[RoomConnection] User identity: "${userName.trim()}" (no previous transcripts)`);
				}
				
				console.log(`[RoomConnection] Participant identity: ${currentRoom.localParticipant.identity}`);
			} catch (error) {
				console.error('[RoomConnection] ✗ Error sending user info:', error);
				// This is not critical - agent can still use identity as userName
			}

			// Listen for room disconnect events
			currentRoom.on(RoomEvent.Disconnected, () => {
				console.log('Room disconnected');
				setIsConnected(false);
				roomRef.current = null;
			});

			// Load existing transcripts from storage
			setTimeout(async () => {
				const loadedTranscripts = await loadTranscriptsFromStorage(currentRoom);
				if (loadedTranscripts.length > 0) {
					onTranscriptsUpdate(loadedTranscripts);
				}
			}, 1000);

			// Listen for participant attribute changes to update transcripts
			currentRoom.on(RoomEvent.ParticipantAttributesChanged, async () => {
				const loadedTranscripts = await loadTranscriptsFromStorage(currentRoom);
				if (loadedTranscripts.length > 0) {
					onTranscriptsUpdate(loadedTranscripts);
				}
			});

			// Publish microphone audio
			const mic = await createLocalAudioTrack();
			await currentRoom.localParticipant.publishTrack(mic);
			console.log('Microphone track published');

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
								if (p.audioTracks) {
									hasAudioTracks = Array.from(p.audioTracks.values()).length > 0;
								}
							} catch (e) {
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
			const participantConnectedHandler = (participant: any) => {
				if (!participant) return;
				const pKind = participant.kind || 'unknown';
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

			const participantDisconnectedHandler = (participant: any) => {
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
	}, [onTranscriptsUpdate, onTranscriptReceived]);

	const disconnect = useCallback(async () => {
		if (roomRef.current) {
			try {
				console.log('[RoomConnection] Disconnecting from room and ending agent session...');
				
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
	}, []);

	return {
		isConnected,
		isConnecting,
		isAgentConnected,
		isWaitingForAgent,
		connectToRoom,
		disconnect,
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

	// Try to use registerTextStreamHandler (available in livekit-client v2+)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const hasTextStreamHandler =
		typeof (room as any).registerTextStreamHandler === 'function';

	if (hasTextStreamHandler) {
		console.log('Using registerTextStreamHandler method...');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(room as any).registerTextStreamHandler(
			'lk.transcription',
			async (
				reader: TextStreamReader,
				participantInfo: ParticipantIdentity | string
			) => {
				const info = reader.info;
				const isFinal =
					info.attributes['lk.transcription_final'] === 'true';
				const segmentId = info.attributes['lk.segment_id'] || info.id;
				const speaker =
					typeof participantInfo === 'string'
						? participantInfo
						: participantInfo?.identity || 'unknown';

				try {
					const text = await reader.readAll();

					if (!text.trim()) {
						return;
					}

					const message: TranscriptMessage = {
						id: segmentId,
						speaker,
						text: text.trim(),
						isFinal,
						timestamp: Date.now(),
					};

					onTranscriptReceived(message);
				} catch (err) {
					console.error('Error reading transcription stream:', err);
				}
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


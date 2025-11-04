// Custom hook for managing LiveKit room connection

import { useState, useRef, useCallback } from 'react';
import { Room, RoomEvent, createLocalAudioTrack } from 'livekit-client';
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

			// Set participant attributes with userName and previous transcripts for agent to access
			// Always set userName so agent can identify the user
			try {
				const attributes: Record<string, string> = {
					userName: userName.trim(),
				};
				
				// Add previous transcripts if available
				if (previousTranscripts.length > 0) {
					attributes.transcripts = JSON.stringify(previousTranscripts);
					console.log(`[RoomConnection] ✓ Setting ${previousTranscripts.length} previous transcripts in participant attributes`);
					console.log(`[RoomConnection] Sample transcripts:`, previousTranscripts.slice(0, 2).map(t => `${t.role}: ${t.text.substring(0, 30)}...`));
				} else {
					console.log(`[RoomConnection] No previous transcripts to send`);
				}
				
				await currentRoom.localParticipant.setAttributes(attributes);
				console.log(`[RoomConnection] ✓ Set userName attribute: "${userName.trim()}"`);
				console.log(`[RoomConnection] Participant identity: ${currentRoom.localParticipant.identity}`);
			} catch (error) {
				console.error('[RoomConnection] ✗ Error setting participant attributes:', error);
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
			await roomRef.current.disconnect();
			roomRef.current = null;
		}
		setIsConnected(false);
	}, []);

	return {
		isConnected,
		isConnecting,
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


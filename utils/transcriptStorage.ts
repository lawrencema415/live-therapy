// Utility functions for storing and loading transcripts from participant attributes

import type { Room } from 'livekit-client';
import type { TranscriptMessage, StoredTranscript } from '@/types/room';

/**
 * Store transcripts in participant attributes (memstorage-like functionality)
 */
export async function storeTranscriptsInStorage(
	room: Room | null,
	transcriptsToStore: TranscriptMessage[]
): Promise<void> {
	if (!room) return;

	try {
		const localParticipant = room.localParticipant;
		if (!localParticipant) return;

		// Convert TranscriptMessage[] to storage format
		const storageFormat: StoredTranscript[] = transcriptsToStore
			.filter((t) => t.isFinal) // Only store final transcripts
			.map((t) => ({
				role: t.speaker === 'agent' ? 'assistant' : t.speaker,
				text: t.text,
				timestamp: t.timestamp,
			}));

		// Store in participant attributes
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const attributes = (localParticipant as any).attributes;
		if (attributes && attributes.set) {
			attributes.set('transcripts', JSON.stringify(storageFormat));
			console.log(
				`[TranscriptStorage] Stored ${storageFormat.length} transcripts`
			);
		} else {
			console.warn(
				'Participant attributes API not available for storing transcripts'
			);
		}
	} catch (error) {
		console.error('[TranscriptStorage] Error storing transcripts:', error);
	}
}

/**
 * Load transcripts from participant attributes (memstorage)
 */
export async function loadTranscriptsFromStorage(
	room: Room
): Promise<TranscriptMessage[]> {
	try {
		const remoteParticipants = Array.from(room.remoteParticipants.values());
		const allLoadedMessages: TranscriptMessage[] = [];

		// Check all remote participants (including agent) for transcripts
		for (const participant of remoteParticipants) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const attributes = (participant as any).attributes;
			if (attributes && typeof attributes.get === 'function') {
				const transcriptsJson = attributes.get('transcripts');
				if (transcriptsJson) {
					try {
						const storedTranscripts: StoredTranscript[] =
							JSON.parse(transcriptsJson);

						// Convert stored transcripts to TranscriptMessage format
						const loadedMessages: TranscriptMessage[] =
							storedTranscripts.map((t, idx) => ({
								id: `stored-${participant.identity}-${t.timestamp}-${idx}`,
								speaker: t.role === 'assistant' ? 'agent' : t.role,
								text: t.text,
								isFinal: true,
								timestamp: t.timestamp,
							}));

						if (loadedMessages.length > 0) {
							console.log(
								`Loaded ${loadedMessages.length} transcripts from participant ${participant.identity} (kind: ${participant.kind})`
							);
							allLoadedMessages.push(...loadedMessages);
						}
					} catch (e) {
						console.warn('Failed to parse stored transcripts:', e);
					}
				}
			}
		}
		
		// Sort by timestamp to ensure chronological order
		if (allLoadedMessages.length > 0) {
			allLoadedMessages.sort((a, b) => a.timestamp - b.timestamp);
			console.log(`Loaded ${allLoadedMessages.length} total transcripts from storage`);
			return allLoadedMessages;
		}
	} catch (error) {
		console.error('Error loading transcripts from storage:', error);
	}

	return [];
}


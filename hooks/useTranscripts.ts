// Custom hook for managing transcript messages with smart merging

import { useState, useRef, useCallback } from 'react';
import type { TranscriptMessage, MessageBuffer } from '@/types/room';
import { storeTranscriptsInStorage } from '@/utils/transcriptStorage';
import type { Room } from 'livekit-client';

const MERGE_TIME_WINDOW = 2000; // 2 seconds - messages within this time are merged
const FINALIZE_DELAY = 1500; // 1.5 seconds - delay before finalizing merged messages

export function useTranscripts() {
	const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
	const interimMessagesRef = useRef<Map<string, TranscriptMessage>>(new Map());
	const messageBufferRef = useRef<Map<string, MessageBuffer>>(new Map());
	const roomRef = useRef<Room | null>(null);

	/**
	 * Finalize merged messages from buffer
	 */
	const finalizeMergedMessages = useCallback(
		(speaker: string) => {
			const buffer = messageBufferRef.current.get(speaker);
			if (!buffer || buffer.messages.length === 0) return;

			// Merge all buffered messages into one
			const mergedText = buffer.messages
				.map((m) => m.text.trim())
				.filter((text) => text.length > 0)
				.join(' ');

			if (mergedText.trim()) {
				const mergedMessage: TranscriptMessage = {
					id: `merged-${speaker}-${buffer.messages[0].timestamp}-${Date.now()}`,
					speaker: speaker,
					text: mergedText,
					isFinal: true,
					timestamp: buffer.messages[0].timestamp,
				};

				console.log(
					`[Merge] Finalizing ${buffer.messages.length} messages for ${speaker}: "${mergedText}"`
				);

				setTranscripts((prev) => {
					// Remove any interim messages for this speaker
					const filtered = prev.filter(
						(msg) => msg.isFinal || msg.speaker !== speaker
					);

					// Add merged message
					const updated = [...filtered, mergedMessage];

				// Store transcripts in participant attributes
				storeTranscriptsInStorage(roomRef.current, updated);

					return updated;
				});
			}

			// Clear buffer
			buffer.messages = [];
			buffer.timeoutId = null;
		},
		[]
	);

	/**
	 * Add a transcript message with smart merging logic
	 */
	const addTranscript = useCallback(
		(message: TranscriptMessage) => {
			if (message.isFinal) {
				console.log('Final transcript:', message);

				// Remove interim message if exists
				interimMessagesRef.current.delete(message.id);

				// Smart merging: buffer messages from same speaker within time window
				const now = Date.now();
				const bufferKey = message.speaker;
				let buffer = messageBufferRef.current.get(bufferKey);

				// Check if we should merge with recent messages
				if (buffer && now - buffer.lastUpdate < MERGE_TIME_WINDOW) {
					// Add to existing buffer
					buffer.messages.push(message);
					buffer.lastUpdate = now;

					// Clear existing timeout
					if (buffer.timeoutId) {
						clearTimeout(buffer.timeoutId);
					}

					// Set new timeout to finalize merged messages
					buffer.timeoutId = setTimeout(() => {
						finalizeMergedMessages(bufferKey);
					}, FINALIZE_DELAY);

					console.log(
						`[Merge] Buffering message for ${bufferKey}. Total: ${buffer.messages.length}`
					);
				} else {
					// Start new buffer or finalize immediately if time window passed
					if (buffer && buffer.messages.length > 0) {
						// Finalize previous buffer first
						finalizeMergedMessages(bufferKey);
					}

					// Create new buffer
					buffer = {
						messages: [message],
						lastUpdate: now,
						timeoutId: setTimeout(() => {
							finalizeMergedMessages(bufferKey);
						}, FINALIZE_DELAY),
					};
					messageBufferRef.current.set(bufferKey, buffer);
					console.log(`[Merge] Started new buffer for ${bufferKey}`);
				}
			} else {
				console.log('Interim transcript:', message);
				// Interim transcript - update in place or add if new
				setTranscripts((prev) => {
					// Find existing interim message with the same segment ID
					const existingIndex = prev.findIndex(
						(msg) => msg.id === message.id && !msg.isFinal
					);

					if (existingIndex >= 0) {
						// Update existing interim message
						const updated = [...prev];
						updated[existingIndex] = message;
						return updated;
					} else {
						// Add new interim message at the end
						return [...prev, message];
					}
				});

				// Track interim message
				interimMessagesRef.current.set(message.id, message);
			}
		},
		[finalizeMergedMessages]
	);

	/**
	 * Set transcripts (used when loading from storage)
	 */
	const setTranscriptsFromStorage = useCallback((newTranscripts: TranscriptMessage[]) => {
		setTranscripts(newTranscripts);
	}, []);

	/**
	 * Clear all transcripts and buffers
	 */
	const clearTranscripts = useCallback(() => {
		// Finalize any pending buffered messages
		for (const [speaker, buffer] of messageBufferRef.current.entries()) {
			if (buffer.timeoutId) {
				clearTimeout(buffer.timeoutId);
			}
			if (buffer.messages.length > 0) {
				finalizeMergedMessages(speaker);
			}
		}

		setTranscripts([]);
		interimMessagesRef.current.clear();
		messageBufferRef.current.clear();
	}, [finalizeMergedMessages]);

	return {
		transcripts,
		addTranscript,
		setTranscriptsFromStorage,
		clearTranscripts,
		setRoom: (room: Room | null) => {
			roomRef.current = room;
		},
	};
}


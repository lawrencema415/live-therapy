// Custom hook for managing transcript messages with smart merging

import { useState, useRef, useCallback } from 'react';
import type { TranscriptMessage, MessageBuffer } from '@/types/room';
import { storeTranscriptsInStorage } from '@/utils/transcriptStorage';
import type { Room } from 'livekit-client';

const MERGE_TIME_WINDOW = 1000; // 1 seconds - messages within this time are merged
const FINALIZE_DELAY = 1000; // 1 seconds - delay before finalizing merged messages

export function useTranscripts() {
	const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
	const interimMessagesRef = useRef<Map<string, TranscriptMessage>>(new Map());
	const messageBufferRef = useRef<Map<string, MessageBuffer>>(new Map());
	const roomRef = useRef<Room | null>(null);
	// Ref to track all finalized transcripts synchronously (for cleanup/saving)
	const allTranscriptsRef = useRef<TranscriptMessage[]>([]);

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

					// Deduplicate: Check if a message with the same text and timestamp already exists
					// This prevents duplicates when finalizing buffered messages
					const isDuplicate = filtered.some(
						(msg) =>
							msg.isFinal &&
							msg.speaker === speaker &&
							msg.text.trim() === mergedText.trim() &&
							Math.abs(msg.timestamp - mergedMessage.timestamp) < 5000 // Within 5 seconds
					);

					if (isDuplicate) {
						console.log(`[Merge] Skipping duplicate merged message for ${speaker}: "${mergedText.substring(0, 50)}..."`);
						// Update ref with existing messages only
						const finalOnly = filtered.filter(m => m.isFinal);
						allTranscriptsRef.current = finalOnly;
						return filtered; // Return without adding duplicate
					}

					// Add merged message
					const updated = [...filtered, mergedMessage];
					
					// Update ref synchronously with ONLY final messages (for cleanup access)
					const finalOnly = updated.filter(m => m.isFinal);
					allTranscriptsRef.current = finalOnly;
					
					// Log agent message count for debugging
					const agentCount = finalOnly.filter(t => t.speaker === 'agent').length;
					const userCount = finalOnly.filter(t => t.speaker === 'user').length;
					console.log(`[Transcripts] After finalizing ${speaker} - Total final: ${finalOnly.length}, Agent: ${agentCount}, User: ${userCount}`);

				// Store transcripts in participant attributes
				storeTranscriptsInStorage(roomRef.current, finalOnly);

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
			// Log ALL transcripts (including agent) for debugging
			console.log(
				`[Transcripts] Adding transcript - Speaker: ${message.speaker}, Final: ${message.isFinal}, Text: "${message.text.substring(0, 50)}${
					message.text.length > 50 ? '...' : ''
				}"`
			);

			if (message.isFinal) {
				console.log(
					`[Transcripts] Final transcript received - Speaker: ${message.speaker}`
				);

				const interimAggregate = interimMessagesRef.current.get(message.id);
				const rawFinalText = message.text.trim();
				const fallbackText = interimAggregate?.text?.trim() ?? '';
				const finalText = rawFinalText || fallbackText;

				const finalMessage: TranscriptMessage = {
					...message,
					text: finalText,
					timestamp: interimAggregate?.timestamp ?? message.timestamp,
					isFinal: true,
				};

				// Remove interim aggregate (no longer needed)
				interimMessagesRef.current.delete(message.id);

				// Skip empty final messages (could happen if speech was interrupted very early)
				if (!finalMessage.text.trim()) {
					console.log(
						`[Transcripts] Skipping empty final transcript for ${message.speaker}`
					);
					return;
				}

				if (message.speaker === 'user') {
					setTranscripts((prev) => {
						const withoutCurrent = prev.filter((msg) => msg.id !== message.id);
						const updated = [...withoutCurrent, finalMessage];
						updated.sort((a, b) => a.timestamp - b.timestamp);

						const finalOnly = updated.filter((m) => m.isFinal);
						allTranscriptsRef.current = finalOnly;
						storeTranscriptsInStorage(roomRef.current, finalOnly);

						return updated;
					});
					return;
				}

				// Smart merging: buffer messages from same speaker within time window
				const now = Date.now();
				const bufferKey = finalMessage.speaker;
				let buffer = messageBufferRef.current.get(bufferKey);

				// Check if we should merge with recent messages
				if (buffer && now - buffer.lastUpdate < MERGE_TIME_WINDOW) {
					// Add to existing buffer
					buffer.messages.push(finalMessage);
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
						messages: [finalMessage],
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
				const existingAggregate = interimMessagesRef.current.get(message.id);
				const incomingText = message.text;
				const normalizedIncoming = incomingText
					.replace(/\s+/g, ' ')
					.trim();
				const existingText = existingAggregate?.text ?? '';
				const normalizedExisting = existingText
					.replace(/\s+/g, ' ')
					.trim();

				let textToStore: string;
				if (!normalizedExisting) {
					textToStore = normalizedIncoming;
				} else if (normalizedIncoming.startsWith(normalizedExisting)) {
					textToStore = normalizedIncoming;
				} else if (normalizedExisting.startsWith(normalizedIncoming)) {
					textToStore = normalizedExisting;
				} else {
					textToStore = normalizedIncoming;
				}
				const aggregatedMessage: TranscriptMessage = {
					...message,
					text: textToStore,
					timestamp: existingAggregate?.timestamp ?? message.timestamp,
					isFinal: false,
				};

				// Interim transcript - always keep the stream message at the end
				setTranscripts((prev) => {
					const withoutCurrent = prev.filter(
						(msg) => !(msg.id === message.id && !msg.isFinal)
					);
					const updated = [...withoutCurrent, aggregatedMessage];
					
					// Update ref for final messages only (interim messages shouldn't be saved)
					// Only update ref if we have final messages in the updated array
					const finalMessages = updated.filter(m => m.isFinal);
					if (finalMessages.length > 0) {
						allTranscriptsRef.current = finalMessages;
					}
					
					return updated;
				});

				// Track interim aggregate
				interimMessagesRef.current.set(message.id, aggregatedMessage);
			}
		},
		[finalizeMergedMessages]
	);

	/**
	 * Set transcripts (used when loading from storage)
	 * Deduplicates transcripts before setting to prevent duplicates
	 */
	const setTranscriptsFromStorage = useCallback((newTranscripts: TranscriptMessage[]) => {
		// Deduplicate transcripts by id, text, timestamp, and speaker
		const seen = new Map<string, TranscriptMessage>();
		
		for (const transcript of newTranscripts) {
			// Create unique key from speaker, text, and timestamp
			const key = `${transcript.speaker}-${transcript.text.trim()}-${transcript.timestamp}`;
			
			// Only keep the first occurrence (or prefer final messages)
			if (!seen.has(key) || (!seen.get(key)?.isFinal && transcript.isFinal)) {
				seen.set(key, transcript);
			}
		}
		
		const deduplicated = Array.from(seen.values()).sort((a, b) => a.timestamp - b.timestamp);
		
		if (deduplicated.length !== newTranscripts.length) {
			console.log(`[Transcripts] Deduplicated transcripts: ${newTranscripts.length} -> ${deduplicated.length}`);
		}
		
		setTranscripts(deduplicated);
		allTranscriptsRef.current = deduplicated.filter(m => m.isFinal); // Keep ref in sync with final only
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
		allTranscriptsRef.current = [];
		interimMessagesRef.current.clear();
		messageBufferRef.current.clear();
	}, [finalizeMergedMessages]);

	/**
	 * Force finalize all pending buffered messages
	 * This ensures agent messages in buffers are saved before disconnect
	 * Returns the current transcripts after finalization (for immediate access)
	 */
	const finalizeAllBuffers = useCallback(() => {
		console.log('[Transcripts] Finalizing all pending message buffers...');
		const buffersToFinalize: Array<{ speaker: string; count: number }> = [];
		
		// Collect all buffered messages first
		const allBufferedMessages: Array<{ speaker: string; messages: TranscriptMessage[] }> = [];
		for (const [speaker, buffer] of messageBufferRef.current.entries()) {
			if (buffer.timeoutId) {
				clearTimeout(buffer.timeoutId);
				buffer.timeoutId = null;
			}
			if (buffer.messages.length > 0) {
				buffersToFinalize.push({ speaker, count: buffer.messages.length });
				allBufferedMessages.push({ speaker, messages: [...buffer.messages] });
				console.log(`[Transcripts] Finalizing ${buffer.messages.length} buffered messages for ${speaker}`);
			}
		}
		
		// Now finalize all buffers (this updates state async, but we'll update ref synchronously)
		for (const { speaker } of allBufferedMessages) {
			finalizeMergedMessages(speaker);
		}
		
		// Manually update ref with finalized messages synchronously
		// This ensures we have the latest data even if state hasn't updated yet
		if (allBufferedMessages.length > 0) {
			const currentFinal = allTranscriptsRef.current.filter(m => m.isFinal);
			const newFinalized: TranscriptMessage[] = [];
			
			for (const { speaker, messages } of allBufferedMessages) {
				if (messages.length > 0) {
					const mergedText = messages
						.map((m) => m.text.trim())
						.filter((text) => text.length > 0)
						.join(' ');
					
					if (mergedText.trim()) {
						newFinalized.push({
							id: `merged-${speaker}-${messages[0].timestamp}-${Date.now()}`,
							speaker: speaker,
							text: mergedText,
							isFinal: true,
							timestamp: messages[0].timestamp,
						});
					}
				}
			}
			
			// Remove any existing final messages from these speakers and add new ones
			const speakersToUpdate = new Set(allBufferedMessages.map(b => b.speaker));
			const filtered = currentFinal.filter(m => !speakersToUpdate.has(m.speaker));
			const updated = [...filtered, ...newFinalized].sort((a, b) => a.timestamp - b.timestamp);
			
			allTranscriptsRef.current = updated;
			
			console.log(`[Transcripts] Updated ref - Total: ${updated.length}, Agent: ${updated.filter(t => t.speaker === 'agent').length}, User: ${updated.filter(t => t.speaker === 'user').length}`);
		}
		
		if (buffersToFinalize.length > 0) {
			console.log(`[Transcripts] Finalized ${buffersToFinalize.length} buffers:`, buffersToFinalize.map(b => `${b.speaker}(${b.count})`).join(', '));
		} else {
			console.log('[Transcripts] No buffers to finalize');
		}
		
		// Return current transcripts from ref (synchronously accessible, now with buffered messages)
		return allTranscriptsRef.current;
	}, [finalizeMergedMessages]);
	
	/**
	 * Get all current transcripts synchronously (for cleanup)
	 */
	const getAllTranscripts = useCallback(() => {
		// Finalize buffers first (this updates the ref synchronously)
		const finalized = finalizeAllBuffers();
		
		// Also get current state transcripts (in case there are any not in buffers)
		const stateFinal = allTranscriptsRef.current.filter(m => m.isFinal);
		
		// Combine and deduplicate by id, prefer finalized buffer messages
		const allFinal = new Map<string, TranscriptMessage>();
		
		// Add state transcripts first
		for (const msg of stateFinal) {
			if (msg.isFinal) {
				allFinal.set(msg.id, msg);
			}
		}
		
		// Add finalized buffer messages (these will overwrite if same id)
		for (const msg of finalized) {
			if (msg.isFinal) {
				allFinal.set(msg.id, msg);
			}
		}
		
		const result = Array.from(allFinal.values()).sort((a, b) => a.timestamp - b.timestamp);
		
		// Update ref with combined result
		allTranscriptsRef.current = result;
		
		const agentCount = result.filter(t => t.speaker === 'agent').length;
		const userCount = result.filter(t => t.speaker === 'user').length;
		console.log(`[Transcripts] getAllTranscripts - Total: ${result.length}, Agent: ${agentCount}, User: ${userCount}`);
		
		return result;
	}, [finalizeAllBuffers]);

	return {
		transcripts,
		addTranscript,
		setTranscriptsFromStorage,
		clearTranscripts,
		finalizeAllBuffers,
		getAllTranscripts,
		setRoom: (room: Room | null) => {
			roomRef.current = room;
		},
	};
}


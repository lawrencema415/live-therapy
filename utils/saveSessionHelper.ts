// Helper function for saving session transcripts
import { loadSessionSummaries, saveSessionSummaries } from './userSessionStorage';
import { getOrCreateSession, saveTranscripts } from './supabaseDatabase';
import type { TranscriptMessage } from '@/types/room';
import type { StoredTranscript } from '@/types/room';

interface SaveSessionParams {
	userName: string;
	transcripts: TranscriptMessage[];
	onComplete?: () => void;
}

// Track ongoing saves to prevent duplicate saves for the same session
const ongoingSaves = new Map<string, Promise<void>>();

/**
 * Save session transcripts to Supabase and generate summary
 * Includes deduplication and prevents concurrent saves for the same session
 */
export async function saveSessionTranscripts({
	userName,
	transcripts,
	onComplete,
}: SaveSessionParams): Promise<void> {
	if (!userName.trim() || transcripts.length === 0) {
		return;
	}

	// Use current time (rounded to minute) to allow multiple sessions per day
	// This is used as a key for the ongoingSaves map BEFORE getting the session ID
	const sessionKey = `session-${Math.floor(Date.now() / 60000)}`;

	// Check if there's already a save in progress for this day's session
	// This MUST happen BEFORE getOrCreateSession to prevent race conditions
	// Use a synchronous check and immediate promise creation to prevent race conditions
	const existingSave = ongoingSaves.get(sessionKey);
	if (existingSave) {
		console.log(`[SessionSave] Save already in progress for session key ${sessionKey}, waiting for existing save to complete`);
		await existingSave; // Wait for existing save to complete
		onComplete?.();
		return;
	}

	// Create the save promise IMMEDIATELY and store it BEFORE doing any async work
	// This prevents other concurrent calls from also starting a save
	const savePromise = (async (): Promise<void> => {
		// Get or create session INSIDE the promise
		const sessionId = await getOrCreateSession();
	
		if (!sessionId) {
			console.error('[SessionSave] Failed to get or create session');
			return;
		}

		console.log(`[SessionSave] Using session ID: ${sessionId} for saving ${transcripts.length} transcripts`);

		try {
			// Sanitize: exclude system messages (crisis resources) from saved transcripts
			// Also filter to only final messages to avoid saving interim/duplicate messages
			const sanitized: StoredTranscript[] = transcripts
				.filter((t) => t.isFinal && t.speaker !== 'system') // Only final messages
				.map((t) => ({
					role: t.speaker === 'agent' ? 'assistant' : t.speaker,
					text: t.text,
					timestamp: t.timestamp,
				}));

			if (sanitized.length === 0) {
				console.log('[SessionSave] No final transcripts to save');
				return;
			}

			// Deduplicate before saving (extra safety layer)
			const seen = new Set<string>();
			const deduplicated = sanitized.filter(t => {
				const key = `${t.timestamp}-${t.text.trim()}-${t.role}`;
				if (seen.has(key)) {
					return false;
				}
				seen.add(key);
				return true;
			});

			if (deduplicated.length !== sanitized.length) {
				console.log(`[SessionSave] Deduplicated before saving: ${sanitized.length} -> ${deduplicated.length}`);
			}

			// Save transcripts to Supabase (includes additional deduplication in saveTranscripts)
			await saveTranscripts(sessionId, deduplicated);

			console.log(
				`[SessionSave] Saved ${deduplicated.length} deduplicated transcripts (Agent: ${
					deduplicated.filter((t) => t.role === 'assistant').length
				}, User: ${deduplicated.filter((t) => t.role === 'user').length})`
			);

			// Load the most recent previous summary to provide context
			const existingSummaries = await loadSessionSummaries(userName);
			const previousSummary = existingSummaries.length > 0 ? existingSummaries[existingSummaries.length - 1] : null;

			// Generate and save summary via API (async, don't block)
			fetch('/api/summarize', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					userName: userName.trim(),
					transcripts: sanitized,
					previousSummary: previousSummary || undefined,
				}),
			})
				.then(async (response) => {
					if (response.ok) {
						const data = await response.json();
						const summary = data.summary;
						if (summary) {
							// Add new summary to existing ones (we already loaded them above)
							const updatedSummaries = [...existingSummaries, summary].slice(-10);
							await saveSessionSummaries(userName, updatedSummaries);
							console.log(`[SessionSave] ✓ Generated and saved summary for ${userName}`);
						}
					} else {
						const errorText = await response.text();
						console.warn('[SessionSave] Failed to generate summary:', errorText);
					}
				})
				.catch((error) => {
					console.error('[SessionSave] Error generating summary:', error);
				});
		} catch (error) {
			console.error('[SessionSave] Error in save operation:', error);
			throw error; // Re-throw to propagate to caller
		} finally {
			// Remove from ongoing saves map
			ongoingSaves.delete(sessionKey);
		}
	})();

	// Store the promise IMMEDIATELY to prevent concurrent saves
	// This must happen synchronously before any await to prevent race conditions
	ongoingSaves.set(sessionKey, savePromise);

	// Wait for save to complete
	try {
		await savePromise;
		onComplete?.();
	} catch (error) {
		console.error('[SessionSave] Save promise failed:', error);
		onComplete?.(); // Still call onComplete even if save failed
	}
}

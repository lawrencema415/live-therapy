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

/**
 * Save session transcripts to Supabase and generate summary
 */
export async function saveSessionTranscripts({
	userName,
	transcripts,
	onComplete,
}: SaveSessionParams): Promise<void> {
	if (!userName.trim() || transcripts.length === 0) {
		return;
	}

	// Sanitize: exclude system messages (crisis resources) from saved transcripts
	const sanitized: StoredTranscript[] = transcripts
		.filter((t) => t.speaker !== 'system' && (t.isFinal || t.speaker === 'agent'))
		.map((t) => ({
			role: t.speaker === 'agent' ? 'assistant' : t.speaker,
			text: t.text,
			timestamp: t.timestamp,
		}));

	if (sanitized.length === 0) {
		return;
	}

	// Get or create session
	const sessionId = await getOrCreateSession();
	if (!sessionId) {
		console.error('[SessionSave] Failed to get or create session');
		return;
	}

	// Save transcripts to Supabase
	await saveTranscripts(sessionId, sanitized);

	console.log(
		`[SessionSave] Saved ${sanitized.length} transcripts (Agent: ${
			sanitized.filter((t) => t.role === 'assistant').length
		}, User: ${sanitized.filter((t) => t.role === 'user').length})`
	);

	onComplete?.();

	// Generate and save summary via API (async, don't block)
	fetch('/api/summarize', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			userName: userName.trim(),
			transcripts: sanitized,
		}),
	})
		.then(async (response) => {
			if (response.ok) {
				const data = await response.json();
				const summary = data.summary;
				if (summary) {
					// Load existing summaries and add new one
					const existingSummaries = await loadSessionSummaries(userName);
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
}


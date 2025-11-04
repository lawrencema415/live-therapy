// User session storage utility - memstorage using localStorage
// Stores user data including name and conversation history

import type { TranscriptMessage, StoredTranscript } from '@/types/room';

const STORAGE_PREFIX = 'therapy_user_';

/**
 * Get storage key for a user
 */
function getUserKey(userName: string): string {
	return `${STORAGE_PREFIX}${userName.toLowerCase().trim()}`;
}

/**
 * User session data structure
 */
export interface UserSessionData {
	userName: string;
	transcripts: StoredTranscript[];
	lastSessionDate: number;
}

/**
 * Save user session data to localStorage
 */
export function saveUserSession(userName: string, transcripts: TranscriptMessage[]): void {
	try {
		const key = getUserKey(userName);
		const storedTranscripts: StoredTranscript[] = transcripts
			.filter((t) => t.isFinal)
			.map((t) => ({
				role: t.speaker === 'agent' ? 'assistant' : t.speaker,
				text: t.text,
				timestamp: t.timestamp,
			}));

		const sessionData: UserSessionData = {
			userName: userName.trim(),
			transcripts: storedTranscripts,
			lastSessionDate: Date.now(),
		};

		localStorage.setItem(key, JSON.stringify(sessionData));
		console.log(`[UserSession] Saved session for ${userName}: ${storedTranscripts.length} transcripts`);
	} catch (error) {
		console.error('[UserSession] Error saving session:', error);
	}
}

/**
 * Load user session data from localStorage
 */
export function loadUserSession(userName: string): UserSessionData | null {
	try {
		const key = getUserKey(userName);
		const data = localStorage.getItem(key);
		if (!data) {
			return null;
		}

		const sessionData: UserSessionData = JSON.parse(data);
		console.log(`[UserSession] Loaded session for ${userName}: ${sessionData.transcripts.length} transcripts`);
		return sessionData;
	} catch (error) {
		console.error('[UserSession] Error loading session:', error);
		return null;
	}
}

/**
 * Convert stored transcripts to TranscriptMessage format
 */
export function convertStoredToMessages(
	storedTranscripts: StoredTranscript[]
): TranscriptMessage[] {
	return storedTranscripts.map((t, idx) => ({
		id: `stored-${t.timestamp}-${idx}`,
		speaker: t.role === 'assistant' ? 'agent' : t.role,
		text: t.text,
		isFinal: true,
		timestamp: t.timestamp,
	}));
}

/**
 * Sanitize and process transcript data for sending to backend
 */
export function sanitizeTranscripts(transcripts: StoredTranscript[]): StoredTranscript[] {
	return transcripts
		.filter((t) => {
			// Remove empty or invalid transcripts
			return t.text && t.text.trim().length > 0 && t.role && t.timestamp;
		})
		.map((t) => ({
			// Sanitize text - remove any potential issues
			role: t.role === 'agent' ? 'assistant' : t.role,
			text: t.text.trim(),
			timestamp: t.timestamp,
		}))
		.sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp
}


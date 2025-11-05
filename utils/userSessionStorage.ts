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
 * Session summary structure (matches agent format)
 */
export interface SessionSummary {
	timestamp: number;
	keyThemes: string[];
	emotionalState: string;
	openIssues: string[];
	summary: string;
}

/**
 * User session data structure
 */
export interface UserSessionData {
	userName: string;
	transcripts: StoredTranscript[];
	summaries: SessionSummary[];
	lastSessionDate: number;
}

/**
 * Save user session data to localStorage
 */
export function saveUserSession(userName: string, transcripts: TranscriptMessage[]): void {
	try {
		const key = getUserKey(userName);
		
		// Log transcript breakdown for debugging
		const agentCount = transcripts.filter(t => t.speaker === 'agent').length;
		const userCount = transcripts.filter(t => t.speaker === 'user').length;
		const otherCount = transcripts.length - agentCount - userCount;
		console.log(`[UserSession] Saving transcripts - Total: ${transcripts.length}, Agent: ${agentCount}, User: ${userCount}, Other: ${otherCount}`);
		
		const storedTranscripts: StoredTranscript[] = transcripts
			.filter((t) => t.isFinal)
			.map((t) => ({
				role: t.speaker === 'agent' ? 'assistant' : t.speaker,
				text: t.text,
				timestamp: t.timestamp,
			}));

		// Log stored breakdown
		const storedAgentCount = storedTranscripts.filter(t => t.role === 'assistant').length;
		const storedUserCount = storedTranscripts.filter(t => t.role === 'user').length;
		console.log(`[UserSession] Stored transcripts - Total: ${storedTranscripts.length}, Assistant: ${storedAgentCount}, User: ${storedUserCount}`);

		// Load existing summaries if any
		const existingSession = loadUserSession(userName);
		const existingSummaries = existingSession?.summaries || [];

		const sessionData: UserSessionData = {
			userName: userName.trim(),
			transcripts: storedTranscripts,
			summaries: existingSummaries, // Preserve existing summaries
			lastSessionDate: Date.now(),
		};

		localStorage.setItem(key, JSON.stringify(sessionData));
		console.log(`[UserSession] ✓ Saved session for ${userName}: ${storedTranscripts.length} transcripts (${storedAgentCount} assistant, ${storedUserCount} user)`);
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
		const agentCount = sessionData.transcripts?.filter(t => t.role === 'assistant').length || 0;
		const userCount = sessionData.transcripts?.filter(t => t.role === 'user').length || 0;
		console.log(`[UserSession] Loaded session for ${userName}: ${sessionData.transcripts?.length || 0} transcripts (${agentCount} assistant, ${userCount} user), ${sessionData.summaries.length} summaries`);
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

/**
 * Save session summaries to localStorage
 */
export function saveSessionSummaries(userName: string, summaries: SessionSummary[]): void {
	try {
		const key = getUserKey(userName);
		const existingSession = loadUserSession(userName);
		
		const sessionData: UserSessionData = {
			userName: userName.trim(),
			transcripts: existingSession?.transcripts || [],
			summaries: summaries, // Keep only last 10 summaries
			lastSessionDate: existingSession?.lastSessionDate || Date.now(),
		};

		localStorage.setItem(key, JSON.stringify(sessionData));
		console.log(`[UserSession] Saved ${summaries.length} summaries for ${userName}`);
	} catch (error) {
		console.error('[UserSession] Error saving summaries:', error);
	}
}

/**
 * Load session summaries from localStorage
 */
export function loadSessionSummaries(userName: string): SessionSummary[] {
	try {
		const session = loadUserSession(userName);
		return session?.summaries || [];
	} catch (error) {
		console.error('[UserSession] Error loading summaries:', error);
		return [];
	}
}


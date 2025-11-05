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
 * Mood check-in data structure
 */
export interface MoodCheckInData {
	rating: number;
	notes?: string;
	timestamp: number;
}

/**
 * Session mood data (pre and post)
 */
export interface SessionMoodData {
	preSession?: MoodCheckInData;
	postSession?: MoodCheckInData;
	sessionTimestamp: number;
}

/**
 * User session data structure
 */
export interface UserSessionData {
	userName: string;
	transcripts: StoredTranscript[];
	summaries: SessionSummary[];
	lastSessionDate: number;
	moodData: SessionMoodData[]; // Array of mood check-ins per session
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

		// Preserve existing mood data
		const existingMoodData = existingSession?.moodData || [];

		const sessionData: UserSessionData = {
			userName: userName.trim(),
			transcripts: storedTranscripts,
			summaries: existingSummaries, // Preserve existing summaries
			lastSessionDate: Date.now(),
			moodData: existingMoodData, // Preserve existing mood data
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
			moodData: existingSession?.moodData || [], // Preserve existing mood data
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

/**
 * Save mood check-in data for a session
 */
export function saveMoodCheckIn(
	userName: string,
	type: 'pre' | 'post',
	moodData: MoodCheckInData
): void {
	try {
		const session = loadUserSession(userName) || {
			userName: userName.trim(),
			transcripts: [],
			summaries: [],
			lastSessionDate: Date.now(),
			moodData: [],
		};

		const now = Date.now();
		const sessionWindow = 5 * 60 * 1000; // 5 minutes window for same session

		// Find existing session mood data for today (within 5 min window)
		let foundSession = false;
		const updatedMoodData = session.moodData.map((mood) => {
			if (Math.abs(mood.sessionTimestamp - now) < sessionWindow) {
				foundSession = true;
				return {
					...mood,
					[type === 'pre' ? 'preSession' : 'postSession']: moodData,
					sessionTimestamp: mood.sessionTimestamp || now,
				};
			}
			return mood;
		});

		if (!foundSession) {
			// Create new session mood entry
			updatedMoodData.push({
				[type === 'pre' ? 'preSession' : 'postSession']: moodData,
				sessionTimestamp: now,
			});
		}

		const updatedSession: UserSessionData = {
			...session,
			moodData: updatedMoodData,
		};

		const key = getUserKey(userName);
		localStorage.setItem(key, JSON.stringify(updatedSession));
		console.log(`[UserSession] Saved ${type}-session mood check-in for ${userName}`);
	} catch (error) {
		console.error('[UserSession] Error saving mood check-in:', error);
	}
}

/**
 * Load all mood check-in data for a user
 */
export function loadMoodData(userName: string): SessionMoodData[] {
	try {
		const session = loadUserSession(userName);
		return session?.moodData || [];
	} catch (error) {
		console.error('[UserSession] Error loading mood data:', error);
		return [];
	}
}


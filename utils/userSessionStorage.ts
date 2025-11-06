// User session storage utility - using Supabase
// Stores user data including name and conversation history

import type { TranscriptMessage, StoredTranscript } from '@/types/room';
import {
	getOrCreateSession,
	saveTranscripts as saveTranscriptsToDB,
	loadRecentTranscripts,
	loadTranscripts,
	saveSummaries as saveSummariesToDB,
	loadSummaries as loadSummariesFromDB,
	saveMoodData as saveMoodDataToDB,
	loadMoodData as loadMoodDataFromDB,
} from '@/utils/supabaseDatabase';

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
 * Save user session data to Supabase
 */
export async function saveUserSession(userName: string, transcripts: TranscriptMessage[]): Promise<void> {
	try {
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

		// Get or create session
		const sessionId = await getOrCreateSession();
		if (!sessionId) {
			console.error('[UserSession] Failed to get or create session');
			return;
		}

		// Save transcripts to Supabase
		await saveTranscriptsToDB(sessionId, storedTranscripts);
		console.log(`[UserSession] ✓ Saved session for ${userName}: ${storedTranscripts.length} transcripts (${storedAgentCount} assistant, ${storedUserCount} user)`);
	} catch (error) {
		console.error('[UserSession] Error saving session:', error);
	}
}

/**
 * Load user session data from Supabase
 * Returns a UserSessionData object with transcripts, summaries, and mood data
 * @param userName - User name (for logging/display)
 * @param userId - Optional user ID. If provided, will be passed to database functions to avoid duplicate getUser() calls.
 */
export async function loadUserSession(userName: string, userId?: string): Promise<UserSessionData | null> {
	try {
		// Load transcripts, summaries, and mood data from Supabase
		// Pass userId to avoid duplicate getUser() calls
		const transcripts = await loadRecentTranscripts(userId);
		const summaries = await loadSummariesFromDB(10, userId);
		const moodData = await loadMoodDataFromDB(userId);

		const agentCount = transcripts.filter(t => t.role === 'assistant').length;
		const userCount = transcripts.filter(t => t.role === 'user').length;
		console.log(`[UserSession] Loaded session for ${userName}: ${transcripts.length} transcripts (${agentCount} assistant, ${userCount} user), ${summaries.length} summaries`);

		return {
			userName: userName.trim(),
			transcripts,
			summaries,
			lastSessionDate: Date.now(),
			moodData,
		};
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
 * Save session summaries to Supabase
 */
export async function saveSessionSummaries(userName: string, summaries: SessionSummary[]): Promise<void> {
	try {
		// Get or create session
		const sessionId = await getOrCreateSession();
		if (!sessionId) {
			console.error('[UserSession] Failed to get or create session for summaries');
			return;
		}

		// Keep only last 10 summaries
		const summariesToSave = summaries.slice(-10);
		await saveSummariesToDB(sessionId, summariesToSave);
		console.log(`[UserSession] Saved ${summariesToSave.length} summaries for ${userName}`);
	} catch (error) {
		console.error('[UserSession] Error saving summaries:', error);
	}
}

/**
 * Load session summaries from Supabase
 * @param userName - User name (for logging/display)
 * @param userId - Optional user ID. If provided, will be passed to database functions to avoid duplicate getUser() calls.
 */
export async function loadSessionSummaries(userName: string, userId?: string): Promise<SessionSummary[]> {
	try {
		return await loadSummariesFromDB(10, userId);
	} catch (error) {
		console.error('[UserSession] Error loading summaries:', error);
		return [];
	}
}

/**
 * Save mood check-in data for a session to Supabase
 */
export async function saveMoodCheckIn(
	userName: string,
	type: 'pre' | 'post',
	moodData: MoodCheckInData
): Promise<void> {
	try {
		// Get or create session
		const sessionId = await getOrCreateSession();
		if (!sessionId) {
			console.error('[UserSession] Failed to get or create session for mood data');
			return;
		}

		const sessionTimestamp = Date.now();
		await saveMoodDataToDB(sessionId, sessionTimestamp, type, moodData);
		console.log(`[UserSession] Saved ${type}-session mood check-in for ${userName}`);
	} catch (error) {
		console.error('[UserSession] Error saving mood check-in:', error);
	}
}

/**
 * Load all mood check-in data for a user from Supabase
 * @param userName - User name (for logging/display)
 * @param userId - Optional user ID. If provided, will be passed to database functions to avoid duplicate getUser() calls.
 */
export async function loadMoodData(userName: string, userId?: string): Promise<SessionMoodData[]> {
	try {
		return await loadMoodDataFromDB(userId);
	} catch (error) {
		console.error('[UserSession] Error loading mood data:', error);
		return [];
	}
}


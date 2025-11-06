// frontend/utils/supabaseDatabase.ts
// Supabase database operations for therapy sessions

import { createClient } from '@/utils/supabase/client';
import type { StoredTranscript } from '@/types/room';
import type { SessionSummary, SessionMoodData, MoodCheckInData } from '@/utils/userSessionStorage';

/**
 * Get or create a therapy session for the current user
 * Returns session ID or null if user is not authenticated
 */
export async function getOrCreateSession(sessionTimestamp: number = Date.now()): Promise<string | null> {
	try {
		const supabase = createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			console.warn('[SupabaseDB] No authenticated user found');
			return null;
		}

		// Try to find existing session within the same day
		const sessionDate = new Date(sessionTimestamp);
		sessionDate.setHours(0, 0, 0, 0);
		const nextDay = new Date(sessionDate);
		nextDay.setDate(nextDay.getDate() + 1);
		
		const { data: existingSessions, error: selectError } = await supabase
			.from('therapy_sessions')
			.select('id')
			.eq('user_id', user.id)
			.gte('session_date', sessionDate.toISOString())
			.lt('session_date', nextDay.toISOString())
			.order('session_date', { ascending: false })
			.limit(1);

		if (selectError) {
			console.error('[SupabaseDB] Error checking for existing session:', selectError);
		}

		if (existingSessions && existingSessions.length > 0) {
			return existingSessions[0].id;
		}

		// Create new session
		const { data: newSession, error: insertError } = await supabase
			.from('therapy_sessions')
			.insert({
				user_id: user.id,
				session_date: new Date(sessionTimestamp).toISOString(),
			})
			.select('id')
			.single();

		if (insertError) {
			console.error('[SupabaseDB] Error creating session:', insertError);
			return null;
		}

		return newSession.id;
	} catch (error) {
		console.error('[SupabaseDB] Error in getOrCreateSession:', error);
		return null;
	}
}

/**
 * Save transcripts to Supabase for a session
 */
export async function saveTranscripts(
	sessionId: string,
	transcripts: StoredTranscript[]
): Promise<boolean> {
	try {
		const supabase = createClient();
		
		// Delete existing transcripts for this session to avoid duplicates
		await supabase
			.from('therapy_transcripts')
			.delete()
			.eq('session_id', sessionId);

		// Insert new transcripts
		const transcriptsToInsert = transcripts
			.filter(t => t.text && t.text.trim().length > 0)
			.map(t => ({
				session_id: sessionId,
				role: t.role === 'agent' ? 'assistant' : t.role,
				text: t.text.trim(),
				timestamp: t.timestamp,
			}));

		if (transcriptsToInsert.length === 0) {
			console.warn('[SupabaseDB] No valid transcripts to save');
			return true;
		}

		const { error } = await supabase
			.from('therapy_transcripts')
			.insert(transcriptsToInsert);

		if (error) {
			console.error('[SupabaseDB] Error saving transcripts:', error);
			return false;
		}

		console.log(`[SupabaseDB] ✓ Saved ${transcriptsToInsert.length} transcripts`);
		return true;
	} catch (error) {
		console.error('[SupabaseDB] Error in saveTranscripts:', error);
		return false;
	}
}

/**
 * Load transcripts from Supabase for a specific session
 */
export async function loadTranscripts(sessionId: string): Promise<StoredTranscript[]> {
	try {
		const supabase = createClient();
		const { data, error } = await supabase
			.from('therapy_transcripts')
			.select('role, text, timestamp')
			.eq('session_id', sessionId)
			.order('timestamp', { ascending: true });

		if (error) {
			console.error('[SupabaseDB] Error loading transcripts:', error);
			return [];
		}

		return (data || []).map(t => ({
			role: t.role,
			text: t.text,
			timestamp: t.timestamp,
		}));
	} catch (error) {
		console.error('[SupabaseDB] Error in loadTranscripts:', error);
		return [];
	}
}

/**
 * Load all transcripts for the current user (from most recent session)
 * Does NOT create a session if none exists - only loads existing data
 */
export async function loadRecentTranscripts(): Promise<StoredTranscript[]> {
	try {
		const supabase = createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return [];

		// Get most recent session (don't use .single() to avoid 406 errors)
		const { data: recentSessions } = await supabase
			.from('therapy_sessions')
			.select('id')
			.eq('user_id', user.id)
			.order('session_date', { ascending: false })
			.limit(1);

		if (!recentSessions || recentSessions.length === 0) {
			return [];
		}

		return await loadTranscripts(recentSessions[0].id);
	} catch (error) {
		console.error('[SupabaseDB] Error in loadRecentTranscripts:', error);
		return [];
	}
}

/**
 * Save session summary to Supabase
 */
export async function saveSummary(
	sessionId: string,
	summary: SessionSummary
): Promise<boolean> {
	try {
		const supabase = createClient();
		const { error } = await supabase
			.from('therapy_summaries')
			.insert({
				session_id: sessionId,
				timestamp: summary.timestamp,
				key_themes: summary.keyThemes || [],
				emotional_state: summary.emotionalState,
				open_issues: summary.openIssues || [],
				summary: summary.summary,
			});

		if (error) {
			console.error('[SupabaseDB] Error saving summary:', error);
			return false;
		}

		console.log('[SupabaseDB] ✓ Saved session summary');
		return true;
	} catch (error) {
		console.error('[SupabaseDB] Error in saveSummary:', error);
		return false;
	}
}

/**
 * Save multiple session summaries to Supabase
 */
export async function saveSummaries(
	sessionId: string,
	summaries: SessionSummary[]
): Promise<boolean> {
	try {
		const supabase = createClient();
		
		// Delete existing summaries for this session
		await supabase
			.from('therapy_summaries')
			.delete()
			.eq('session_id', sessionId);

		if (summaries.length === 0) {
			return true;
		}

		const summariesToInsert = summaries.map(s => ({
			session_id: sessionId,
			timestamp: s.timestamp,
			key_themes: s.keyThemes || [],
			emotional_state: s.emotionalState,
			open_issues: s.openIssues || [],
			summary: s.summary,
		}));

		const { error } = await supabase
			.from('therapy_summaries')
			.insert(summariesToInsert);

		if (error) {
			console.error('[SupabaseDB] Error saving summaries:', error);
			return false;
		}

		console.log(`[SupabaseDB] ✓ Saved ${summariesToInsert.length} summaries`);
		return true;
	} catch (error) {
		console.error('[SupabaseDB] Error in saveSummaries:', error);
		return false;
	}
}

/**
 * Load all summaries for the current user (most recent first)
 */
export async function loadSummaries(limit: number = 10): Promise<SessionSummary[]> {
	try {
		const supabase = createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return [];

		// Get recent sessions
		const { data: sessions } = await supabase
			.from('therapy_sessions')
			.select('id')
			.eq('user_id', user.id)
			.order('session_date', { ascending: false })
			.limit(50); // Get recent sessions

		if (!sessions || sessions.length === 0) return [];

		const sessionIds = sessions.map(s => s.id);

		const { data, error } = await supabase
			.from('therapy_summaries')
			.select('timestamp, key_themes, emotional_state, open_issues, summary')
			.in('session_id', sessionIds)
			.order('timestamp', { ascending: false })
			.limit(limit);

		if (error) {
			console.error('[SupabaseDB] Error loading summaries:', error);
			return [];
		}

		return (data || []).map(s => ({
			timestamp: s.timestamp,
			keyThemes: s.key_themes || [],
			emotionalState: s.emotional_state,
			openIssues: s.open_issues || [],
			summary: s.summary,
		}));
	} catch (error) {
		console.error('[SupabaseDB] Error in loadSummaries:', error);
		return [];
	}
}

/**
 * Save mood check-in data
 */
export async function saveMoodData(
	sessionId: string,
	sessionTimestamp: number,
	type: 'pre' | 'post',
	moodData: MoodCheckInData
): Promise<boolean> {
	try {
		const supabase = createClient();
		
		// Check if mood data exists for this session (don't use .single() to avoid 406 errors)
		const { data: existingMoodData } = await supabase
			.from('therapy_mood_data')
			.select('id')
			.eq('session_id', sessionId)
			.limit(1);
		
		const existing = existingMoodData && existingMoodData.length > 0 ? existingMoodData[0] : null;

		const moodDataUpdate: any = {
			session_id: sessionId,
			session_timestamp: sessionTimestamp,
		};

		if (type === 'pre') {
			moodDataUpdate.pre_session_rating = moodData.rating;
			moodDataUpdate.pre_session_notes = moodData.notes || null;
			moodDataUpdate.pre_session_timestamp = moodData.timestamp;
		} else {
			moodDataUpdate.post_session_rating = moodData.rating;
			moodDataUpdate.post_session_notes = moodData.notes || null;
			moodDataUpdate.post_session_timestamp = moodData.timestamp;
		}

		if (existing) {
			// Update existing
			const { error } = await supabase
				.from('therapy_mood_data')
				.update(moodDataUpdate)
				.eq('id', existing.id);

			if (error) {
				console.error('[SupabaseDB] Error updating mood data:', error);
				return false;
			}
		} else {
			// Insert new
			const { error } = await supabase
				.from('therapy_mood_data')
				.insert(moodDataUpdate);

			if (error) {
				console.error('[SupabaseDB] Error inserting mood data:', error);
				return false;
			}
		}

		console.log(`[SupabaseDB] ✓ Saved ${type}-session mood data`);
		return true;
	} catch (error) {
		console.error('[SupabaseDB] Error in saveMoodData:', error);
		return false;
	}
}

/**
 * Load all mood data for the current user
 */
export async function loadMoodData(): Promise<SessionMoodData[]> {
	try {
		const supabase = createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return [];

		const { data: sessions } = await supabase
			.from('therapy_sessions')
			.select('id')
			.eq('user_id', user.id)
			.order('session_date', { ascending: false });

		if (!sessions || sessions.length === 0) return [];

		const sessionIds = sessions.map(s => s.id);

		const { data, error } = await supabase
			.from('therapy_mood_data')
			.select('session_timestamp, pre_session_rating, pre_session_notes, pre_session_timestamp, post_session_rating, post_session_notes, post_session_timestamp')
			.in('session_id', sessionIds)
			.order('session_timestamp', { ascending: false });

		if (error) {
			console.error('[SupabaseDB] Error loading mood data:', error);
			return [];
		}

		return (data || []).map(m => ({
			sessionTimestamp: m.session_timestamp,
			preSession: m.pre_session_rating ? {
				rating: m.pre_session_rating,
				notes: m.pre_session_notes || undefined,
				timestamp: m.pre_session_timestamp,
			} : undefined,
			postSession: m.post_session_rating ? {
				rating: m.post_session_rating,
				notes: m.post_session_notes || undefined,
				timestamp: m.post_session_timestamp,
			} : undefined,
		}));
	} catch (error) {
		console.error('[SupabaseDB] Error in loadMoodData:', error);
		return [];
	}
}

/**
 * Get all sessions for the current user
 */
export async function getUserSessions() {
	try {
		const supabase = createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return [];

		const { data, error } = await supabase
			.from('therapy_sessions')
			.select('id, session_date, created_at')
			.eq('user_id', user.id)
			.order('session_date', { ascending: false });

		if (error) {
			console.error('[SupabaseDB] Error loading sessions:', error);
			return [];
		}

		return data || [];
	} catch (error) {
		console.error('[SupabaseDB] Error in getUserSessions:', error);
		return [];
	}
}


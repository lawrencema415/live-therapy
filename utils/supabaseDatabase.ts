// frontend/utils/supabaseDatabase.ts
// Supabase database operations for therapy sessions

import { createClient } from '@/utils/supabase/client';
import type { StoredTranscript } from '@/types/room';
import type { SessionSummary, SessionMoodData, MoodCheckInData } from '@/utils/userSessionStorage';

/**
 * Get or create a therapy session for the current user
 * Returns session ID or null if user is not authenticated
 */
// Track ongoing session creation to prevent duplicate sessions
const ongoingSessionCreation = new Map<string, Promise<string | null>>();

export async function getOrCreateSession(sessionTimestamp: number = Date.now()): Promise<string | null> {
	try {
		const supabase = createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			console.warn('[SupabaseDB] No authenticated user found');
			return null;
		}

		// Use actual timestamp for session key to allow multiple sessions per day
		// Round to nearest minute to prevent race conditions for very rapid session starts
		const sessionKey = `${user.id}-${Math.floor(sessionTimestamp / 60000)}`;

		// Check if session creation is already in progress for this user/day
		const existingCreation = ongoingSessionCreation.get(sessionKey);
		if (existingCreation) {
			console.log(`[SupabaseDB] Session creation already in progress for key ${sessionKey}, waiting...`);
			return await existingCreation;
		}

		// Create the session creation promise
		const creationPromise = (async (): Promise<string | null> => {
			try {
				// First, check if a session already exists for this user within the same minute
				// This prevents creating duplicate sessions when pre/post mood data is saved
				const sessionDateStart = new Date(sessionTimestamp);
				sessionDateStart.setSeconds(0, 0); // Round down to start of minute
				const sessionDateEnd = new Date(sessionDateStart);
				sessionDateEnd.setMinutes(sessionDateEnd.getMinutes() + 1); // End of minute
				
				const { data: existingSessions, error: selectError } = await supabase
					.from('therapy_sessions')
					.select('id')
					.eq('user_id', user.id)
					.gte('session_date', sessionDateStart.toISOString())
					.lt('session_date', sessionDateEnd.toISOString())
					.order('session_date', { ascending: false })
					.limit(1);
				
				if (selectError) {
					console.warn('[SupabaseDB] Error checking for existing session:', selectError);
					// Continue to create new session
				} else if (existingSessions && existingSessions.length > 0) {
					// Use existing session
					console.log(`[SupabaseDB] Found existing session: ${existingSessions[0].id} for timestamp ${sessionTimestamp}`);
					return existingSessions[0].id;
				}
				
				// No existing session found, create a new one
				// Use the actual timestamp (not normalized to start of day) to ensure uniqueness
				const actualSessionDate = new Date(sessionTimestamp);
				
				// Create new session with actual timestamp
				const { data: newSession, error: insertError } = await supabase
					.from('therapy_sessions')
					.insert({
						user_id: user.id,
						session_date: actualSessionDate.toISOString(), // Use actual timestamp, not normalized
					})
					.select('id')
					.single();

				if (insertError) {
					console.error('[SupabaseDB] Error creating session:', insertError);
					return null;
				}

				console.log(`[SupabaseDB] Created new session: ${newSession.id}`);
				return newSession.id;
			} finally {
				// Remove from ongoing creation map
				ongoingSessionCreation.delete(sessionKey);
			}
		})();

		// Store the promise to prevent concurrent creation
		ongoingSessionCreation.set(sessionKey, creationPromise);

		return await creationPromise;
	} catch (error) {
		console.error('[SupabaseDB] Error in getOrCreateSession:', error);
		return null;
	}
}

/**
 * Save transcripts to Supabase for a session
 * Uses a merge approach: checks existing transcripts and only inserts new ones
 * This prevents duplicates even with concurrent saves
 */
export async function saveTranscripts(
	sessionId: string,
	transcripts: StoredTranscript[]
): Promise<boolean> {
	try {
		const supabase = createClient();
		
		console.log(`[SupabaseDB] Saving transcripts for session ${sessionId}, input count: ${transcripts.length}`);
		
		// Filter and prepare transcripts
		const validTranscripts = transcripts
			.filter(t => t.text && t.text.trim().length > 0)
			.map(t => ({
				session_id: sessionId,
				role: t.role === 'agent' ? 'assistant' : t.role,
				text: t.text.trim(),
				timestamp: t.timestamp,
			}))
			.sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp ascending

		if (validTranscripts.length === 0) {
			console.warn('[SupabaseDB] No valid transcripts to save');
			return true;
		}

		// Step 1: Get existing transcripts for this session to check for duplicates
		const { data: existingTranscripts, error: selectError } = await supabase
			.from('therapy_transcripts')
			.select('role, text, timestamp')
			.eq('session_id', sessionId);

		if (selectError) {
			console.error('[SupabaseDB] Error loading existing transcripts:', selectError);
			// Continue anyway - might be first save
		}

		// Step 2: Create a Set of existing transcript keys for fast lookup
		// Key format: `${timestamp}-${text}-${role}` to uniquely identify transcripts
		const existingKeys = new Set<string>();
		if (existingTranscripts) {
			for (const existing of existingTranscripts) {
				const key = `${existing.timestamp}-${existing.text.trim()}-${existing.role}`;
				existingKeys.add(key);
			}
		}

		// Step 3: Filter out transcripts that already exist
		const transcriptsToInsert = validTranscripts.filter(t => {
			const key = `${t.timestamp}-${t.text.trim()}-${t.role}`;
			return !existingKeys.has(key);
		});

		if (transcriptsToInsert.length === 0) {
			console.log(`[SupabaseDB] All ${validTranscripts.length} transcripts already exist for session ${sessionId}, skipping insert`);
			return true;
		}

		console.log(`[SupabaseDB] Inserting ${transcriptsToInsert.length} new transcripts (${validTranscripts.length - transcriptsToInsert.length} already exist)`);

		// Step 4: Insert only new transcripts
		// Handle race conditions gracefully - if duplicates are inserted concurrently, that's okay
		// The database unique constraint (if added via SQL migration) will prevent them
		const { data: insertedData, error: insertError } = await supabase
			.from('therapy_transcripts')
			.insert(transcriptsToInsert)
			.select(); // Select to ensure insert completes and get inserted rows

		if (insertError) {
			// If it's a unique constraint violation, that's okay - it means another save already inserted it
			// This handles race conditions where two saves both check and both try to insert
			if (insertError.code === '23505' || insertError.message?.includes('duplicate') || insertError.message?.includes('unique')) {
				console.log(`[SupabaseDB] Some transcripts were already inserted by concurrent save (race condition handled gracefully)`);
				return true; // Not an error - just a race condition that was handled
			}
			console.error('[SupabaseDB] Error inserting transcripts:', insertError);
			return false;
		}

		const insertedCount = insertedData?.length || transcriptsToInsert.length;
		console.log(`[SupabaseDB] ✓ Saved ${insertedCount} new transcripts for session ${sessionId} (total: ${(existingTranscripts?.length || 0) + insertedCount})`);
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
 * @param userId - Optional user ID. If not provided, will fetch from auth.
 */
export async function loadRecentTranscripts(userId?: string): Promise<StoredTranscript[]> {
	try {
		const supabase = createClient();
		let finalUserId = userId;
		
		// Only call getUser if userId not provided
		if (!finalUserId) {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return [];
			finalUserId = user.id;
		}

		// Get most recent session (don't use .single() to avoid 406 errors)
		const { data: recentSessions } = await supabase
			.from('therapy_sessions')
			.select('id')
			.eq('user_id', finalUserId)
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
 * Deletes existing summaries for this session first, then inserts the new one
 * This ensures only one summary per session (no duplicates)
 */
export async function saveSummary(
	sessionId: string,
	summary: SessionSummary
): Promise<boolean> {
	try {
		const supabase = createClient();
		
		// Delete existing summaries for this session to prevent duplicates
		await supabase
			.from('therapy_summaries')
			.delete()
			.eq('session_id', sessionId);

		// Insert the new summary
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

		console.log('[SupabaseDB] ✓ Saved session summary (one per session, duplicates removed)');
		return true;
	} catch (error) {
		console.error('[SupabaseDB] Error in saveSummary:', error);
		return false;
	}
}

/**
 * Save multiple session summaries to Supabase
 * Since we want one summary per session, this function now saves only the most recent summary
 * Deletes existing summaries first to prevent duplicates
 */
export async function saveSummaries(
	sessionId: string,
	summaries: SessionSummary[]
): Promise<boolean> {
	try {
		const supabase = createClient();

		if (summaries.length === 0) {
			return true;
		}

		// Delete existing summaries for this session to prevent duplicates
		await supabase
			.from('therapy_summaries')
			.delete()
			.eq('session_id', sessionId);

		// Only save the most recent summary for this session (prevent duplicates)
		// Sort by timestamp descending and take the first one
		const mostRecentSummary = summaries
			.sort((a, b) => b.timestamp - a.timestamp)[0];

		// Insert the most recent summary
		const { error } = await supabase
			.from('therapy_summaries')
			.insert({
				session_id: sessionId,
				timestamp: mostRecentSummary.timestamp,
				key_themes: mostRecentSummary.keyThemes || [],
				emotional_state: mostRecentSummary.emotionalState,
				open_issues: mostRecentSummary.openIssues || [],
				summary: mostRecentSummary.summary,
			});

		if (error) {
			console.error('[SupabaseDB] Error saving summaries:', error);
			return false;
		}

		console.log(`[SupabaseDB] ✓ Saved most recent summary for session (one per session, duplicates removed)`);
		return true;
	} catch (error) {
		console.error('[SupabaseDB] Error in saveSummaries:', error);
		return false;
	}
}

/**
 * Load all summaries for the current user (most recent first)
 * @param limit - Maximum number of summaries to return
 * @param userId - Optional user ID. If not provided, will fetch from auth.
 */
export async function loadSummaries(limit: number = 10, userId?: string): Promise<SessionSummary[]> {
	try {
		const supabase = createClient();
		let finalUserId = userId;
		
		// Only call getUser if userId not provided
		if (!finalUserId) {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return [];
			finalUserId = user.id;
		}

		// Get recent sessions
		const { data: sessions } = await supabase
			.from('therapy_sessions')
			.select('id')
			.eq('user_id', finalUserId)
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
			// Update existing - only update fields for the current type (pre or post)
			// This preserves existing data for the other type
			const updateFields: any = {
				session_id: sessionId,
				session_timestamp: sessionTimestamp,
			};
			
			if (type === 'pre') {
				updateFields.pre_session_rating = moodData.rating;
				updateFields.pre_session_notes = moodData.notes || null;
				updateFields.pre_session_timestamp = moodData.timestamp;
			} else {
				updateFields.post_session_rating = moodData.rating;
				updateFields.post_session_notes = moodData.notes || null;
				updateFields.post_session_timestamp = moodData.timestamp;
			}
			
			const { error } = await supabase
				.from('therapy_mood_data')
				.update(updateFields)
				.eq('id', existing.id);

			if (error) {
				console.error('[SupabaseDB] Error updating mood data:', error);
				return false;
			}
			
			console.log(`[SupabaseDB] ✓ Updated ${type}-session mood data for existing record (id: ${existing.id}, session: ${sessionId})`);
		} else {
			// Insert new - set null values for the other type to ensure proper structure
			if (type === 'pre') {
				moodDataUpdate.post_session_rating = null;
				moodDataUpdate.post_session_notes = null;
				moodDataUpdate.post_session_timestamp = null;
			} else {
				moodDataUpdate.pre_session_rating = null;
				moodDataUpdate.pre_session_notes = null;
				moodDataUpdate.pre_session_timestamp = null;
			}
			
			const { error } = await supabase
				.from('therapy_mood_data')
				.insert(moodDataUpdate);

			if (error) {
				console.error('[SupabaseDB] Error inserting mood data:', error);
				return false;
			}
			
			console.log(`[SupabaseDB] ✓ Inserted new ${type}-session mood data record (session: ${sessionId})`);
		}

		console.log(`[SupabaseDB] ✓ Saved ${type}-session mood data for session ${sessionId}`);
		return true;
	} catch (error) {
		console.error('[SupabaseDB] Error in saveMoodData:', error);
		return false;
	}
}

/**
 * Load all mood data for the current user
 * @param userId - Optional user ID. If not provided, will fetch from auth.
 */
export async function loadMoodData(userId?: string): Promise<SessionMoodData[]> {
	try {
		const supabase = createClient();
		let finalUserId = userId;
		
		// Only call getUser if userId not provided
		if (!finalUserId) {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return [];
			finalUserId = user.id;
		}

		const { data: sessions } = await supabase
			.from('therapy_sessions')
			.select('id')
			.eq('user_id', finalUserId)
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

/**
 * Journal Entry Types
 */
export interface JournalEntry {
	id: string;
	user_id: string;
	title: string;
	content: string;
	images: string[]; // Array of image URLs
	created_at: string;
	updated_at: string;
}

export interface CreateJournalEntryInput {
	title: string;
	content: string;
	images?: string[];
}

export interface UpdateJournalEntryInput {
	title?: string;
	content?: string;
	images?: string[];
}

/**
 * Create a new journal entry
 */
export async function createJournalEntry(
	input: CreateJournalEntryInput
): Promise<JournalEntry | null> {
	try {
		const supabase = createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			console.warn('[SupabaseDB] No authenticated user found for journal entry');
			return null;
		}

		const { data, error } = await supabase
			.from('journal_entries')
			.insert({
				user_id: user.id,
				title: input.title,
				content: input.content,
				images: input.images || [],
			})
			.select()
			.single();

		if (error) {
			console.error('[SupabaseDB] Error creating journal entry:', error);
			return null;
		}

		console.log('[SupabaseDB] ✓ Created journal entry:', data.id);
		return data;
	} catch (error) {
		console.error('[SupabaseDB] Error in createJournalEntry:', error);
		return null;
	}
}

/**
 * Update an existing journal entry
 */
export async function updateJournalEntry(
	id: string,
	input: UpdateJournalEntryInput
): Promise<JournalEntry | null> {
	try {
		const supabase = createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			console.warn('[SupabaseDB] No authenticated user found for journal update');
			return null;
		}

		const updateData: any = {
			updated_at: new Date().toISOString(),
		};

		if (input.title !== undefined) updateData.title = input.title;
		if (input.content !== undefined) updateData.content = input.content;
		if (input.images !== undefined) updateData.images = input.images;

		const { data, error } = await supabase
			.from('journal_entries')
			.update(updateData)
			.eq('id', id)
			.eq('user_id', user.id) // Ensure user owns this entry
			.select()
			.single();

		if (error) {
			console.error('[SupabaseDB] Error updating journal entry:', error);
			return null;
		}

		console.log('[SupabaseDB] ✓ Updated journal entry:', id);
		return data;
	} catch (error) {
		console.error('[SupabaseDB] Error in updateJournalEntry:', error);
		return null;
	}
}

/**
 * Delete a journal entry
 */
export async function deleteJournalEntry(id: string): Promise<boolean> {
	try {
		const supabase = createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			console.warn('[SupabaseDB] No authenticated user found for journal delete');
			return false;
		}

		const { error } = await supabase
			.from('journal_entries')
			.delete()
			.eq('id', id)
			.eq('user_id', user.id); // Ensure user owns this entry

		if (error) {
			console.error('[SupabaseDB] Error deleting journal entry:', error);
			return false;
		}

		console.log('[SupabaseDB] ✓ Deleted journal entry:', id);
		return true;
	} catch (error) {
		console.error('[SupabaseDB] Error in deleteJournalEntry:', error);
		return false;
	}
}

/**
 * Get all journal entries for the current user
 */
export async function getJournalEntries(
	limit?: number
): Promise<JournalEntry[]> {
	try {
		const supabase = createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return [];

		let query = supabase
			.from('journal_entries')
			.select('*')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false });

		if (limit) {
			query = query.limit(limit);
		}

		const { data, error } = await query;

		if (error) {
			console.error('[SupabaseDB] Error loading journal entries:', error);
			return [];
		}

		return data || [];
	} catch (error) {
		console.error('[SupabaseDB] Error in getJournalEntries:', error);
		return [];
	}
}

/**
 * Get a single journal entry by ID
 */
export async function getJournalEntry(id: string): Promise<JournalEntry | null> {
	try {
		const supabase = createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return null;

		const { data, error } = await supabase
			.from('journal_entries')
			.select('*')
			.eq('id', id)
			.eq('user_id', user.id) // Ensure user owns this entry
			.single();

		if (error) {
			console.error('[SupabaseDB] Error loading journal entry:', error);
			return null;
		}

		return data;
	} catch (error) {
		console.error('[SupabaseDB] Error in getJournalEntry:', error);
		return null;
	}
}

/**
 * Upload an image to Supabase Storage for journal entries
 */
export async function uploadJournalImage(
	file: File,
	entryId?: string
): Promise<string | null> {
	try {
		const supabase = createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			console.warn('[SupabaseDB] No authenticated user for image upload');
			return null;
		}

		// Generate unique filename
		const fileExt = file.name.split('.').pop();
		const fileName = entryId
			? `${user.id}/${entryId}/${Date.now()}.${fileExt}`
			: `${user.id}/temp/${Date.now()}.${fileExt}`;

		// Upload file
		const { error: uploadError } = await supabase.storage
			.from('journal-images')
			.upload(fileName, file, {
				cacheControl: '3600',
				upsert: false,
			});

		if (uploadError) {
			console.error('[SupabaseDB] Error uploading image:', uploadError);
			return null;
		}

		// Get public URL
		const {
			data: { publicUrl },
		} = supabase.storage.from('journal-images').getPublicUrl(fileName);

		console.log('[SupabaseDB] ✓ Uploaded journal image:', publicUrl);
		return publicUrl;
	} catch (error) {
		console.error('[SupabaseDB] Error in uploadJournalImage:', error);
		return null;
	}
}

/**
 * Delete an image from Supabase Storage
 */
export async function deleteJournalImage(imageUrl: string): Promise<boolean> {
	try {
		const supabase = createClient();
		// Extract file path from URL
		// URL format: https://[project].supabase.co/storage/v1/object/public/journal-images/[path]
		const urlParts = imageUrl.split('/journal-images/');
		if (urlParts.length < 2) {
			console.warn('[SupabaseDB] Invalid image URL format');
			return false;
		}

		const fileName = urlParts[1].split('?')[0]; // Remove query params

		const { error } = await supabase.storage
			.from('journal-images')
			.remove([fileName]);

		if (error) {
			console.error('[SupabaseDB] Error deleting image:', error);
			return false;
		}

		console.log('[SupabaseDB] ✓ Deleted journal image:', fileName);
		return true;
	} catch (error) {
		console.error('[SupabaseDB] Error in deleteJournalImage:', error);
		return false;
	}
}


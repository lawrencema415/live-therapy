'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Mic, MicOff } from 'lucide-react';
import type { Room } from 'livekit-client';
import { useRoomConnection } from '@/hooks/useRoomConnection';
import { useTranscripts } from '@/hooks/useTranscripts';
import { useCrisisDetection } from '@/hooks/useCrisisDetection';
import { JoinScreen } from '@/components/room/JoinScreen';
import { RoomHeader } from '@/components/room/RoomHeader';
import { TranscriptList } from '@/components/room/TranscriptList';
import {
	loadUserSession,
	convertStoredToMessages,
	loadSessionSummaries,
	saveSessionSummaries,
	type SessionSummary,
} from '@/utils/userSessionStorage';
import { saveSessionTranscripts } from '@/utils/saveSessionHelper';
import { isClient } from '@/utils/clientUtils';
import { useClientEffect } from '@/hooks/useClientEffect';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

function TherapyPageContent() {
	const { user, signOut } = useAuth();
	const router = useRouter();
	
	// Get userName from authenticated user's Google account (first name only)
	const getUserName = useCallback(() => {
		if (!user) return '';
		// Use first name (given_name) from Google account metadata
		// Google OAuth provides: given_name, full_name, name
		return (
			user.user_metadata?.given_name ||
			user.user_metadata?.full_name?.split(' ')[0] ||
			user.user_metadata?.name?.split(' ')[0] ||
			user.email?.split('@')[0] ||
			user.id
		);
	}, [user]);
	
	const [userName, setUserName] = useState(() => {
		if (!isClient()) return '';
		return getUserName();
	});
	
	// Update userName when user is available
	useEffect(() => {
		if (user) {
			const name = getUserName();
			setUserName(name);
		}
	}, [user, getUserName]);
	const [hasPreviousSession, setHasPreviousSession] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const hasSavedRef = useRef(false); // Track if transcripts have been saved for this session

	// Transcript management (initialize first)
	const transcriptHook = useTranscripts();

	// Store transcript hook methods in refs to avoid dependency issues
	const transcriptHookRef = useRef(transcriptHook);
	useEffect(() => {
		transcriptHookRef.current = transcriptHook;
	}, [transcriptHook]);

	// Crisis detection callback - memoized to avoid recreating
	// Using ref to avoid dependency on transcriptHook
	const handleCrisisDetected = useCallback(
		(
			systemMessage: Parameters<
				ReturnType<typeof useTranscripts>['addTranscript']
			>[0]
		) => {
			transcriptHookRef.current.addTranscript(systemMessage);
		},
		[]
	);

	const { checkForCrisis, reset: resetCrisisDetection } = useCrisisDetection({
		onCrisisDetected: handleCrisisDetected,
	});

	// Store room connection methods in refs
	const roomConnectionRef = useRef<{
		getRoom: () => Room | null;
		disconnect: () => Promise<void>;
	} | null>(null);

	// Callbacks for room connection - memoized to avoid recreating
	// Using refs to avoid dependency on transcriptHook
	const handleTranscriptsUpdate = useCallback(
		(
			transcripts: Parameters<
				ReturnType<typeof useTranscripts>['setTranscriptsFromStorage']
			>[0]
		) => {
			transcriptHookRef.current.setTranscriptsFromStorage(transcripts);
		},
		[]
	);

	const handleTranscriptReceived = useCallback(
		(
			message: Parameters<ReturnType<typeof useTranscripts>['addTranscript']>[0]
		) => {
			transcriptHookRef.current.addTranscript(message);
			// Check for crisis keywords in user messages
			checkForCrisis(message);
		},
		[checkForCrisis]
	);

	const handleSummariesReceived = useCallback(
		async (summaries: SessionSummary[]) => {
			// Save summaries when received from agent
			if (userName && summaries.length > 0) {
				// Keep only last 10 summaries
				const summariesToKeep = summaries.slice(-10);
				await saveSessionSummaries(userName, summariesToKeep);
				console.log(
					`[TherapyPage] Saved ${summariesToKeep.length} summaries from agent`
				);
			}
		},
		[userName]
	);

	// Get room reference for transcript storage
	const {
		isConnected,
		isConnecting,
		isAgentConnected,
		isWaitingForAgent,
		isMuted,
		connectToRoom,
		disconnect,
		toggleMute,
		getRoom,
	} = useRoomConnection({
		onTranscriptsUpdate: handleTranscriptsUpdate,
		onTranscriptReceived: handleTranscriptReceived,
		onSummariesReceived: handleSummariesReceived,
	});

	// Store room connection methods in ref
	useEffect(() => {
		roomConnectionRef.current = { getRoom, disconnect };
	}, [getRoom, disconnect]);

	// Update transcript hook when room changes and reset crisis detection
	useEffect(() => {
		if (isConnected) {
			const room = roomConnectionRef.current?.getRoom();
			if (room) {
				transcriptHookRef.current.setRoom(room);
			}
			resetCrisisDetection();
		} else {
			transcriptHookRef.current.setRoom(null);
		}
	}, [isConnected, resetCrisisDetection]);

	// Save transcripts when session ends (only for automatic disconnects, not user-initiated)
	// NOTE: This should NOT run if handleEndCall already saved (hasSavedRef.current will be true)
	useEffect(() => {
		if (!isConnected && userName && !isSaving && !hasSavedRef.current) {
			// Use a ref to track if this effect has already initiated a save
			// This prevents the timeout from running multiple times if the effect re-runs
			let saveInitiated = false;
			
			// Finalize all buffered messages first
			transcriptHookRef.current.finalizeAllBuffers();

			// Wait a bit to ensure all buffered messages are finalized
			const saveTimeout = setTimeout(() => {
				// Double-check: prevent duplicate saves if another save already started
				if (hasSavedRef.current || saveInitiated) {
					console.log(`[TherapyPage] Save already initiated, skipping duplicate save on disconnect`);
					return;
				}
				
				// Get deduplicated transcripts
				const allTranscripts = transcriptHookRef.current.getAllTranscripts();
				const finalTranscripts = allTranscripts.filter(t => t.isFinal);
				
				if (finalTranscripts.length === 0) {
					console.log(`[TherapyPage] No transcripts to save on disconnect`);
					return;
				}
				
				// Deduplicate one more time (safety check)
				const seen = new Map<string, typeof finalTranscripts[0]>();
				for (const transcript of finalTranscripts) {
					const key = `${transcript.speaker}-${transcript.text.trim()}-${transcript.timestamp}`;
					if (!seen.has(key)) {
						seen.set(key, transcript);
					}
				}
				const deduplicatedTranscripts = Array.from(seen.values()).sort((a, b) => a.timestamp - b.timestamp);
				
				// Mark as saved BEFORE calling saveSessionTranscripts to prevent race conditions
				hasSavedRef.current = true;
				saveInitiated = true;
				
				saveSessionTranscripts({
					userName,
					transcripts: deduplicatedTranscripts,
					onComplete: () => {
						setHasPreviousSession(true);
						transcriptHookRef.current.clearTranscripts();
					},
				});
			}, 2000);

			return () => {
				clearTimeout(saveTimeout);
			};
		}
	}, [isConnected, userName, isSaving]);

	// Store userName in ref for cleanup
	const userNameRef = useRef(userName);
	useEffect(() => {
		userNameRef.current = userName;
	}, [userName]);

	// Cleanup on unmount - save transcripts and disconnect (only if not already saved)
	// NOTE: This should NOT run if handleEndCall or disconnect useEffect already saved
	useEffect(() => {
		return () => {
			// Check immediately if already saved - don't even process transcripts if already saved
			if (hasSavedRef.current) {
				console.log('[TherapyPage] Already saved on unmount, skipping cleanup save');
				roomConnectionRef.current?.disconnect().catch(console.error);
				return;
			}
			
			transcriptHookRef.current.finalizeAllBuffers();
			
			// Get deduplicated transcripts
			const allTranscripts = transcriptHookRef.current.getAllTranscripts();
			const finalTranscripts = allTranscripts.filter(t => t.isFinal);
			
			if (finalTranscripts.length === 0) {
				roomConnectionRef.current?.disconnect().catch(console.error);
				return;
			}
			
			// Deduplicate one more time (safety check)
			const seen = new Map<string, typeof finalTranscripts[0]>();
			for (const transcript of finalTranscripts) {
				const key = `${transcript.speaker}-${transcript.text.trim()}-${transcript.timestamp}`;
				if (!seen.has(key)) {
					seen.set(key, transcript);
				}
			}
			const deduplicatedTranscripts = Array.from(seen.values()).sort((a, b) => a.timestamp - b.timestamp);
			
			const currentUserName = userNameRef.current;
			// Mark as saved BEFORE calling saveSessionTranscripts to prevent race conditions
			if (currentUserName && deduplicatedTranscripts.length > 0 && !hasSavedRef.current) {
				hasSavedRef.current = true; // Mark as saved to prevent duplicate saves
				// Note: This is fire-and-forget on unmount - we can't await it
				saveSessionTranscripts({
					userName: currentUserName,
					transcripts: deduplicatedTranscripts,
				}).catch(error => {
					console.error('[TherapyPage] Error saving on unmount:', error);
				});
			}
			roomConnectionRef.current?.disconnect().catch(console.error);
		};
	}, []);

	// Loading state - small delay for smooth transition
	useEffect(() => {
		const loadingTimeout = setTimeout(() => {
			setIsLoading(false);
		}, 300);

		return () => clearTimeout(loadingTimeout);
	}, []);


	// Check for previous session when userName changes or after disconnect
	// Use async check since loadUserSession is now async
	const [previousSessionValue, setPreviousSessionValue] = useState(false);

	// Check for previous session data asynchronously (with debounce to prevent multiple calls)
	useClientEffect(() => {
		if (!userName.trim() || !user?.id) {
			setPreviousSessionValue(false);
			setHasPreviousSession(false);
			return;
		}

		let isCancelled = false;
		const timeoutId = setTimeout(() => {
			// Pass userId to avoid duplicate getUser() calls in database functions
			loadUserSession(userName.trim(), user.id).then((session) => {
				if (isCancelled) return;
				
				const hasSession =
					session !== null &&
					(session.transcripts.length > 0 ||
						session.summaries.length > 0 ||
						(session.moodData && session.moodData.length > 0));
				setPreviousSessionValue(hasSession);
				setHasPreviousSession(hasSession);
			});
		}, 300); // Debounce by 300ms

		return () => {
			isCancelled = true;
			clearTimeout(timeoutId);
		};
	}, [userName, user?.id]);

	const handleJoin = useCallback(async () => {
		if (!userName.trim()) return;

		// Reset saved flag when starting a new session
		hasSavedRef.current = false;

		try {
			// No longer need to load transcripts/summaries here
			// Agent will fetch them securely from Supabase using authenticated user ID
			// Token route now handles authentication and includes user ID in token metadata
			await connectToRoom(userName.trim());

			// Load previous transcripts for UI display (from Supabase)
			// Pass userId to avoid duplicate getUser() calls
			const session = await loadUserSession(userName.trim(), user?.id);
			if (session?.transcripts && session.transcripts.length > 0) {
				const messages = convertStoredToMessages(session.transcripts);
				transcriptHookRef.current.setTranscriptsFromStorage(messages);
			}
		} catch (error) {
			console.error('Failed to join session:', error);
		}
	}, [userName, user?.id, connectToRoom]);

	const handleEndCall = useCallback(async () => {
		// Prevent duplicate saves
		if (hasSavedRef.current) {
			console.log('[TherapyPage] Transcripts already saved, skipping duplicate save');
			await roomConnectionRef.current?.disconnect();
			return;
		}

		// Set saving state to disable button and show "Saving..." text
		setIsSaving(true);

		// Mark as saved immediately to prevent other effects from saving
		hasSavedRef.current = true;

		// Finalize all buffered messages first
		transcriptHookRef.current.finalizeAllBuffers();

		// Wait a bit to ensure all buffered messages are finalized before saving
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Get transcripts - use getAllTranscripts to ensure we get deduplicated final messages
		const currentTranscripts = transcriptHookRef.current.getAllTranscripts();
		
		// Deduplicate one more time before saving (safety check)
		const seen = new Map<string, typeof currentTranscripts[0]>();
		for (const transcript of currentTranscripts) {
			if (!transcript.isFinal) continue; // Skip non-final
			const key = `${transcript.speaker}-${transcript.text.trim()}-${transcript.timestamp}`;
			if (!seen.has(key)) {
				seen.set(key, transcript);
			}
		}
		const deduplicatedTranscripts = Array.from(seen.values()).sort((a, b) => a.timestamp - b.timestamp);
		
		if (deduplicatedTranscripts.length !== currentTranscripts.filter(t => t.isFinal).length) {
			console.log(`[TherapyPage] Deduplicated transcripts before saving: ${currentTranscripts.filter(t => t.isFinal).length} -> ${deduplicatedTranscripts.length}`);
		}
		const currentUserName = userNameRef.current;
		if (currentUserName && deduplicatedTranscripts.length > 0) {
			await saveSessionTranscripts({
				userName: currentUserName,
				transcripts: deduplicatedTranscripts,
				onComplete: () => {
					setHasPreviousSession(true);
					setIsSaving(false);
				},
			});
		} else {
			setIsSaving(false);
		}
		transcriptHookRef.current.clearTranscripts();
		await roomConnectionRef.current?.disconnect();
	}, []);

	const handleLogout = useCallback(async () => {
		try {
			await signOut();
			router.push('/');
		} catch (error) {
			console.error('Failed to sign out:', error);
		}
	}, [signOut, router]);

	// Loading overlay
	if (isLoading) {
		return (
			<div className='fixed inset-0 bg-white z-50 flex items-center justify-center'>
				<div className='text-center'>
					<h1 className='text-4xl font-bold text-gray-800 mb-4 animate-pulse'>
						Live Therapy
					</h1>
					<div className='flex justify-center'>
						<div className='w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin'></div>
					</div>
				</div>
			</div>
		);
	}

	// Join screen
	if (!isConnected) {
		return (
			<JoinScreen
				userName={userName}
				onUserNameChange={setUserName}
				onJoin={handleJoin}
				isConnecting={isConnecting}
				isWaitingForAgent={isWaitingForAgent}
				hasPreviousSession={hasPreviousSession}
				onLogout={handleLogout}
			/>
		);
	}

	// Room view
	return (
		<div className='min-h-screen p-6'>
			<div className='max-w-4xl mx-auto'>
				<RoomHeader
					patientName={userName}
					onEndCall={handleEndCall}
					isAgentConnected={isAgentConnected}
					isSaving={isSaving}
					showDashboardLink={false}
				/>
				<div className='relative'>
					<TranscriptList transcripts={transcriptHook.transcripts} />
					{(() => {
						const lastMessage =
							transcriptHook.transcripts[transcriptHook.transcripts.length - 1];
						const isLastMessageFromAgent =
							lastMessage?.speaker?.startsWith('agent') ?? false;
						const shouldPulse =
							isMuted && isLastMessageFromAgent && !isWaitingForAgent;

						return (
							<button
								onClick={toggleMute}
								disabled={isWaitingForAgent}
								className={`absolute bottom-6 right-6 bg-white hover:bg-gray-100 disabled:bg-gray-50 disabled:cursor-not-allowed rounded-full p-3 shadow-lg transition-all duration-200 flex items-center justify-center z-10 ${
									shouldPulse
										? 'mic-pulse-alert border-red-500'
										: 'border-2 border-gray-300'
								}`}
								title={
									isWaitingForAgent
										? 'Microphone disabled - waiting for agent to connect'
										: isMuted
										? 'Unmute microphone'
										: 'Mute microphone'
								}
							>
								{isWaitingForAgent || isMuted ? (
									<MicOff className='h-6 w-6 text-red-600' />
								) : (
									<Mic className='h-6 w-6 text-gray-700' />
								)}
							</button>
						);
					})()}
				</div>
			</div>
		</div>
	);
}

export default function TherapyPage() {
	return (
		<ProtectedRoute>
			<TherapyPageContent />
		</ProtectedRoute>
	);
}

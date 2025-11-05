'use client';

import { useState, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useRoomConnection } from '@/hooks/useRoomConnection';
import { useTranscripts } from '@/hooks/useTranscripts';
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

const STORAGE_KEY_NAME = 'therapy_remembered_name';
const STORAGE_KEY_REMEMBER = 'therapy_remember_me';

export default function TherapyPage() {
	const [userName, setUserName] = useState('');
	const [rememberMe, setRememberMe] = useState(false);
	const [hasPreviousSession, setHasPreviousSession] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

	// Transcript management (initialize first)
	const transcriptHook = useTranscripts();

	// Get room reference for transcript storage
	const {
		isConnected,
		isConnecting,
		isWaitingForAgent,
		isMuted,
		connectToRoom,
		disconnect,
		toggleMute,
		getRoom,
	} = useRoomConnection({
		onTranscriptsUpdate: (transcripts) => {
			transcriptHook.setTranscriptsFromStorage(transcripts);
		},
		onTranscriptReceived: (message) => {
			transcriptHook.addTranscript(message);
		},
		onSummariesReceived: (summaries: SessionSummary[]) => {
			// Save summaries when received from agent
			if (userName && summaries.length > 0) {
				// Keep only last 10 summaries
				const summariesToKeep = summaries.slice(-10);
				saveSessionSummaries(userName, summariesToKeep);
				console.log(
					`[TherapyPage] Saved ${summariesToKeep.length} summaries from agent`
				);
			}
		},
	});

	// Update transcript hook when room changes
	useEffect(() => {
		transcriptHook.setRoom(getRoom());
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isConnected]);

	// Save transcripts when session ends (only for automatic disconnects, not user-initiated)
	useEffect(() => {
		if (!isConnected && userName && !isSaving) {
			// Finalize all buffered messages first
			transcriptHook.finalizeAllBuffers();

			// Wait a bit to ensure all buffered messages are finalized
			setTimeout(() => {
				// Simply use transcripts from state - sanitize and save
				const currentTranscripts = transcriptHook.transcripts;
				if (currentTranscripts.length > 0) {
					// Sanitize: include final messages AND agent messages (even if not final, they're usually complete)
					const sanitized = currentTranscripts
						.filter((t) => t.isFinal || t.speaker === 'agent') // Include agent messages even if not final
						.map((t) => ({
							role: t.speaker === 'agent' ? 'assistant' : t.speaker,
							text: t.text,
							timestamp: t.timestamp,
						}));

					console.log(
						`[TherapyPage] Saving ${
							sanitized.length
						} transcripts on disconnect (Agent: ${
							sanitized.filter((t) => t.role === 'assistant').length
						}, User: ${sanitized.filter((t) => t.role === 'user').length})`
					);

					// Load existing session data
					const existingSession = loadUserSession(userName);
					const existingSummaries = existingSession?.summaries || [];

					// Save to localStorage
					const sessionData = {
						userName: userName.trim(),
						transcripts: sanitized,
						summaries: existingSummaries,
						lastSessionDate: Date.now(),
					};

					const key = `therapy_user_${userName.trim().toLowerCase()}`;
					localStorage.setItem(key, JSON.stringify(sessionData));

					// Note: Don't set isSaving here - this useEffect is for automatic disconnects only
					// User-initiated saves are handled in handleEndCall

					// Generate and save summary via API (async, don't block)
					(async () => {
						try {
							const summaryResponse = await fetch('/api/summarize', {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
								},
								body: JSON.stringify({
									userName: userName.trim(),
									transcripts: sanitized,
								}),
							});

							if (summaryResponse.ok) {
								const data = await summaryResponse.json();
								const summary = data.summary;
								if (summary) {
									// Add new summary to existing summaries
									const updatedSummaries = [
										...existingSummaries,
										summary,
									].slice(-10); // Keep last 10

									// Update session data with new summaries
									const updatedSessionData = {
										...sessionData,
										summaries: updatedSummaries,
									};

									localStorage.setItem(key, JSON.stringify(updatedSessionData));
									console.log(
										`[TherapyPage] ✓ Generated and saved summary for ${userName}`
									);
								}
							} else {
								const errorText = await summaryResponse.text();
								console.warn(
									'[TherapyPage] Failed to generate summary:',
									errorText
								);
							}
						} catch (error) {
							console.error('[TherapyPage] Error generating summary:', error);
						}
					})();

					transcriptHook.clearTranscripts();
				} else {
					console.log(`[TherapyPage] No transcripts to save on disconnect`);
				}
			}, 2000); // Wait 2 seconds to allow merge buffer to finalize
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isConnected, userName, isSaving]);

	// Cleanup on unmount - save transcripts properly
	useEffect(() => {
		return () => {
			// Finalize buffers first
			transcriptHook.finalizeAllBuffers();

			// Simply use transcripts from state - sanitize and save
			const currentTranscripts = transcriptHook.transcripts;

			if (userName && currentTranscripts.length > 0) {
				// Sanitize: include final messages AND agent messages (even if not final, they're usually complete)
				const sanitized = currentTranscripts
					.filter((t) => t.isFinal || t.speaker === 'agent') // Include agent messages even if not final
					.map((t) => ({
						role: t.speaker === 'agent' ? 'assistant' : t.speaker,
						text: t.text,
						timestamp: t.timestamp,
					}));

				// Log what we're saving
				const agentCount = sanitized.filter(
					(t) => t.role === 'assistant'
				).length;
				const userCount = sanitized.filter((t) => t.role === 'user').length;
				console.log(
					`[TherapyPage] Unmount - Saving ${sanitized.length} transcripts (Agent: ${agentCount}, User: ${userCount})`
				);

				// Load existing session data
				const existingSession = loadUserSession(userName);
				const existingSummaries = existingSession?.summaries || [];

				// Save to localStorage
				const sessionData = {
					userName: userName.trim(),
					transcripts: sanitized,
					summaries: existingSummaries,
					lastSessionDate: Date.now(),
				};

				const key = `therapy_user_${userName.trim().toLowerCase()}`;
				localStorage.setItem(key, JSON.stringify(sessionData));

				// Generate and save summary via API (async, don't block unmount)
				(async () => {
					try {
						const summaryResponse = await fetch('/api/summarize', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								userName: userName.trim(),
								transcripts: sanitized,
							}),
						});

						if (summaryResponse.ok) {
							const data = await summaryResponse.json();
							const summary = data.summary;
							if (summary) {
								// Add new summary to existing summaries
								const updatedSummaries = [...existingSummaries, summary].slice(
									-10
								); // Keep last 10

								// Update session data with new summaries
								const updatedSessionData = {
									...sessionData,
									summaries: updatedSummaries,
								};

								localStorage.setItem(key, JSON.stringify(updatedSessionData));
								console.log(
									`[TherapyPage] ✓ Generated and saved summary for ${userName}`
								);
							}
						} else {
							const errorText = await summaryResponse.text();
							console.warn(
								'[TherapyPage] Failed to generate summary:',
								errorText
							);
						}
					} catch (error) {
						console.error('[TherapyPage] Error generating summary:', error);
					}
				})();
			} else if (userName) {
				console.warn(
					`[TherapyPage] No transcripts to save on unmount (userName: ${userName})`
				);
			}
			disconnect().catch(console.error);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userName]);

	// Load remembered name from localStorage on mount
	useEffect(() => {
		const rememberedName = localStorage.getItem(STORAGE_KEY_NAME);
		const shouldRemember =
			localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';

		if (shouldRemember && rememberedName) {
			setUserName(rememberedName);
			setRememberMe(true);
		}

		// Small delay for smooth transition
		setTimeout(() => {
			setIsLoading(false);
		}, 300);
	}, []);

	// Save name to localStorage when userName changes and rememberMe is true
	useEffect(() => {
		if (rememberMe && userName.trim()) {
			localStorage.setItem(STORAGE_KEY_NAME, userName.trim());
			localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');
		} else if (!rememberMe) {
			localStorage.removeItem(STORAGE_KEY_NAME);
			localStorage.removeItem(STORAGE_KEY_REMEMBER);
		}
	}, [userName, rememberMe]);

	// Check for previous session when userName changes
	useEffect(() => {
		if (userName.trim()) {
			const session = loadUserSession(userName.trim());
			setHasPreviousSession(session !== null && session.transcripts.length > 0);
		} else {
			setHasPreviousSession(false);
		}
	}, [userName]);

	const handleJoin = async () => {
		if (!userName.trim()) return;

		try {
			// Load previous session data (transcripts + summaries)
			const session = loadUserSession(userName.trim());
			const previousTranscripts = session?.transcripts || [];
			const allSummaries =
				session?.summaries || loadSessionSummaries(userName.trim());

			// Only use the most recent summary to avoid URL size limits (431 errors)
			const previousSummaries =
				allSummaries.length > 0 ? [allSummaries[allSummaries.length - 1]] : [];

			// Get token with summaries included
			const tokenParams = new URLSearchParams({
				identity: userName.trim(),
				userName: userName.trim(),
			});

			if (previousTranscripts.length > 0) {
				tokenParams.append(
					'previousTranscripts',
					JSON.stringify(previousTranscripts)
				);
			}

			if (previousSummaries.length > 0) {
				tokenParams.append(
					'previousSummaries',
					JSON.stringify(previousSummaries)
				);
			}

			// Token is handled internally by connectToRoom
			// Connect with user name, previous transcripts, and summaries (most recent only)
			await connectToRoom(
				userName.trim(),
				previousTranscripts,
				previousSummaries
			);

			// If there are previous transcripts, load them into the UI
			if (previousTranscripts.length > 0) {
				const messages = convertStoredToMessages(previousTranscripts);
				transcriptHook.setTranscriptsFromStorage(messages);
			}
		} catch (error) {
			console.error('Failed to join session:', error);
		}
	};

	const handleEndCall = async () => {
		// Set saving state to disable button and show "Saving..." text
		setIsSaving(true);

		// Finalize all buffered messages first
		transcriptHook.finalizeAllBuffers();

		// Wait a bit to ensure all buffered messages are finalized before saving
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Simply use transcripts from state - sanitize and save
		const currentTranscripts = transcriptHook.transcripts;
		if (userName && currentTranscripts.length > 0) {
			// Sanitize: include final messages AND agent messages (even if not final, they're usually complete)
			const sanitized = currentTranscripts
				.filter((t) => t.isFinal || t.speaker === 'agent') // Include agent messages even if not final
				.map((t) => ({
					role: t.speaker === 'agent' ? 'assistant' : t.speaker,
					text: t.text,
					timestamp: t.timestamp,
				}));

			console.log(
				`[TherapyPage] Saving ${
					sanitized.length
				} transcripts on end call (Agent: ${
					sanitized.filter((t) => t.role === 'assistant').length
				}, User: ${sanitized.filter((t) => t.role === 'user').length})`
			);

			// Load existing session data
			const existingSession = loadUserSession(userName);
			const existingSummaries = existingSession?.summaries || [];

			// Save to localStorage
			const sessionData = {
				userName: userName.trim(),
				transcripts: sanitized,
				summaries: existingSummaries,
				lastSessionDate: Date.now(),
			};

			const key = `therapy_user_${userName.trim().toLowerCase()}`;
			localStorage.setItem(key, JSON.stringify(sessionData));

			// Mark saving as complete (localStorage save is done, summary is async)
			setIsSaving(false);

			// Generate and save summary via API (async, don't block)
			(async () => {
				try {
					const summaryResponse = await fetch('/api/summarize', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							userName: userName.trim(),
							transcripts: sanitized,
						}),
					});

					if (summaryResponse.ok) {
						const data = await summaryResponse.json();
						const summary = data.summary;
						if (summary) {
							// Add new summary to existing summaries
							const updatedSummaries = [...existingSummaries, summary].slice(
								-10
							); // Keep last 10

							// Update session data with new summaries
							const updatedSessionData = {
								...sessionData,
								summaries: updatedSummaries,
							};

							localStorage.setItem(key, JSON.stringify(updatedSessionData));
							console.log(
								`[TherapyPage] ✓ Generated and saved summary for ${userName}`
							);
						}
					} else {
						const errorText = await summaryResponse.text();
						console.warn(
							'[TherapyPage] Failed to generate summary:',
							errorText
						);
					}
				} catch (error) {
					console.error('[TherapyPage] Error generating summary:', error);
				}
			})();
		}
		transcriptHook.clearTranscripts();
		await disconnect();
	};

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
				hasPreviousSession={hasPreviousSession}
				rememberMe={rememberMe}
				onRememberMeChange={setRememberMe}
			/>
		);
	}

	// Room view
	return (
		<div className='min-h-screen p-6'>
			<div className='max-w-4xl mx-auto'>
				<RoomHeader
					roomName={userName}
					onEndCall={handleEndCall}
					isSaving={isSaving}
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

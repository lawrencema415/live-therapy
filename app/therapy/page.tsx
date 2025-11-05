'use client';

import { useState, useEffect } from 'react';
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

export default function TherapyPage() {
	const [userName, setUserName] = useState('');
	const [hasPreviousSession, setHasPreviousSession] = useState(false);

	// Transcript management (initialize first)
	const transcriptHook = useTranscripts();

	// Get room reference for transcript storage
	const {
		isConnected,
		isConnecting,
		isAgentConnected,
		isWaitingForAgent,
		connectToRoom,
		disconnect,
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

	// Save transcripts when session ends
	useEffect(() => {
		if (!isConnected && userName) {
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
	}, [isConnected, userName]);

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

				// Save transcripts to localStorage first
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
			}
			disconnect().catch(console.error);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userName]);

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
			/>
		);
	}

	// Room view
	return (
		<div className='min-h-screen bg-gray-50 p-6'>
			<div className='max-w-4xl mx-auto'>
				<RoomHeader
					roomName={userName}
					onEndCall={handleEndCall}
					isAgentConnected={isAgentConnected}
				/>
				<TranscriptList transcripts={transcriptHook.transcripts} />
			</div>
		</div>
	);
}

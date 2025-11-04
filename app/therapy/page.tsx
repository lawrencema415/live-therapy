'use client';

import { useState, useEffect } from 'react';
import { useRoomConnection } from '@/hooks/useRoomConnection';
import { useTranscripts } from '@/hooks/useTranscripts';
import { JoinScreen } from '@/components/room/JoinScreen';
import { RoomHeader } from '@/components/room/RoomHeader';
import { TranscriptList } from '@/components/room/TranscriptList';
import {
	loadUserSession,
	saveUserSession,
	convertStoredToMessages,
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
	});

	// Update transcript hook when room changes
	useEffect(() => {
		transcriptHook.setRoom(getRoom());
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isConnected]);

	// Save transcripts when session ends
	useEffect(() => {
		if (!isConnected && userName && transcriptHook.transcripts.length > 0) {
			saveUserSession(userName, transcriptHook.transcripts);
			transcriptHook.clearTranscripts();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isConnected, userName]);

	// Cleanup on unmount - save transcripts
	useEffect(() => {
		return () => {
			if (userName && transcriptHook.transcripts.length > 0) {
				saveUserSession(userName, transcriptHook.transcripts);
			}
			disconnect().catch(console.error);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

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
			// Load previous session data
			const session = loadUserSession(userName.trim());
			const previousTranscripts = session?.transcripts || [];

			// Connect with user name and previous transcripts
			await connectToRoom(userName.trim(), previousTranscripts);

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
		// Save transcripts before disconnecting
		if (userName && transcriptHook.transcripts.length > 0) {
			saveUserSession(userName, transcriptHook.transcripts);
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


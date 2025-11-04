'use client';

import { useState, useEffect, use } from 'react';
import { useRoomConnection } from '@/hooks/useRoomConnection';
import { useTranscripts } from '@/hooks/useTranscripts';
import { JoinScreen } from '@/components/room/JoinScreen';
import { RoomHeader } from '@/components/room/RoomHeader';
import { TranscriptList } from '@/components/room/TranscriptList';

export default function RoomPage({
	params,
}: {
	params: Promise<{ room: string }>;
}) {
	const resolvedParams = use(params);
	const [roomName, setRoomName] = useState(resolvedParams.room || 'voice-room');

	// Transcript management (initialize first)
	const transcriptHook = useTranscripts();

	// Get room reference for transcript storage
	const { isConnected, isConnecting, connectToRoom, disconnect, getRoom } =
		useRoomConnection({
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

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			disconnect().catch(console.error);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleJoin = async () => {
		try {
			await connectToRoom(roomName);
		} catch (error) {
			// Error handling is done in the hook
			console.error('Failed to join room:', error);
		}
	};

	const handleEndCall = async () => {
		transcriptHook.clearTranscripts();
		await disconnect();
	};

	// Join screen
	if (!isConnected) {
		return (
			<JoinScreen
				roomName={roomName}
				onRoomNameChange={setRoomName}
				onJoin={handleJoin}
				isConnecting={isConnecting}
			/>
		);
	}

	// Room view
	return (
		<div className='min-h-screen bg-gray-50 p-6'>
			<div className='max-w-4xl mx-auto'>
				<RoomHeader roomName={roomName} onEndCall={handleEndCall} />
				<TranscriptList transcripts={transcriptHook.transcripts} />
			</div>
		</div>
	);
}

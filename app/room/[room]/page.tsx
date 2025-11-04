'use client';

import { useEffect, useState } from 'react';
import {
	Room,
	RoomEvent,
	createLocalAudioTrack,
} from 'livekit-client';

export default function RoomPage({ params }: { params: { room: string } }) {
	const [room, setRoom] = useState<Room | null>(null);
	const [transcripts, setTranscripts] = useState<string[]>([]);

	useEffect(() => {
		let currentRoom: Room | null = null;

		const connectToRoom = async () => {
			const roomName = params.room || 'voice-room';
			const identity = 'user-' + Math.floor(Math.random() * 1000);

			const res = await fetch(
				`/api/token?identity=${identity}&roomName=${roomName}`
			);
			const { token } = await res.json();

			currentRoom = new Room();
			await currentRoom.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token);

			// Publish microphone audio
			const mic = await createLocalAudioTrack();
			await currentRoom.localParticipant.publishTrack(mic);

			// Listen to remote audio tracks (agent voice)
			currentRoom.on(RoomEvent.TrackSubscribed, (track) => {
				if (track.kind === 'audio') {
					const el = track.attach();
					document.body.appendChild(el);
				}
			});

			// Handle transcription (if backend publishes via DataTrack)
			currentRoom.on(RoomEvent.DataReceived, (payload, participant) => {
				try {
					const msg = JSON.parse(new TextDecoder().decode(payload));
					if (msg.type === 'transcript') {
						const speaker = participant?.identity || msg.speaker || 'unknown';
						const text = msg.transcript || msg.text || '';
						setTranscripts((prev) => [...prev, `${speaker}: ${text}`]);
					}
				} catch (err) {
					console.error('Invalid data message:', err);
				}
			});

			setRoom(currentRoom);
		};

		connectToRoom();

		return () => {
			if (currentRoom) {
				currentRoom.disconnect();
			}
		};
	}, [params.room]);

	return (
		<div className='p-6 space-y-4'>
			<h1 className='text-xl font-semibold'>LiveKit Voice Room: {params.room}</h1>
			<div className='bg-gray-100 p-4 rounded'>
				<h2 className='font-medium'>Transcripts:</h2>
				{transcripts.length === 0 ? (
					<p className='text-gray-500'>Waiting for transcript...</p>
				) : (
					transcripts.map((t, i) => <p key={i}>{t}</p>)
				)}
			</div>
		</div>
	);
}


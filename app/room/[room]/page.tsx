'use client';

import { useEffect, useState, useRef, use } from 'react';
import { Room, RoomEvent, createLocalAudioTrack } from 'livekit-client';

// Type definitions for text stream handler (may not be exported from livekit-client)
interface TextStreamReader {
	info: {
		id: string;
		attributes: Record<string, string>;
	};
	readAll(): Promise<string>;
}

interface ParticipantIdentity {
	identity: string;
}

// Note: registerTextStreamHandler should be available in livekit-client v2+

interface TranscriptMessage {
	id: string;
	speaker: string;
	text: string;
	isFinal: boolean;
	timestamp: number;
}

export default function RoomPage({
	params,
}: {
	params: Promise<{ room: string }>;
}) {
	const resolvedParams = use(params);
	const [isConnected, setIsConnected] = useState(false);
	const [roomName, setRoomName] = useState(resolvedParams.room || 'voice-room');
	const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
	const [isConnecting, setIsConnecting] = useState(false);
	const roomRef = useRef<Room | null>(null);
	const interimMessagesRef = useRef<Map<string, TranscriptMessage>>(new Map());

	const connectToRoom = async () => {
		if (!roomName.trim() || isConnecting) {
			return;
		}

		setIsConnecting(true);
		try {
			const identity = 'user-' + Math.floor(Math.random() * 1000);

			// Get token from API
			const res = await fetch(
				`/api/token?identity=${identity}&roomName=${roomName.trim()}`
			);

			if (!res.ok) {
				const errorData = await res
					.json()
					.catch(() => ({ error: 'Unknown error' }));
				throw new Error(
					`Token generation failed: ${errorData.error || res.statusText}`
				);
			}

			const { token } = await res.json();

			if (!token) {
				throw new Error('No token received from server');
			}

			// Get LiveKit URL - check both env var and window location
			const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
			if (!livekitUrl) {
				throw new Error(
					'NEXT_PUBLIC_LIVEKIT_URL is not set. Please check your environment variables.'
				);
			}

			console.log('Connecting to LiveKit:', livekitUrl);
			console.log('Room name:', roomName.trim());

			const currentRoom = new Room();
			roomRef.current = currentRoom;

			await currentRoom.connect(livekitUrl, token);
			console.log('Connected to room:', {
				name: currentRoom.name,
				localParticipant: currentRoom.localParticipant.identity,
				numParticipants: currentRoom.numParticipants,
			});

			// Publish microphone audio
			const mic = await createLocalAudioTrack();
			await currentRoom.localParticipant.publishTrack(mic);
			console.log('Microphone track published');

			// Listen to remote audio tracks (agent voice)
			currentRoom.on(RoomEvent.TrackSubscribed, (track) => {
				if (track.kind === 'audio') {
					const el = track.attach();
					document.body.appendChild(el);
				}
			});

			// Register text stream handler for transcriptions
			// AgentSession automatically publishes transcriptions on 'lk.transcription' topic
			console.log('Registering text stream handler for transcriptions...');

			// Try to use registerTextStreamHandler (available in livekit-client v2+)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const hasTextStreamHandler =
				typeof (currentRoom as any).registerTextStreamHandler === 'function';

			if (hasTextStreamHandler) {
				console.log('Using registerTextStreamHandler method...');
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(currentRoom as any).registerTextStreamHandler(
					'lk.transcription',
					async (
						reader: TextStreamReader,
						participantInfo: ParticipantIdentity | string
					) => {
						console.log('Text stream received!', {
							participant:
								typeof participantInfo === 'string'
									? participantInfo
									: participantInfo?.identity,
							info: reader.info,
						});

						const info = reader.info;
						const isFinal =
							info.attributes['lk.transcription_final'] === 'true';
						const segmentId = info.attributes['lk.segment_id'] || info.id;
						const speaker =
							typeof participantInfo === 'string'
								? participantInfo
								: participantInfo?.identity || 'unknown';

						try {
							// Read the entire text from the stream
							const text = await reader.readAll();
							console.log('Transcription text received:', {
								text,
								isFinal,
								segmentId,
								speaker,
							});

							if (!text.trim()) {
								console.log('Empty text, skipping');
								return;
							}

							// Create message object
							const message: TranscriptMessage = {
								id: segmentId,
								speaker,
								text: text.trim(),
								isFinal,
								timestamp: Date.now(),
							};

							if (isFinal) {
								console.log('Final transcript:', message);
								// Final transcript - replace any interim message and add as final
								setTranscripts((prev) => {
									// Remove any interim messages with the same segment ID
									const filtered = prev.filter(
										(msg) => msg.id !== segmentId || msg.isFinal
									);

									// Add the final message
									return [...filtered, message];
								});

								// Remove from interim tracking
								interimMessagesRef.current.delete(segmentId);
							} else {
								console.log('Interim transcript:', message);
								// Interim transcript - update in place or add if new
								setTranscripts((prev) => {
									const existingIndex = prev.findIndex(
										(msg) => msg.id !== segmentId && !msg.isFinal
									);

									if (existingIndex >= 0) {
										// Update existing interim message
										const updated = [...prev];
										updated[existingIndex] = message;
										return updated;
									} else {
										// Add new interim message
										return [...prev, message];
									}
								});

								// Track interim message
								interimMessagesRef.current.set(segmentId, message);
							}
						} catch (err) {
							console.error('Error reading transcription stream:', err);
						}
					}
				);
				console.log('Text stream handler registered successfully');
			} else {
				console.warn(
					'registerTextStreamHandler not available. Using DataReceived event as fallback for transcriptions.'
				);
				// Fallback: Listen to DataReceived events (for backward compatibility)
				// Note: This is a fallback. Text streams are the preferred method.
				currentRoom.on(RoomEvent.DataReceived, (payload, participant) => {
					if (!participant) return;

					try {
						const decoder = new TextDecoder();
						const text = decoder.decode(payload);
						const data = JSON.parse(text);

						if (data.type === 'transcript') {
							console.log('Received transcript via DataTrack:', data);
							const message: TranscriptMessage = {
								id: `data-${Date.now()}-${Math.random()}`,
								speaker: participant.identity || 'unknown',
								text: data.text,
								isFinal: true,
								timestamp: Date.now(),
							};

							setTranscripts((prev) => [...prev, message]);
						}
					} catch (err) {
						// Not JSON or not a transcript, ignore
						console.debug('DataReceived event (not transcript):', err);
					}
				});
				console.log('DataReceived event listener registered as fallback');
			}

			setIsConnected(true);
		} catch (error) {
			console.error('Error connecting to room:', error);
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error occurred';
			alert(`Failed to connect to room: ${errorMessage}`);
		} finally {
			setIsConnecting(false);
		}
	};

	const endCall = async () => {
		if (roomRef.current) {
			await roomRef.current.disconnect();
			roomRef.current = null;
		}
		setIsConnected(false);
		setTranscripts([]);
		interimMessagesRef.current.clear();
	};

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (roomRef.current) {
				roomRef.current.disconnect();
			}
		};
	}, []);

	// Join screen
	if (!isConnected) {
		return (
			<div className='min-h-screen bg-gray-50 flex items-center justify-center p-6'>
				<div className='bg-white rounded-lg shadow-lg p-8 max-w-md w-full'>
					<h1 className='text-3xl font-bold text-gray-800 mb-2 text-center'>
						LiveKit Voice Room
					</h1>
					<p className='text-gray-600 text-center mb-8'>
						Join a voice conversation with AI
					</p>

					<div className='space-y-4'>
						<div>
							<label
								htmlFor='roomName'
								className='block text-sm font-medium text-gray-700 mb-2'
							>
								Room Name
							</label>
							<input
								id='roomName'
								type='text'
								value={roomName}
								onChange={(e) => setRoomName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !isConnecting) {
										connectToRoom();
									}
								}}
								placeholder='Enter room name'
								className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
								disabled={isConnecting}
							/>
						</div>

						<button
							onClick={connectToRoom}
							disabled={isConnecting || !roomName.trim()}
							className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center'
						>
							{isConnecting ? (
								<>
									<svg
										className='animate-spin -ml-1 mr-3 h-5 w-5 text-white'
										xmlns='http://www.w3.org/2000/svg'
										fill='none'
										viewBox='0 0 24 24'
									>
										<circle
											className='opacity-25'
											cx='12'
											cy='12'
											r='10'
											stroke='currentColor'
											strokeWidth='4'
										></circle>
										<path
											className='opacity-75'
											fill='currentColor'
											d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
										></path>
									</svg>
									Connecting...
								</>
							) : (
								'Join Room'
							)}
						</button>
					</div>
				</div>
			</div>
		);
	}

	// Room view
	return (
		<div className='min-h-screen bg-gray-50 p-6'>
			<div className='max-w-4xl mx-auto'>
				<div className='bg-white rounded-lg shadow-lg p-6 mb-6 flex items-center justify-between'>
					<div>
						<h1 className='text-2xl font-bold text-gray-800 mb-2'>
							LiveKit Voice Room
						</h1>
						<p className='text-gray-600'>Room: {roomName}</p>
					</div>
					<button
						onClick={endCall}
						className='bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200 flex items-center gap-2'
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							className='h-5 w-5'
							viewBox='0 0 20 20'
							fill='currentColor'
						>
							<path
								fillRule='evenodd'
								d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z'
								clipRule='evenodd'
							/>
						</svg>
						End Call
					</button>
				</div>

				<div className='bg-white rounded-lg shadow-lg p-6'>
					<h2 className='text-lg font-semibold text-gray-800 mb-4'>
						Conversation
					</h2>

					<div className='space-y-3 min-h-[400px] max-h-[600px] overflow-y-auto'>
						{transcripts.length === 0 ? (
							<div className='text-center py-12 text-gray-400'>
								<p>Waiting for conversation to start...</p>
							</div>
						) : (
							transcripts.map((msg) => {
								const isAgent = msg.speaker.startsWith('agent');
								const displayName = isAgent ? 'Agent' : 'You';

								return (
									<div
										key={`${msg.id}-${msg.timestamp}`}
										className={`flex ${
											isAgent ? 'justify-start' : 'justify-end'
										}`}
									>
										<div
											className={`max-w-[75%] rounded-lg px-4 py-2 ${
												isAgent
													? 'bg-blue-100 text-blue-900'
													: 'bg-green-100 text-green-900'
											}`}
										>
											<div className='text-xs font-semibold mb-1 opacity-70'>
												{displayName}
											</div>
											<div
												className={`text-sm ${
													msg.isFinal
														? 'font-normal'
														: 'font-light italic opacity-80'
												}`}
											>
												{msg.text}
												{!msg.isFinal && (
													<span className='inline-block w-2 h-4 ml-1 bg-current animate-pulse' />
												)}
											</div>
										</div>
									</div>
								);
							})
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

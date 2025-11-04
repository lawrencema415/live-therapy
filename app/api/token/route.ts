import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

interface StoredTranscript {
	role: string;
	text: string;
	timestamp: number;
}

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const identity = searchParams.get('identity');
	const userName = searchParams.get('userName');
	const previousTranscriptsJson = searchParams.get('previousTranscripts');

	if (!identity || !userName) {
		return NextResponse.json(
			{ error: 'Missing identity or userName' },
			{ status: 400 }
		);
	}

	// Parse previous transcripts if provided
	let previousTranscripts: StoredTranscript[] = [];
	if (previousTranscriptsJson) {
		try {
			previousTranscripts = JSON.parse(previousTranscriptsJson);
		} catch (error) {
			console.error('Error parsing previous transcripts:', error);
		}
	}

	// Generate unique room name per session to ensure fresh agent jobs
	// Each connection gets a new room, which triggers a new agent job
	// We still use userName as identity for transcript tracking
	const sessionId = Date.now();
	const roomName = `therapy-${userName.toLowerCase().trim()}-${sessionId}`;
	
	console.log(`[Token] Generated room name: ${roomName} for user: ${userName}`);

	const at = new AccessToken(
		process.env.LIVEKIT_API_KEY!,
		process.env.LIVEKIT_API_SECRET!,
		{ identity }
	);

	at.addGrant({ roomJoin: true, room: roomName });

	// Add metadata to token for agent to access
	at.metadata = JSON.stringify({
		userName: userName.trim(),
		previousTranscripts: previousTranscripts,
	});

	const token = await at.toJwt();
	return NextResponse.json({ token });
}


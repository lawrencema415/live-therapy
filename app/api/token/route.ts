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

	// Use a consistent room name for therapy sessions (single room per user)
	// Or use userName as room name for consistency
	const roomName = `therapy-${userName.toLowerCase().trim()}`;

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


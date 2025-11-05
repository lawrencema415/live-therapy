import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

interface StoredTranscript {
	role: string;
	text: string;
	timestamp: number;
}

interface SessionSummary {
	timestamp: number;
	keyThemes: string[];
	emotionalState: string;
	openIssues: string[];
	summary: string;
}

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const identity = searchParams.get('identity');
	const userName = searchParams.get('userName');
	const previousTranscriptsJson = searchParams.get('previousTranscripts');
	const previousSummariesJson = searchParams.get('previousSummaries');

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

	// Parse previous summaries if provided
	let previousSummaries: SessionSummary[] = [];
	if (previousSummariesJson) {
		try {
			previousSummaries = JSON.parse(previousSummariesJson);
		} catch (error) {
			console.error('Error parsing previous summaries:', error);
		}
	}

	// Generate random room name per session (not based on userName)
	// Each connection gets a new room, which triggers a new agent job
	// We use userName as identity for transcript tracking, but room name is random
	const sessionId = Date.now();
	const randomId = Math.random().toString(36).substring(2, 9);
	const roomName = `therapy-session-${sessionId}-${randomId}`;
	
	console.log(`[Token] Generated room name: ${roomName} for user: ${userName}`);
	console.log(`[Token] Including ${previousTranscripts.length} transcripts and ${previousSummaries.length} summaries in token metadata`);

	const at = new AccessToken(
		process.env.LIVEKIT_API_KEY!,
		process.env.LIVEKIT_API_SECRET!,
		{ identity }
	);

	at.addGrant({ roomJoin: true, room: roomName });

	// Add metadata to token for agent to access (including summaries)
	at.metadata = JSON.stringify({
		userName: userName.trim(),
		previousTranscripts: previousTranscripts,
		previousSummaries: previousSummaries,
	});

	const token = await at.toJwt();
	return NextResponse.json({ token });
}


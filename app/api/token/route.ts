import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
	try {
		// Get authenticated user from Supabase
		const supabase = await createClient();
		const { data: { user }, error: authError } = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json(
				{ error: 'Unauthorized - Please log in' },
				{ status: 401 }
			);
		}

		// Get userName from user metadata (first name)
		const userName =
			user.user_metadata?.given_name ||
			user.user_metadata?.full_name?.split(' ')[0] ||
			user.user_metadata?.name?.split(' ')[0] ||
			user.email?.split('@')[0] ||
			user.id;

		// Use user ID as identity for LiveKit (more secure than userName)
		const identity = user.id;

		// Generate random room name per session
		const sessionId = Date.now();
		const randomId = Math.random().toString(36).substring(2, 9);
		const roomName = `therapy-session-${sessionId}-${randomId}`;

		console.log(`[Token] Generated room name: ${roomName} for user: ${userName} (ID: ${user.id})`);
		console.log(`[Token] Agent will fetch transcripts/summaries from Supabase using user ID`);

		const at = new AccessToken(
			process.env.LIVEKIT_API_KEY!,
			process.env.LIVEKIT_API_SECRET!,
			{ identity }
		);

		at.addGrant({ roomJoin: true, room: roomName });

		// Add metadata to token for agent to access
		// Only include user ID and userName - agent will fetch data from Supabase
		at.metadata = JSON.stringify({
			userId: user.id,
			userName: userName.trim(),
		});

		const token = await at.toJwt();
		return NextResponse.json({ token });
	} catch (error) {
		console.error('[Token] Error generating token:', error);
		return NextResponse.json(
			{ error: 'Failed to generate token' },
			{ status: 500 }
		);
	}
}


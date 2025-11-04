import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const identity = searchParams.get('identity');
	const roomName = searchParams.get('roomName');

	if (!identity || !roomName) {
		return NextResponse.json(
			{ error: 'Missing identity or roomName' },
			{ status: 400 }
		);
	}

	const at = new AccessToken(
		process.env.LIVEKIT_API_KEY!,
		process.env.LIVEKIT_API_SECRET!,
		{ identity }
	);

	at.addGrant({ roomJoin: true, room: roomName });

	const token = await at.toJwt();
	return NextResponse.json({ token });
}


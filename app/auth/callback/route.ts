// frontend/app/auth/callback/route.ts
// OAuth callback handler

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
	const requestUrl = new URL(request.url);
	const code = requestUrl.searchParams.get('code');
	const next = requestUrl.searchParams.get('next') || '/therapy';

	if (code) {
		const supabase = await createClient();
		await supabase.auth.exchangeCodeForSession(code);
	}

	// Redirect to the dashboard or the next URL
	return NextResponse.redirect(new URL(next, requestUrl.origin));
}


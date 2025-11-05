import { NextRequest, NextResponse } from 'next/server';

// Next.js automatically loads environment variables from .env.local
// No need to import or configure dotenv

interface SessionSummary {
	timestamp: number;
	keyThemes: string[];
	emotionalState: string;
	openIssues: string[];
	summary: string;
}

interface Transcript {
	role: string;
	text: string;
	timestamp: number;
}

// Generate a template-based summary (no API calls required, always works)
function generateTemplateSummary(
	userName: string,
	transcripts: Transcript[]
): SessionSummary {
	const userMessages = transcripts.filter((t) => t.role === 'user').map((t) => t.text);

	// Extract meaningful words from user messages (keyword extraction)
	const stopWords = new Set([
		'this',
		'that',
		'with',
		'from',
		'about',
		'their',
		'there',
		'these',
		'those',
		'would',
		'could',
		'should',
		'might',
		'have',
		'been',
		'being',
		'what',
		'when',
		'where',
		'which',
		'while',
		'after',
		'before',
		'during',
		'because',
		'though',
	]);

	const allWords = userMessages
		.join(' ')
		.toLowerCase()
		.replace(/[^\w\s]/g, ' ')
		.split(/\s+/)
		.filter((w) => w.length > 4 && !stopWords.has(w));

	const wordCounts = allWords.reduce((acc: Record<string, number>, word) => {
		acc[word] = (acc[word] || 0) + 1;
		return acc;
	}, {});

	// Get top themes (words that appear multiple times)
	const topThemes = Object.entries(wordCounts)
		.filter(([, count]) => count >= 2) // Only words mentioned 2+ times
		.sort((a, b) => b[1] - a[1])
		.slice(0, 4)
		.map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));

	// Detect emotional indicators
	const emotionalKeywords = {
		positive: [
			'happy',
			'good',
			'better',
			'great',
			'excited',
			'relieved',
			'grateful',
			'hopeful',
		],
		negative: [
			'sad',
			'angry',
			'anxious',
			'worried',
			'stressed',
			'frustrated',
			'depressed',
			'scared',
		],
		neutral: ['okay', 'fine', 'alright', 'normal', 'tired', 'confused'],
	};

	const allText = userMessages.join(' ').toLowerCase();
	let emotionalState = 'Neutral';
	if (emotionalKeywords.negative.some((kw) => allText.includes(kw))) {
		emotionalState = 'Patient expressed some concerns or difficult emotions';
	} else if (emotionalKeywords.positive.some((kw) => allText.includes(kw))) {
		emotionalState = 'Patient showed positive engagement';
	} else {
		emotionalState = 'Patient engaged in therapy session';
	}

	const keyThemes = topThemes.length > 0 ? topThemes : ['General discussion'];
	const messageCount = userMessages.length;

	// Calculate session duration
	let duration = 0;
	if (transcripts.length > 0) {
		const first = transcripts[0];
		const last = transcripts[transcripts.length - 1];
		if (first && last && first.timestamp && last.timestamp) {
			duration = Math.round((last.timestamp - first.timestamp) / 1000 / 60);
		}
	}

	const summary = `Session with ${userName} included ${messageCount} exchanges${
		duration > 0 ? ` over ${duration} minutes` : ''
	}, focusing on ${keyThemes.join(', ')}.`;

	return {
		timestamp: Date.now(),
		keyThemes,
		emotionalState,
		openIssues: [], // Could be enhanced to detect questions/concerns
		summary,
	};
}

// Generate session summary using Google Gemini API with template fallback
async function generateSessionSummary(
	userName: string,
	transcripts: Transcript[]
): Promise<SessionSummary | null> {
	if (transcripts.length === 0) return null;

	// Try Gemini API first if key is available
	const geminiKey = process.env.GEMINI_KEY;
	if (geminiKey) {
		try {
			// Format conversation for summary
			const conversationText = transcripts
				.map((t) => `${t.role === 'user' ? userName : 'Therapist'}: ${t.text}`)
				.join('\n')
				.slice(0, 30000); // Limit length for Gemini API

			const prompt = `You are a professional therapist reviewing a therapy session transcript. Create a concise summary focusing on:

1. Key themes discussed (2-4 main topics)
2. Patient's emotional state (overall mood, significant emotions expressed)
3. Open issues or concerns that need follow-up
4. A brief overall summary (2-3 sentences)

Patient name: ${userName}

Session transcript:
${conversationText}

Respond with a JSON object in this exact format (no markdown, just JSON):
{
  "keyThemes": ["theme1", "theme2"],
  "emotionalState": "brief description",
  "openIssues": ["issue1", "issue2"],
  "summary": "brief overall summary"
}`;

			console.log('[Summary] Generating summary using Google Gemini API...');

			const modelName = 'gemini-2.0-flash';

			const response = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						contents: [
							{
								parts: [
									{
										text: prompt,
									},
								],
							},
						],
						generationConfig: {
							temperature: 0.7,
							topK: 40,
							topP: 0.95,
							maxOutputTokens: 1024,
						},
					}),
				}
			);

			if (!response.ok) {
				const errorText = await response.text();

				// Handle rate limiting (429) - skip API and use template immediately
				if (response.status === 429) {
					console.warn(
						`[Summary] Gemini API rate limited (429). Using template summary instead.`
					);
					throw new Error('RATE_LIMITED');
				}

				console.error(
					`[Summary] Gemini API error (model: ${modelName}):`,
					errorText
				);
				throw new Error(`Gemini API error: ${response.status}`);
			}

			console.log(
				`[Summary] Successfully called Gemini API with model: ${modelName}`
			);

			const data = await response.json();
			const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

			if (!content) {
				console.warn('[Summary] No content in Gemini response');
				throw new Error('Empty response from Gemini');
			}

			// Extract JSON from response (handle markdown code blocks if present)
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				console.warn('[Summary] Failed to extract JSON from Gemini response');
				throw new Error('No JSON found in response');
			}

			const summaryData = JSON.parse(jsonMatch[0]);

			console.log('[Summary] ✓ Successfully generated summary using Gemini');

			return {
				timestamp: Date.now(),
				keyThemes: summaryData.keyThemes || [],
				emotionalState: summaryData.emotionalState || '',
				openIssues: summaryData.openIssues || [],
				summary: summaryData.summary || '',
			};
		} catch (error) {
			// If rate limited, skip immediately to template (don't retry)
			if (error instanceof Error && error.message === 'RATE_LIMITED') {
				console.warn(
					'[Summary] Gemini API rate limited, using template summary immediately'
				);
			} else {
				console.warn(
					'[Summary] Gemini API failed, falling back to template summary:',
					error
				);
			}
			// Fall through to template-based summary
		}
	} else {
		console.log('[Summary] GEMINI_KEY not set, using template-based summary');
	}

	// Fallback to template-based summary (always works, no API needed)
	console.log('[Summary] Generating template-based summary...');
	return generateTemplateSummary(userName, transcripts);
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { userName, transcripts } = body;

		if (!userName || !transcripts || !Array.isArray(transcripts)) {
			return NextResponse.json(
				{ error: 'userName and transcripts array are required' },
				{ status: 400 }
			);
		}

		console.log(
			`[Summarize API] Generating summary for ${userName} with ${transcripts.length} transcripts`
		);

		const summary = await generateSessionSummary(userName, transcripts);

		if (!summary) {
			return NextResponse.json(
				{ error: 'Failed to generate summary' },
				{ status: 500 }
			);
		}

		return NextResponse.json({ summary });
	} catch (error) {
		console.error('[Summarize API] Error:', error);
		return NextResponse.json(
			{
				error: 'Internal server error',
				message: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}


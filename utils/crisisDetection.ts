// Crisis detection and safety resources

export interface CrisisResources {
	title: string;
	message: string;
	hotlines: Array<{
		name: string;
		number: string;
		description?: string;
	}>;
}

/**
 * Crisis keywords and phrases to detect
 * These are case-insensitive and will match partial words
 */
const CRISIS_KEYWORDS = [
	// Suicide-related
	'kill myself',
	'kill myself',
	'end my life',
	'end it all',
	'want to die',
	'don\'t want to live',
	'suicide',
	'take my life',
	'not worth living',
	'better off dead',
	'no reason to live',
	'give up',
	'end everything',
	// Self-harm
	'cut myself',
	'hurt myself',
	'self harm',
	'self-harm',
	// Hopelessness
	'no hope',
	'hopeless',
	'no point',
	'nothing matters',
	'can\'t go on',
	'can\'t continue',
	// Emergency situations
	'going to hurt',
	'going to kill',
	'planning to',
];

/**
 * Check if text contains crisis keywords
 */
export function detectCrisisKeywords(text: string): boolean {
	const lowerText = text.toLowerCase();
	return CRISIS_KEYWORDS.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Get crisis resources message
 */
export function getCrisisResources(): CrisisResources {
	return {
		title: 'Help is Available',
		message: 'If you\'re having thoughts of suicide or self-harm, please know that help is available. You are not alone, and there are people who want to support you.',
		hotlines: [
			{
				name: '988 Suicide & Crisis Lifeline',
				number: '988',
				description: 'Call or text 988 for free, confidential support 24/7',
			},
			{
				name: 'Crisis Text Line',
				number: 'Text HOME to 741741',
				description: 'Free 24/7 crisis support via text message',
			},
			{
				name: 'National Suicide Prevention Lifeline',
				number: '1-800-273-8255',
				description: 'Available 24/7 for crisis support',
			},
			{
				name: 'Emergency Services',
				number: '911',
				description: 'For immediate life-threatening emergencies',
			},
		],
	};
}

/**
 * Create a system message for crisis resources
 */
export function createCrisisSystemMessage(): {
	id: string;
	speaker: 'system';
	text: string;
	isFinal: true;
	timestamp: number;
} {
	const resources = getCrisisResources();
	const hotlinesText = resources.hotlines
		.map((h) => `• ${h.name}: ${h.number}${h.description ? ` - ${h.description}` : ''}`)
		.join('\n');

	const messageText = `${resources.title}\n\n${resources.message}\n\n${hotlinesText}\n\nRemember: You matter, and there is help available.`;

	return {
		id: `crisis-${Date.now()}`,
		speaker: 'system',
		text: messageText,
		isFinal: true,
		timestamp: Date.now(),
	};
}


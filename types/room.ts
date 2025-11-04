// Type definitions for room and transcript functionality

export interface TranscriptMessage {
	id: string;
	speaker: string;
	text: string;
	isFinal: boolean;
	timestamp: number;
}

export interface TextStreamReader {
	info: {
		id: string;
		attributes: Record<string, string>;
	};
	readAll(): Promise<string>;
}

export interface ParticipantIdentity {
	identity: string;
}

export interface MessageBuffer {
	messages: TranscriptMessage[];
	lastUpdate: number;
	timeoutId: NodeJS.Timeout | null;
}

export interface StoredTranscript {
	role: string;
	text: string;
	timestamp: number;
}


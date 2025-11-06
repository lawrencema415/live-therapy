// Hook for crisis detection in transcripts

import { useRef, useCallback } from 'react';
import type { TranscriptMessage } from '@/types/room';
import { detectCrisisKeywords, createCrisisSystemMessage } from '@/utils/crisisDetection';

interface UseCrisisDetectionProps {
	onCrisisDetected: (systemMessage: TranscriptMessage) => void;
}

/**
 * Hook to detect crisis keywords in transcripts and trigger safety resources
 */
export function useCrisisDetection({ onCrisisDetected }: UseCrisisDetectionProps) {
	// Track if we've already shown crisis resources in this session
	const crisisDetectedRef = useRef(false);
	// Track processed message IDs to avoid duplicate checks
	const processedMessagesRef = useRef<Set<string>>(new Set());

	/**
	 * Check a transcript message for crisis keywords
	 * Only checks user messages (not agent or system messages)
	 */
	const checkForCrisis = useCallback(
		(message: TranscriptMessage) => {
			// Only check user messages
			if (message.speaker !== 'user') {
				return;
			}

			// Skip if we've already processed this message
			if (processedMessagesRef.current.has(message.id)) {
				return;
			}

			// Skip if we've already shown crisis resources
			if (crisisDetectedRef.current) {
				return;
			}

			// Only check final messages to avoid false positives from partial transcripts
			if (!message.isFinal) {
				return;
			}

			// Mark as processed
			processedMessagesRef.current.add(message.id);

			// Check for crisis keywords
			if (detectCrisisKeywords(message.text)) {
				console.log('[CrisisDetection] Crisis keywords detected in message:', message.text.substring(0, 50));
				crisisDetectedRef.current = true;

				// Create and send system message with resources
				const systemMessage = createCrisisSystemMessage();
				onCrisisDetected(systemMessage);
			}
		},
		[onCrisisDetected]
	);

	/**
	 * Reset crisis detection (e.g., when starting a new session)
	 */
	const reset = useCallback(() => {
		crisisDetectedRef.current = false;
		processedMessagesRef.current.clear();
	}, []);

	return {
		checkForCrisis,
		reset,
	};
}


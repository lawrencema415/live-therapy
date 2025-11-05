'use client';

import { useEffect, useRef } from 'react';
import type { TranscriptMessage } from '@/types/room';
import { TranscriptMessageComponent } from './TranscriptMessage';

interface TranscriptListProps {
	transcripts: TranscriptMessage[];
}

export function TranscriptList({ transcripts }: TranscriptListProps) {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const shouldAutoScrollRef = useRef(true);
	const lastTranscriptCountRef = useRef(0);
	const lastTranscriptIdRef = useRef<string>('');

	// Auto-scroll to bottom when new messages are added
	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		// Get the last transcript ID to check if content actually changed
		const lastTranscriptId =
			transcripts.length > 0
				? transcripts[transcripts.length - 1]?.id || ''
				: '';

		// Check if new messages were added (by count or by ID)
		const hasNewMessages =
			transcripts.length > lastTranscriptCountRef.current ||
			lastTranscriptId !== lastTranscriptIdRef.current;

		// Only auto-scroll if user is near bottom or if it's the first messages
		if (
			hasNewMessages &&
			(shouldAutoScrollRef.current || transcripts.length <= 2)
		) {
			// Use double RAF to ensure DOM is fully updated
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					if (container) {
						container.scrollTo({
							top: container.scrollHeight,
							behavior: 'smooth',
						});
					}
				});
			});
		}

		lastTranscriptCountRef.current = transcripts.length;
		lastTranscriptIdRef.current = lastTranscriptId;
	}, [transcripts]);

	// Track scroll position to determine if user manually scrolled up
	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		const handleScroll = () => {
			const { scrollTop, scrollHeight, clientHeight } = container;
			const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
			shouldAutoScrollRef.current = isAtBottom;
		};

		// Initial check
		handleScroll();

		container.addEventListener('scroll', handleScroll);
		return () => {
			container.removeEventListener('scroll', handleScroll);
		};
	}, []);

	// Auto-scroll on initial mount if transcripts already exist
	useEffect(() => {
		const container = scrollContainerRef.current;
		if (container && transcripts.length > 0) {
			// Small delay to ensure DOM is ready, then scroll instantly
			setTimeout(() => {
				if (container) {
					container.scrollTop = container.scrollHeight;
					shouldAutoScrollRef.current = true;
				}
			}, 100);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	console.log('transcripts', transcripts);
	return (
		<div className='bg-white rounded-lg shadow-lg p-6'>
			<h2 className='text-lg font-semibold text-gray-800 mb-4'>Conversation</h2>

			<div
				ref={scrollContainerRef}
				className='space-y-3 min-h-[400px] max-h-[600px] overflow-y-auto pb-20'
			>
				{transcripts.length === 0 ? (
					<div className='text-center py-12 text-gray-400'>
						<p>Waiting for conversation to start...</p>
					</div>
				) : (
					transcripts.map((msg) => (
						<TranscriptMessageComponent
							key={`${msg.id}-${msg.timestamp}`}
							message={msg}
						/>
					))
				)}
			</div>
		</div>
	);
}

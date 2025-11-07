'use client';

import { X } from 'lucide-react';
import type { SessionSummary } from '@/utils/userSessionStorage';

interface LastSessionSummaryProps {
	summary: SessionSummary;
	onDismiss: () => void;
}

export function LastSessionSummary({
	summary,
	onDismiss,
}: LastSessionSummaryProps) {
	const sessionDate = new Date(summary.timestamp).toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});

	return (
		<div className='mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 shadow-md'>
			<div className='p-5'>
				<div className='flex items-start justify-between mb-3'>
					<div className='flex-1'>
						<h3 className='text-sm font-bold text-blue-900 mb-1'>
							Last Session Summary
						</h3>
						<p className='text-xs text-blue-700 opacity-80'>{sessionDate}</p>
					</div>
					<button
						onClick={onDismiss}
						className='ml-3 p-1 hover:bg-blue-200 rounded-full transition-colors'
						aria-label='Dismiss summary'
					>
						<X className='w-4 h-4 text-blue-700' />
					</button>
				</div>

				{summary.summary && (
					<div className='mb-3'>
						<p className='text-sm text-blue-900 leading-relaxed'>
							{summary.summary}
						</p>
					</div>
				)}

				{summary.keyThemes && summary.keyThemes.length > 0 && (
					<div className='mb-3'>
						<p className='text-xs font-semibold text-blue-800 mb-1.5'>
							Key Themes:
						</p>
						<div className='flex flex-wrap gap-1.5'>
							{summary.keyThemes.map((theme, idx) => (
								<span
									key={idx}
									className='text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full'
								>
									{theme}
								</span>
							))}
						</div>
					</div>
				)}

				{summary.emotionalState && (
					<div className='mb-2'>
						<p className='text-xs font-semibold text-blue-800 mb-1'>
							Emotional State:
						</p>
						<p className='text-xs text-blue-700'>{summary.emotionalState}</p>
					</div>
				)}

				{summary.openIssues && summary.openIssues.length > 0 && (
					<div>
						<p className='text-xs font-semibold text-blue-800 mb-1'>
							Open Issues:
						</p>
						<ul className='text-xs text-blue-700 list-disc list-inside space-y-0.5'>
							{summary.openIssues.map((issue, idx) => (
								<li key={idx}>{issue}</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
}


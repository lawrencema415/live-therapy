'use client';

import { useState } from 'react';
import type { MoodCheckInData } from '@/utils/userSessionStorage';

interface MoodCheckInProps {
	onComplete: (data: MoodCheckInData) => void;
	onSkip?: () => void;
	type: 'pre' | 'post';
	initialRating?: number;
}

export function MoodCheckIn({
	onComplete,
	onSkip,
	type,
	initialRating = 5,
}: MoodCheckInProps) {
	const [rating, setRating] = useState(initialRating);
	const [notes, setNotes] = useState('');
	const [showNotes, setShowNotes] = useState(false);

	const getMoodColor = (value: number): string => {
		if (value <= 3) return 'bg-red-500';
		if (value <= 5) return 'bg-yellow-500';
		if (value <= 7) return 'bg-blue-500';
		return 'bg-green-500';
	};

	const handleSubmit = () => {
		onComplete({
			rating,
			notes: notes.trim() || undefined,
			timestamp: Date.now(),
		});
	};

	return (
		<div className='fixed inset-0 therapy-background bg-opacity-50 flex items-center justify-center z-50 p-4'>
			<div className='bg-white rounded-lg shadow-xl p-6 max-w-md w-full'>
				<h2 className='text-2xl font-bold text-gray-800 mb-2'>
					{type === 'pre' ? 'Pre-Session Check-In' : 'Post-Session Check-In'}
				</h2>
				<p className='text-gray-600 mb-6'>
					{type === 'pre'
						? 'How are you feeling right now?'
						: 'How are you feeling after this session?'}
				</p>

				<div className='mb-6'>
					{/* Visual indicators */}
					<div className='flex justify-between mt-2'>
						{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
							<button
								key={value}
								type='button'
								onClick={() => setRating(value)}
								className={`cursor-pointer w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
									value === rating
										? `${getMoodColor(value)} text-white scale-110`
										: 'bg-gray-200 text-gray-500 hover:bg-gray-300'
								}`}
							>
								{value}
							</button>
						))}
					</div>
				</div>

				{/* Optional notes */}
				<div className='mb-6'>
					<button
						type='button'
						onClick={() => setShowNotes(!showNotes)}
						className='cursor-pointer text-sm text-slate-600 hover:text-slate-800 mb-2'
					>
						{showNotes ? 'Hide' : 'Add'} notes (optional)
					</button>
					{showNotes && (
						<textarea
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder='How are you feeling? Any thoughts you want to note?'
							className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black resize-none'
							rows={3}
						/>
					)}
				</div>

				{/* Action buttons */}
				<div className='flex gap-3'>
					{onSkip && (
						<button
							type='button'
							onClick={onSkip}
							className='cursor-pointer flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors'
						>
							Skip
						</button>
					)}
					<button
						type='button'
						onClick={handleSubmit}
						className='cursor-pointer flex-1 px-4 py-2 bg-[#191919] hover:bg-black text-white rounded-lg transition-colors font-semibold'
					>
						Continue
					</button>
				</div>
			</div>
		</div>
	);
}

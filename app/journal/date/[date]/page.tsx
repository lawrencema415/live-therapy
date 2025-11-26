'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { JournalSidebar } from '@/components/journal/JournalSidebar';
import { JournalEntryCard } from '@/components/journal/JournalEntryCard';
import {
	getJournalEntries,
	type JournalEntry,
} from '@/utils/supabaseDatabase';
import { ArrowLeft, Calendar as CalendarIcon } from 'lucide-react';

export default function JournalDatePage() {
	const router = useRouter();
	const params = useParams();
	const dateParam = params.date as string;
	const [entries, setEntries] = useState<JournalEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (dateParam) {
			loadEntries();
		}
	}, [dateParam]);

	const loadEntries = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const allEntries = await getJournalEntries();
			setEntries(allEntries);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load journal entries';
			setError(errorMessage);
			console.error('Error loading journal entries:', err);
		} finally {
			setIsLoading(false);
		}
	};

	// Filter entries for the selected date
	const dateEntries = useMemo(() => {
		if (!dateParam) return [];

		// Parse date string (YYYY-MM-DD) using local timezone
		const [year, month, day] = dateParam.split('-').map(Number);
		const selectedDate = new Date(year, month - 1, day);
		selectedDate.setHours(0, 0, 0, 0);
		const selectedDateString = selectedDate.toDateString();

		return entries.filter((entry) => {
			const entryDate = new Date(entry.created_at);
			entryDate.setHours(0, 0, 0, 0);
			return entryDate.toDateString() === selectedDateString;
		});
	}, [entries, dateParam]);

	const handleEntryDeleted = () => {
		loadEntries();
	};

	const formattedDate = useMemo(() => {
		if (!dateParam) return '';
		// Parse date string (YYYY-MM-DD) using local timezone
		const [year, month, day] = dateParam.split('-').map(Number);
		const date = new Date(year, month - 1, day);
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	}, [dateParam]);

	if (isLoading) {
		return (
			<ProtectedRoute>
				<div className='fixed inset-0 bg-white z-50 flex items-center justify-center'>
					<div className='text-center'>
						<div className='w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
						<p className='text-gray-600 text-sm font-medium'>Loading entries...</p>
					</div>
				</div>
			</ProtectedRoute>
		);
	}

	return (
		<ProtectedRoute>
			<div className='h-screen flex overflow-hidden bg-slate-50'>
				{/* Sidebar */}
				<JournalSidebar />

				{/* Main Content */}
				<div className='flex-1 flex flex-col overflow-hidden'>
					{/* Header */}
					<div className='shrink-0 px-4 sm:px-6 py-4 sm:py-6 bg-white border-b border-slate-200 shadow-sm'>
						<div className='flex items-center gap-4'>
							<button
								onClick={() => router.push('/journal')}
								className='flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
								aria-label='Back to journal'
							>
								<ArrowLeft size={20} />
							</button>
							<div className='flex-1 min-w-0'>
								<h1 className='text-2xl sm:text-3xl font-bold text-slate-800 truncate'>
									{formattedDate}
								</h1>
								<p className='text-sm text-slate-600 mt-1'>
									{dateEntries.length > 0
										? `${dateEntries.length} ${dateEntries.length === 1 ? 'entry' : 'entries'}`
										: 'No entries for this date'}
								</p>
							</div>
						</div>
					</div>

					{/* Content Area */}
					<div className='flex-1 overflow-y-auto p-4 sm:p-6'>
						{error ? (
							<div className='max-w-2xl mx-auto mt-8'>
								<div className='bg-red-50 border border-red-200 rounded-xl p-6 text-center'>
									<p className='text-sm text-red-700'>{error}</p>
								</div>
							</div>
						) : dateEntries.length === 0 ? (
							<div className='max-w-2xl mx-auto mt-12'>
								<div className='bg-white rounded-xl shadow-sm border border-slate-200 p-8 sm:p-12 text-center'>
									<div className='w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center'>
										<CalendarIcon size={32} className='text-slate-400' />
									</div>
									<h3 className='text-xl font-semibold text-slate-800 mb-2'>
										<JournalEntryCard
											key={entry.id}
											entry={entry}
											onDeleted={handleEntryDeleted}
										/>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</ProtectedRoute>
	);
}


'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import {
	getJournalEntries,
	type JournalEntry,
} from '@/utils/supabaseDatabase';
import { JournalSidebar } from '@/components/journal/JournalSidebar';
import { JournalCalendar } from '@/components/journal/JournalCalendar';
import { Plus, BookOpen, AlertCircle, RefreshCw } from 'lucide-react';

export default function JournalPage() {
	const { user, loading: authLoading } = useAuth();
	const router = useRouter();
	const [entries, setEntries] = useState<JournalEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);

	useEffect(() => {
		if (!authLoading && user) {
			loadEntries();
		}
	}, [authLoading, user]);

	const loadEntries = async (showRefreshIndicator = false) => {
		if (showRefreshIndicator) {
			setIsRefreshing(true);
		} else {
			setIsLoading(true);
		}
		setError(null);
		try {
			const loadedEntries = await getJournalEntries();
			setEntries(loadedEntries);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load journal entries';
			setError(errorMessage);
			console.error('Error loading journal entries:', err);
		} finally {
			setIsLoading(false);
			setIsRefreshing(false);
		}
	};

	const handleCreateNew = () => {
		router.push('/journal/new');
	};

	const handleEntryDeleted = () => {
		loadEntries();
	};

	const handleRefresh = () => {
		loadEntries(true);
	};

	if (authLoading || isLoading) {
		return (
			<div className='fixed inset-0 bg-white z-50 flex items-center justify-center'>
				<div className='text-center'>
					<div className='w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
					<p className='text-gray-600 text-sm font-medium'>Loading journal...</p>
				</div>
			</div>
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
						<div className='flex items-center justify-between gap-4'>
							<div className='min-w-0 flex-1'>
								<h1 className='text-2xl sm:text-3xl font-bold text-slate-800 truncate'>
									Journal
								</h1>
								<p className='text-sm text-slate-600 mt-1'>
									{entries.length > 0
										? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
										: 'Your personal reflection space'}
								</p>
							</div>
							<div className='flex items-center gap-2 shrink-0'>
								{entries.length > 0 && (
									<button
										onClick={handleRefresh}
										disabled={isRefreshing}
										className='flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
										title='Refresh entries'
										aria-label='Refresh journal entries'
									>
										<RefreshCw
											size={18}
											className={isRefreshing ? 'animate-spin' : ''}
										/>
									</button>
								)}
								<button
									onClick={handleCreateNew}
									className='flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2.5 px-4 sm:px-5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer'
									aria-label='Create new journal entry'
								>
									<Plus size={20} className='shrink-0' />
									<span className='hidden sm:inline whitespace-nowrap'>New Entry</span>
									<span className='sm:hidden'>New</span>
								</button>
							</div>
						</div>
					</div>

					{/* Content Area - Full Width Calendar */}
					<div className='flex-1 overflow-y-auto'>
						{error ? (
							<div className='h-full flex items-center justify-center p-4 sm:p-6'>
								<div className='max-w-2xl mx-auto'>
									<div className='bg-red-50 border border-red-200 rounded-xl p-6 sm:p-8 text-center'>
										<div className='w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center'>
											<AlertCircle size={24} className='text-red-600' />
										</div>
										<h3 className='text-lg font-semibold text-red-800 mb-2'>
											Failed to load entries
										</h3>
										<p className='text-sm text-red-700 mb-6'>
											{error}
										</p>
										<button
											onClick={handleRefresh}
											className='inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
											aria-label='Retry loading entries'
										>
											<RefreshCw size={18} />
											Try Again
										</button>
									</div>
								</div>
							</div>
						) : entries.length === 0 ? (
							<div className='h-full flex items-center justify-center p-4 sm:p-6'>
								<div className='max-w-2xl mx-auto'>
									<div className='bg-white rounded-xl shadow-sm border border-slate-200 p-8 sm:p-12 text-center'>
										<div className='w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center'>
											<BookOpen size={32} className='text-blue-500' />
										</div>
										<h3 className='text-xl font-semibold text-slate-800 mb-2'>
											No journal entries yet
										</h3>
										<p className='text-sm text-slate-600 mb-6 max-w-md mx-auto'>
											Start your journaling journey by creating your first entry. Reflect on your thoughts, track your progress, and document your experiences.
										</p>
										<button
											onClick={handleCreateNew}
											className='inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer'
											aria-label='Create your first journal entry'
										>
											<Plus size={20} />
											Create Your First Entry
										</button>
									</div>
								</div>
							</div>
						) : (
							<div className='h-full w-full bg-white p-3 sm:p-4 lg:p-6'>
								<JournalCalendar entries={entries} />
							</div>
						)}
					</div>
				</div>
			</div>
		</ProtectedRoute>
	);
}


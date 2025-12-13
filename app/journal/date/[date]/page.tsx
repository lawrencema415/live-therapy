'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { JournalSidebar } from '@/components/journal/JournalSidebar';
import { JournalEntryList } from '@/components/journal/JournalEntryList';
import { JournalEditorPanel } from '@/components/journal/JournalEditorPanel';
import {
	getJournalEntries,
	type JournalEntry,
} from '@/utils/supabaseDatabase';
import { ArrowLeft, BookOpen } from 'lucide-react';

export default function JournalDatePage() {
	const router = useRouter();
	const params = useParams();
	const dateParam = params.date as string;
	const [entries, setEntries] = useState<JournalEntry[]>([]);
	const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
		// Initialize from localStorage (client-side only)
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('journal-sidebar-open');
			return saved !== null ? saved === 'true' : true;
		}
		return true;
	});

	// Save sidebar state to localStorage
	const toggleSidebar = () => {
		setIsSidebarOpen(prev => {
			const newValue = !prev;
			localStorage.setItem('journal-sidebar-open', String(newValue));
			return newValue;
		});
	};

	useEffect(() => {
		loadEntries();
	}, []);

	const loadEntries = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const allEntries = await getJournalEntries();
			// Sort by created_at descending
			allEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
			setEntries(allEntries);
			
			// Auto-select first entry if none selected
			if (allEntries.length > 0 && !selectedEntryId) {
				setSelectedEntryId(allEntries[0].id);
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load journal entries';
			setError(errorMessage);
			console.error('Error loading journal entries:', err);
		} finally {
			setIsLoading(false);
		}
	};

	const selectedEntry = entries.find(e => e.id === selectedEntryId);

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
				<JournalSidebar isOpen={isSidebarOpen} />

				{/* Main Content */}
				<div className='flex-1 flex flex-col overflow-hidden'>
					{/* Split View Content */}
					<div className='flex-1 flex overflow-hidden'>
						{error ? (
							<div className='flex-1 flex items-center justify-center p-8'>
								<div className='max-w-md mx-auto text-center'>
									<div className='bg-red-50 border border-red-200 rounded-xl p-6'>
										<p className='text-sm text-red-700'>{error}</p>
									</div>
								</div>
							</div>
						) : entries.length === 0 ? (
							<div className='flex-1 flex items-center justify-center p-8'>
								<div className='max-w-md mx-auto text-center'>
									<div className='bg-white rounded-xl shadow-sm border border-slate-200 p-12'>
										<div className='w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center'>
											<BookOpen size={32} className='text-slate-400' />
										</div>
										<h3 className='text-xl font-semibold text-slate-800 mb-2'>
											No journal entries yet
										</h3>
										<p className='text-sm text-slate-600 mb-6'>
											Start documenting your thoughts by creating your first entry.
										</p>
										<button
											onClick={() => router.push('/journal/new')}
											className='inline-flex items-center gap-2 bg-[#191919] hover:bg-black text-white font-semibold py-3 px-6 rounded-lg transition-all cursor-pointer'
										>
											Create Entry
										</button>
									</div>
								</div>
							</div>
						) : (
							<>
								{/* Left Panel - Entry List (30%) */}
								<div className='w-full sm:w-80 lg:w-96 flex-shrink-0'>
									<JournalEntryList
										entries={entries}
										selectedEntryId={selectedEntryId || undefined}
										onSelectEntry={setSelectedEntryId}
										onToggleSidebar={toggleSidebar}
										isSidebarOpen={isSidebarOpen}
									/>
								</div>

								{/* Right Panel - Editor (70%) */}
								<div className='flex-1 min-w-0'>
									{selectedEntry ? (
										<JournalEditorPanel
											entry={selectedEntry}
											onUpdated={loadEntries}
										/>
									) : (
										<div className='h-full flex items-center justify-center p-8 bg-slate-50'>
											<div className='text-center'>
												<BookOpen size={48} className='text-slate-300 mx-auto mb-4' />
												<p className='text-slate-500'>Select an entry to view</p>
											</div>
										</div>
									)}
								</div>
							</>
						)}
					</div>
				</div>
			</div>
		</ProtectedRoute>
	);
}

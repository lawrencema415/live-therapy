'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { JournalSidebar } from '@/components/journal/JournalSidebar';
import { JournalEntryEditor } from '@/components/journal/JournalEntryEditor';
import {
	getJournalEntry,
	updateJournalEntry,
	type JournalEntry,
	type UpdateJournalEntryInput,
} from '@/utils/supabaseDatabase';

export default function EditJournalEntryPage() {
	const router = useRouter();
	const params = useParams();
	const entryId = params.id as string;
	const [entry, setEntry] = useState<JournalEntry | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
		// Initialize from localStorage (client-side only)
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('journal-sidebar-open');
			return saved !== null ? saved === 'true' : true;
		}
		return true;
	});

	useEffect(() => {
		if (entryId) {
			loadEntry();
		}
	}, [entryId]);

	const loadEntry = async () => {
		setIsLoading(true);
		try {
			const loadedEntry = await getJournalEntry(entryId);
			if (loadedEntry) {
				setEntry(loadedEntry);
			} else {
				router.push('/journal');
			}
		} catch (error) {
			console.error('Error loading journal entry:', error);
			router.push('/journal');
		} finally {
			setIsLoading(false);
		}
	};

	const handleSave = async (input: UpdateJournalEntryInput) => {
		if (!entry) return;

		setIsSaving(true);
		try {
			const updatedEntry = await updateJournalEntry(entry.id, input);
			if (updatedEntry) {
				setEntry(updatedEntry);
				router.push(`/journal/${entry.id}/view`);
			}
		} catch (error) {
			console.error('Error updating journal entry:', error);
			alert('Failed to save journal entry. Please try again.');
		} finally {
			setIsSaving(false);
		}
	};

	const handleCancel = () => {
		router.push('/journal');
	};

	if (isLoading) {
		return (
			<ProtectedRoute>
				<div className='fixed inset-0 bg-white z-50 flex items-center justify-center'>
					<div className='text-center'>
						<div className='w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
						<p className='text-gray-600'>Loading entry...</p>
					</div>
				</div>
			</ProtectedRoute>
		);
	}

	if (!entry) {
		return null;
	}

	return (
		<ProtectedRoute>
			<div className='h-screen flex overflow-hidden bg-slate-50'>
				<JournalSidebar isOpen={isSidebarOpen} />
				<div className='flex-1 flex flex-col overflow-hidden'>
					<JournalEntryEditor
						entry={entry}
						onSave={handleSave}
						onCancel={handleCancel}
						isSaving={isSaving}
					/>
				</div>
			</div>
		</ProtectedRoute>
	);
}


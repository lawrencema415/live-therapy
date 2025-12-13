'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { JournalSidebar } from '@/components/journal/JournalSidebar';
import { JournalEntryEditor } from '@/components/journal/JournalEntryEditor';
import {
	createJournalEntry,
	uploadJournalImage,
	type CreateJournalEntryInput,
	type UpdateJournalEntryInput,
} from '@/utils/supabaseDatabase';

export default function NewJournalEntryPage() {
	const router = useRouter();
	const [isSaving, setIsSaving] = useState(false);
	const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
		// Initialize from localStorage
		const saved = localStorage.getItem('journal-sidebar-open');
		return saved !== null ? saved === 'true' : true;
	});

	const handleSave = async (input: CreateJournalEntryInput | UpdateJournalEntryInput) => {
		setIsSaving(true);
		try {
			const entry = await createJournalEntry(input as CreateJournalEntryInput);
			if (entry) {
				router.push(`/journal/${entry.id}/view`);
			}
		} catch (error) {
			console.error('Error creating journal entry:', error);
			alert('Failed to save journal entry. Please try again.');
		} finally {
			setIsSaving(false);
		}
	};

	const handleCancel = () => {
		router.push('/journal');
	};

	return (
		<ProtectedRoute>
			<div className='h-screen flex overflow-hidden bg-slate-50'>
				<JournalSidebar isOpen={isSidebarOpen} />
				<div className='flex-1 flex flex-col overflow-hidden'>
					<JournalEntryEditor
						onSave={handleSave}
						onCancel={handleCancel}
						isSaving={isSaving}
					/>
				</div>
			</div>
		</ProtectedRoute>
	);
}


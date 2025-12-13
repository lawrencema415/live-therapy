'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { JournalEntryEditor } from './JournalEntryEditor';
import { updateJournalEntry, type JournalEntry, type UpdateJournalEntryInput } from '@/utils/supabaseDatabase';
import { Maximize2, Save, Check } from 'lucide-react';

interface JournalEditorPanelProps {
	entry: JournalEntry;
	onUpdated: () => void;
}

export function JournalEditorPanel({ entry, onUpdated }: JournalEditorPanelProps) {
	const router = useRouter();
	const [isSaving, setIsSaving] = useState(false);
	const [lastSaved, setLastSaved] = useState<Date | null>(null);
	
	// Ref to store the debounce timer
	const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

	// Debounced save function
	const debouncedSave = useCallback(
		async (input: UpdateJournalEntryInput) => {
			// Clear existing timer
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
			}

			// Set new timer (2 second debounce)
			saveTimerRef.current = setTimeout(async () => {
				setIsSaving(true);
				try {
					await updateJournalEntry(entry.id, input);
					setLastSaved(new Date());
					onUpdated();
				} catch (error) {
					console.error('Failed to auto-save:', error);
					alert('Failed to save changes. Please try again.');
				} finally {
					setIsSaving(false);
				}
			},2000); // 2 second debounce
		},
		[entry.id, onUpdated]
	);

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
			}
		};
	}, []);

	const handleSave = async (input: UpdateJournalEntryInput) => {
		await debouncedSave(input);
	};

	const handleCancel = () => {
		// No-op for inline editor, or could navigate away
	};

	const handleFocusMode = () => {
		router.push(`/journal/${entry.id}/edit`);
	};

	const formatLastSaved = () => {
		if (!lastSaved) return '';
		const now = new Date();
		const diff = now.getTime() - lastSaved.getTime();
		
		if (diff < 60000) return 'Saved just now';
		if (diff < 3600000) return `Saved ${Math.floor(diff / 60000)}m ago`;
		return `Saved at ${lastSaved.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
	};

	return (
		<div className="h-full flex flex-col bg-white">
			{/* Header with Focus Mode button */}
			<div className="shrink-0 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
				<div className="flex items-center gap-3">
					{isSaving ? (
						<div className="flex items-center gap-2 text-xs text-slate-500">
							<Save className="w-4 h-4 animate-pulse" />
							<span>Saving...</span>
						</div>
					) : lastSaved ? (
						<div className="flex items-center gap-2 text-xs text-slate-500">
							<Check className="w-4 h-4 text-green-600" />
							<span>{formatLastSaved()}</span>
						</div>
					) : null}
				</div>

				<button
					onClick={handleFocusMode}
					className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors text-sm font-medium cursor-pointer"
					title="Open in focus mode (fullscreen)"
				>
					<Maximize2 size={16} />
					<span className="hidden sm:inline">Focus Mode</span>
				</button>
			</div>

			{/* Editor */}
			<div className="flex-1 overflow-y-auto">
				<JournalEntryEditor
					entry={entry}
					onSave={handleSave}
					onCancel={handleCancel}
					isSaving={isSaving}
				/>
			</div>
		</div>
	);
}

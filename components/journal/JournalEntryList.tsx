'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, MapPin, Menu } from 'lucide-react';
import type { JournalEntry } from '@/utils/supabaseDatabase';

interface JournalEntryListProps {
	entries: JournalEntry[];
	selectedEntryId?: string;
	onSelectEntry: (entryId: string) => void;
	onToggleSidebar?: () => void;
	isSidebarOpen?: boolean;
}

interface GroupedEntries {
	monthYear: string;
	entries: JournalEntry[];
}

export function JournalEntryList({ entries, selectedEntryId, onSelectEntry, onToggleSidebar, isSidebarOpen }: JournalEntryListProps) {
	const router = useRouter();
	// Group entries by month/year
	const groupedEntries = useMemo(() => {
		const groups = new Map<string, JournalEntry[]>();

		entries.forEach((entry) => {
			const date = new Date(entry.created_at);
			const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
			
			const existing = groups.get(monthYear) || [];
			existing.push(entry);
			groups.set(monthYear, existing);
		});

		// Convert to array and sort by date (newest first)
		const result: GroupedEntries[] = [];
		groups.forEach((entries, monthYear) => {
			// Sort entries within each month
			entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
			result.push({ monthYear, entries });
		});

		// Sort groups by date (newest first)
		result.sort((a, b) => {
			const dateA = new Date(a.entries[0].created_at);
			const dateB = new Date(b.entries[0].created_at);
			return dateB.getTime() - dateA.getTime();
		});

		return result;
	}, [entries]);

	const stripHtml = (html: string) => {
		const tmp = document.createElement('div');
		tmp.innerHTML = html;
		return tmp.textContent || tmp.innerText || '';
	};

	return (
		<div className="h-full flex flex-col bg-white border-r border-slate-200">
			{/* Header */}
			<div className="shrink-0 p-4 border-b border-slate-200 flex items-center justify-between">
				<div className="flex items-center gap-2">
					{onToggleSidebar && (
						<button
							onClick={onToggleSidebar}
							className='flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all cursor-pointer'
							aria-label='Toggle sidebar'
							title='Toggle sidebar'
						>
							<Menu size={16} />
						</button>
					)}
					<div>
						<h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
							All Entries
						</h2>
						<p className="text-xs text-slate-500 mt-1">
							{entries.length} {entries.length === 1 ? 'entry' : 'entries'}
						</p>
					</div>
				</div>
				<button
					onClick={() => router.push('/journal')}
					className='flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
					aria-label='Back to journal'
				>
					<ArrowLeft size={20} />
				</button>
			</div>

			{/* Entry List */}
			<div className="flex-1 overflow-y-auto">
				{groupedEntries.length === 0 ? (
					<div className="p-8 text-center">
						<Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
						<p className="text-sm text-slate-500">No entries found</p>
					</div>
				) : (
					groupedEntries.map((group) => (
						<div key={group.monthYear} className="mb-6">
							{/* Month Header */}
							<div className="px-4 py-2 bg-slate-50 border-y border-slate-100">
								<h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
									{group.monthYear}
								</h3>
							</div>

							{/* Entries in this month */}
							<div className="divide-y divide-slate-100">
								{group.entries.map((entry) => {
									const entryDate = new Date(entry.created_at);
									const isSelected = entry.id === selectedEntryId;
									const previewText = stripHtml(entry.content).substring(0, 80);

									return (
										<button
											key={entry.id}
											onClick={() => onSelectEntry(entry.id)}
											className={`
												w-full px-4 py-3 text-left transition-colors cursor-pointer
												${isSelected
													? 'bg-blue-50 border-l-4 border-blue-500'
													: 'hover:bg-slate-50 border-l-4 border-transparent'
												}
											`}
										>
											{/* Title */}
											<h4 className={`
												text-sm font-semibold mb-1 truncate
												${isSelected ? 'text-blue-900' : 'text-slate-800'}
											`}>
												{entry.title || 'Untitled'}
											</h4>

											{/* Timestamp and metadata */}
											<div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
												<span>
													{entryDate.toLocaleTimeString('en-US', {
														hour: 'numeric',
														minute: '2-digit',
														hour12: true
													})}
												</span>
												<span>•</span>
												<span>
													{entryDate.toLocaleDateString('en-US', {
														month: 'short',
														day: 'numeric'
													})}
												</span>
											</div>

											{/* Preview */}
											{previewText && (
												<p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
													{previewText}{entry.content.length > 80 ? '...' : ''}
												</p>
											)}
										</button>
									);
								})}
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}

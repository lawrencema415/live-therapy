'use client';

import { useRouter } from 'next/navigation';
import { Calendar, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
	deleteJournalEntry,
	type JournalEntry,
} from '@/utils/supabaseDatabase';

interface JournalEntryCardProps {
	entry: JournalEntry;
	onDeleted?: () => void;
}

export function JournalEntryCard({ entry, onDeleted }: JournalEntryCardProps) {
	const router = useRouter();
	const [isDeleting, setIsDeleting] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const handleClick = () => {
		router.push(`/journal/${entry.id}/view`);
	};

	const handleDelete = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!showDeleteConfirm) {
			setShowDeleteConfirm(true);
			return;
		}

		setIsDeleting(true);
		try {
			const success = await deleteJournalEntry(entry.id);
			if (success && onDeleted) {
				onDeleted();
			}
		} catch (error) {
			console.error('Error deleting entry:', error);
		} finally {
			setIsDeleting(false);
			setShowDeleteConfirm(false);
		}
	};

	const handleCancelDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		setShowDeleteConfirm(false);
	};

	const preview = entry.content.substring(0, 150);
	const hasMore = entry.content.length > 150;
	const date = new Date(entry.created_at);
	const formattedDate = date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});

	return (
		<div
			onClick={handleClick}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					handleClick();
				}
			}}
			role='button'
			tabIndex={0}
			aria-label={`View journal entry: ${entry.title}`}
			className='bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-slate-300 transition-all duration-200 cursor-pointer overflow-hidden group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
		>
			{/* Image Preview */}
			{entry.images && entry.images.length > 0 && (
				<div className='h-48 bg-slate-100 relative overflow-hidden'>
					<img
						src={entry.images[0]}
						alt={entry.title}
						className='w-full h-full object-cover'
					/>
					{entry.images.length > 1 && (
						<div className='absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1'>
							<ImageIcon size={12} />
							<span>{entry.images.length}</span>
						</div>
					)}
				</div>
			)}

			{/* Content */}
			<div className='p-5'>
				<div className='flex items-start justify-between gap-3 mb-2'>
					<h3 className='text-lg font-semibold text-slate-800 line-clamp-2 flex-1'>
						{entry.title}
					</h3>
					<button
						onClick={handleDelete}
						disabled={isDeleting}
						className='opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 hover:bg-red-50 active:bg-red-100 rounded text-red-600 hover:text-red-700 shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed'
						title='Delete entry'
						aria-label='Delete journal entry'
					>
						{isDeleting ? (
							<div className='w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin'></div>
						) : (
							<Trash2 size={16} />
						)}
					</button>
				</div>

				{showDeleteConfirm && (
					<div
						onClick={(e) => e.stopPropagation()}
						className='mb-3 p-3 bg-red-50 border border-red-200 rounded-lg'
					>
						<p className='text-sm text-red-800 mb-2'>
							Are you sure you want to delete this entry?
						</p>
						<div className='flex gap-2'>
							<button
								onClick={handleDelete}
								disabled={isDeleting}
								className='text-xs px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1'
							>
								Delete
							</button>
							<button
								onClick={handleCancelDelete}
								className='text-xs px-3 py-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 active:bg-slate-400 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1'
							>
								Cancel
							</button>
						</div>
					</div>
				)}

				<p className='text-sm text-slate-600 line-clamp-3 mb-3'>
					{preview}
					{hasMore && '...'}
				</p>

				<div className='flex items-center gap-4 text-xs text-slate-500'>
					<div className='flex items-center gap-1.5'>
						<Calendar size={14} />
						<span>{formattedDate}</span>
					</div>
					{entry.images && entry.images.length > 0 && (
						<div className='flex items-center gap-1.5'>
							<ImageIcon size={14} />
							<span>{entry.images.length} image{entry.images.length !== 1 ? 's' : ''}</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}


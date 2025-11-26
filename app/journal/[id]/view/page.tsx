'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { JournalSidebar } from '@/components/journal/JournalSidebar';
import {
	getJournalEntry,
	type JournalEntry,
} from '@/utils/supabaseDatabase';
import { ArrowLeft, Edit, Calendar, Image as ImageIcon } from 'lucide-react';

export default function ViewJournalEntryPage() {
	const router = useRouter();
	const params = useParams();
	const entryId = params.id as string;
	const [entry, setEntry] = useState<JournalEntry | null>(null);
	const [isLoading, setIsLoading] = useState(true);

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

	const handleEdit = () => {
		router.push(`/journal/${entryId}/edit`);
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

	const date = new Date(entry.created_at);
	const formattedDate = date.toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	});
	const formattedTime = date.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
	});

	return (
		<ProtectedRoute>
			<div className='h-screen flex overflow-hidden bg-slate-50'>
				<JournalSidebar />
				<div className='flex-1 flex flex-col overflow-hidden'>
					{/* Header */}
					<div className='shrink-0 px-6 py-4 bg-white border-b border-slate-200'>
						<div className='flex items-center justify-between'>
							<button
								onClick={() => router.push('/journal')}
								className='flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors'
							>
								<ArrowLeft size={20} />
								<span className='text-sm font-medium'>Back</span>
							</button>
							<button
								onClick={handleEdit}
								className='flex items-center gap-2 cursor-pointer bg-[#191919] hover:bg-black text-white font-semibold py-2 px-4 rounded-lg transition-colors'
							>
								<Edit size={18} />
								<span>Edit</span>
							</button>
						</div>
					</div>

					{/* Content */}
					<div className='flex-1 overflow-y-auto p-6'>
						<div className='max-w-4xl mx-auto'>
							<div className='bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden'>
								{/* Title */}
								<div className='px-6 py-6 border-b border-slate-200 bg-slate-50'>
									<h1 className='text-3xl font-bold text-slate-800 mb-3'>
										{entry.title}
									</h1>
									<div className='flex items-center gap-4 text-sm text-slate-600'>
										<div className='flex items-center gap-1.5'>
											<Calendar size={16} />
											<span>
												{formattedDate} at {formattedTime}
											</span>
										</div>
										{entry.images && entry.images.length > 0 && (
											<div className='flex items-center gap-1.5'>
												<ImageIcon size={16} />
												<span>
													{entry.images.length} image{entry.images.length !== 1 ? 's' : ''}
												</span>
											</div>
										)}
									</div>
								</div>

								{/* Content */}
								<div className='px-6 py-6'>
									<div className='prose max-w-none'>
										<div 
										className='prose max-w-none text-slate-700 leading-relaxed'
										dangerouslySetInnerHTML={{ __html: entry.content }}
									/>
									<style jsx global>{`
										.prose ul {
											list-style-type: disc;
											padding-left: 1.5em;
										}
										.prose ol {
											list-style-type: decimal;
											padding-left: 1.5em;
										}
										.prose ul[data-type="taskList"] {
											list-style: none;
											padding: 0;
										}
										.prose ul[data-type="taskList"] li {
											display: flex;
											align-items: flex-start;
											margin-bottom: 0.25em;
										}
										.prose ul[data-type="taskList"] li > label {
											margin-right: 0.5em;
											user-select: none;
										}
										.prose ul[data-type="taskList"] li > div {
											flex: 1;
										}
										.prose h1 {
											font-size: 1.5em;
											font-weight: bold;
											margin-top: 0.5em;
											margin-bottom: 0.5em;
											color: #1e293b;
										}
										.prose h2 {
											font-size: 1.25em;
											font-weight: bold;
											margin-top: 0.5em;
											margin-bottom: 0.5em;
											color: #334155;
										}
										.prose blockquote {
											border-left: 3px solid #cbd5e1;
											padding-left: 1em;
											color: #475569;
											font-style: italic;
										}
										/* Checkbox styling */
										.prose input[type="checkbox"] {
											margin-top: 0.3em;
											cursor: default;
										}
									`}</style>
									</div>
								</div>

								{/* Images */}
								{entry.images && entry.images.length > 0 && (
									<div className='px-6 py-6 border-t border-slate-200'>
										<h3 className='text-lg font-semibold text-slate-800 mb-4'>
											Images
										</h3>
										<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
											{entry.images.map((imageUrl, index) => (
												<div
													key={index}
													className='relative aspect-video rounded-lg overflow-hidden border border-slate-200'
												>
													<img
														src={imageUrl}
														alt={`Image ${index + 1}`}
														className='w-full h-full object-cover'
													/>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</ProtectedRoute>
	);
}


'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Image as ImageIcon, X, Upload } from 'lucide-react';
import {
	type JournalEntry,
	type CreateJournalEntryInput,
	type UpdateJournalEntryInput,
	uploadJournalImage,
} from '@/utils/supabaseDatabase';

interface JournalEntryEditorProps {
	entry?: JournalEntry;
	onSave: (
		input: CreateJournalEntryInput | UpdateJournalEntryInput
	) => Promise<void>;
	onCancel: () => void;
	isSaving?: boolean;
}

export function JournalEntryEditor({
	entry,
	onSave,
	onCancel,
	isSaving = false,
}: JournalEntryEditorProps) {
	const [title, setTitle] = useState(entry?.title || '');
	const [content, setContent] = useState(entry?.content || '');
	const [images, setImages] = useState<string[]>(entry?.images || []);
	const [uploadingImages, setUploadingImages] = useState<string[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (entry) {
			setTitle(entry.title);
			setContent(entry.content);
			setImages(entry.images || []);
		}
	}, [entry]);

	const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		const newFiles = Array.from(files);
		const tempIds = newFiles.map(() => `temp-${Date.now()}-${Math.random()}`);
		setUploadingImages((prev) => [...prev, ...tempIds]);

		try {
			const uploadPromises = newFiles.map((file) =>
				uploadJournalImage(file, entry?.id)
			);
			const uploadedUrls = await Promise.all(uploadPromises);

			const successfulUploads = uploadedUrls.filter(
				(url): url is string => url !== null
			);

			setImages((prev) => [...prev, ...successfulUploads]);
		} catch (error) {
			console.error('Error uploading images:', error);
			alert('Failed to upload some images. Please try again.');
		} finally {
			setUploadingImages([]);
		}

		// Reset file input
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	};

	const handleRemoveImage = (index: number) => {
		setImages((prev) => prev.filter((_, i) => i !== index));
	};

	const handleSave = async () => {
		if (!title.trim()) {
			alert('Please enter a title');
			return;
		}

		if (entry) {
			await onSave({ title, content, images });
		} else {
			await onSave({ title, content, images });
		}
	};

	const canSave = title.trim().length > 0 && !isSaving;

	return (
		<div className='bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden'>
			{/* Header */}
			<div className='px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between'>
				<button
					onClick={onCancel}
					className='flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors'
				>
					<ArrowLeft size={20} />
					<span className='text-sm font-medium'>Back</span>
				</button>
				<div className='flex items-center gap-3'>
					<button
						onClick={handleSave}
						disabled={!canSave}
						className='bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors'
					>
						{isSaving ? 'Saving...' : 'Save'}
					</button>
				</div>
			</div>

			{/* Editor */}
			<div className='p-6 space-y-6'>
				{/* Title */}
				<div>
					<label className='block text-sm font-medium text-slate-700 mb-2'>
						Title
					</label>
					<input
						type='text'
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder='Enter journal entry title...'
						className='w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800'
					/>
				</div>

				{/* Content */}
				<div>
					<label className='block text-sm font-medium text-slate-700 mb-2'>
						Content
					</label>
					<textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder='Write your thoughts here...'
						rows={12}
						className='w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 resize-none'
					/>
				</div>

				{/* Images */}
				<div>
					<label className='block text-sm font-medium text-slate-700 mb-2'>
						Images
					</label>
					<div className='space-y-4'>
						{/* Image Upload Button */}
						<button
							type='button'
							onClick={() => fileInputRef.current?.click()}
							className='flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-colors w-full'
						>
							<Upload size={20} />
							<span>Upload Images</span>
						</button>
						<input
							ref={fileInputRef}
							type='file'
							accept='image/*'
							multiple
							onChange={handleImageUpload}
							className='hidden'
						/>

						{/* Image Preview Grid */}
						{images.length > 0 && (
							<div className='grid grid-cols-2 sm:grid-cols-3 gap-4'>
								{images.map((imageUrl, index) => (
									<div
										key={index}
										className='relative group aspect-square rounded-lg overflow-hidden border border-slate-200'
									>
										<img
											src={imageUrl}
											alt={`Upload ${index + 1}`}
											className='w-full h-full object-cover'
										/>
										<button
											onClick={() => handleRemoveImage(index)}
											className='absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700'
										>
											<X size={16} />
										</button>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}


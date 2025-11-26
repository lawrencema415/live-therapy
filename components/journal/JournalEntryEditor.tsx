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
		<div className='h-full w-full flex flex-col bg-white'>
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
						className='cursor-pointer bg-[#191919] hover:bg-black disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors'
					>
						{isSaving ? 'Saving...' : 'Save'}
					</button>
				</div>
			</div>

			{/* Editor */}
			<div className='flex-1 flex flex-col p-6 space-y-6 overflow-y-auto'>
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
				<div className='flex-1 flex flex-col'>
					<label className='block text-sm font-medium text-slate-700 mb-2'>
						Content
					</label>
					<textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder='Write your thoughts here...'
						className='w-full flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 resize-none'
					/>
				</div>

				{/* Images */}
				<div>
					<div className='flex items-center justify-between mb-2'>
						<label className='block text-sm font-medium text-slate-700'>
							Images
						</label>
						{(images.length > 0 || uploadingImages.length > 0) && (
							<span className='text-xs text-slate-500'>
								{images.length + uploadingImages.length} image{images.length + uploadingImages.length !== 1 ? 's' : ''}
							</span>
						)}
					</div>
					
					<div className='flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent'>
						{/* Upload Button */}
						<button
							type='button'
							onClick={() => fileInputRef.current?.click()}
							className='shrink-0 w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-colors bg-slate-50'
							title='Add images'
						>
							<Upload size={20} />
							<span className='text-xs font-medium'>Add</span>
						</button>
						<input
							ref={fileInputRef}
							type='file'
							accept='image/*'
							multiple
							onChange={handleImageUpload}
							className='hidden'
						/>

						{/* Uploading Placeholders */}
						{uploadingImages.map((id) => (
							<div
								key={id}
								className='shrink-0 w-24 h-24 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center'
							>
								<div className='w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin'></div>
							</div>
						))}

						{/* Image Previews */}
						{images.map((imageUrl, index) => (
							<div
								key={index}
								className='relative group shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-slate-200'
							>
								<img
									src={imageUrl}
									alt={`Upload ${index + 1}`}
									className='w-full h-full object-cover'
								/>
								<button
									onClick={() => handleRemoveImage(index)}
									className='absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm'
									title='Remove image'
								>
									<X size={12} />
								</button>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}


'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Image as ImageIcon, X, Upload, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, CheckSquare, Quote, Heading1, Heading2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import clsx from 'clsx';

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

const MenuBar = ({ editor }: { editor: any }) => {
	if (!editor) {
		return null;
	}

	return (
		<div className="flex flex-wrap gap-1 p-2">
			<button
				onClick={() => editor.chain().focus().toggleBold().run()}
				disabled={!editor.can().chain().focus().toggleBold().run()}
				className={clsx(
					"p-2 rounded hover:bg-slate-200 transition-colors",
					editor.isActive('bold') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'
				)}
				title="Bold"
			>
				<Bold size={18} />
			</button>
			<button
				onClick={() => editor.chain().focus().toggleItalic().run()}
				disabled={!editor.can().chain().focus().toggleItalic().run()}
				className={clsx(
					"p-2 rounded hover:bg-slate-200 transition-colors",
					editor.isActive('italic') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'
				)}
				title="Italic"
			>
				<Italic size={18} />
			</button>
			<button
				onClick={() => editor.chain().focus().toggleUnderline().run()}
				className={clsx(
					"p-2 rounded hover:bg-slate-200 transition-colors",
					editor.isActive('underline') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'
				)}
				title="Underline"
			>
				<UnderlineIcon size={18} />
			</button>
			<div className="w-px h-6 bg-slate-300 mx-1 self-center" />
			<button
				onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
				className={clsx(
					"p-2 rounded hover:bg-slate-200 transition-colors",
					editor.isActive('heading', { level: 1 }) ? 'bg-slate-200 text-slate-900' : 'text-slate-600'
				)}
				title="Heading 1"
			>
				<Heading1 size={18} />
			</button>
			<button
				onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
				className={clsx(
					"p-2 rounded hover:bg-slate-200 transition-colors",
					editor.isActive('heading', { level: 2 }) ? 'bg-slate-200 text-slate-900' : 'text-slate-600'
				)}
				title="Heading 2"
			>
				<Heading2 size={18} />
			</button>
			<div className="w-px h-6 bg-slate-300 mx-1 self-center" />
			<button
				onClick={() => editor.chain().focus().toggleBulletList().run()}
				className={clsx(
					"p-2 rounded hover:bg-slate-200 transition-colors",
					editor.isActive('bulletList') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'
				)}
				title="Bullet List"
			>
				<List size={18} />
			</button>
			<button
				onClick={() => editor.chain().focus().toggleOrderedList().run()}
				className={clsx(
					"p-2 rounded hover:bg-slate-200 transition-colors",
					editor.isActive('orderedList') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'
				)}
				title="Ordered List"
			>
				<ListOrdered size={18} />
			</button>
			<button
				onClick={() => editor.chain().focus().toggleTaskList().run()}
				className={clsx(
					"p-2 rounded hover:bg-slate-200 transition-colors",
					editor.isActive('taskList') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'
				)}
				title="Task List"
			>
				<CheckSquare size={18} />
			</button>
			<div className="w-px h-6 bg-slate-300 mx-1 self-center" />
			<button
				onClick={() => editor.chain().focus().toggleBlockquote().run()}
				className={clsx(
					"p-2 rounded hover:bg-slate-200 transition-colors",
					editor.isActive('blockquote') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'
				)}
				title="Quote"
			>
				<Quote size={18} />
			</button>
		</div>
	)
}

interface DatePickerProps {
	date: Date;
	onChange: (date: Date) => void;
	onClose: () => void;
}

// Helper to get days for the custom calendar
const getCalendarDays = (year: number, month: number) => {
	const firstDay = new Date(year, month, 1);
	const lastDay = new Date(year, month + 1, 0);
	const daysInMonth = lastDay.getDate();
	const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

	const days: (Date | null)[] = [];

	// Add empty slots for previous month days
	for (let i = 0; i < startingDayOfWeek; i++) {
		days.push(null);
	}

	// Add days of current month
	for (let i = 1; i <= daysInMonth; i++) {
		days.push(new Date(year, month, i));
	}

	return days;
};

const DatePicker = ({ date, onChange, onClose }: DatePickerProps) => {
	const [selectedDate, setSelectedDate] = useState(date);
	// We use viewDate to track which month is currently being viewed, independent of selection
	const [viewDate, setViewDate] = useState(date);
	
	const [hour, setHour] = useState(date.getHours() % 12 || 12);
	const [minute, setMinute] = useState(date.getMinutes());
	const [ampm, setAmpm] = useState(date.getHours() >= 12 ? 'PM' : 'AM');
	const calendarRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
				onClose();
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [onClose]);

	const days = getCalendarDays(viewDate.getFullYear(), viewDate.getMonth());
	const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

	const handleDateSelect = (day: Date) => {
		const newDate = new Date(day);
		newDate.setHours(selectedDate.getHours());
		newDate.setMinutes(selectedDate.getMinutes());
		setSelectedDate(newDate);
		onChange(newDate);
	};

	const navigateMonth = (direction: number) => {
		const newViewDate = new Date(viewDate);
		newViewDate.setMonth(newViewDate.getMonth() + direction);
		setViewDate(newViewDate);
	};

	const updateTime = (h: number, m: number, ap: string) => {
		let newHour = h;
		if (ap === 'PM' && h !== 12) newHour += 12;
		if (ap === 'AM' && h === 12) newHour = 0;

		const newDate = new Date(selectedDate);
		newDate.setHours(newHour);
		newDate.setMinutes(m);
		setSelectedDate(newDate);
		onChange(newDate);
	};

	const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		let val = parseInt(e.target.value);
		if (isNaN(val)) return;
		if (val < 1) val = 1;
		if (val > 12) val = 12;
		setHour(val);
		updateTime(val, minute, ampm);
	};

	const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		let val = parseInt(e.target.value);
		if (isNaN(val)) return;
		if (val < 0) val = 0;
		if (val > 59) val = 59;
		setMinute(val);
		updateTime(hour, val, ampm);
	};

	const toggleAmpm = () => {
		const newAmpm = ampm === 'AM' ? 'PM' : 'AM';
		setAmpm(newAmpm);
		updateTime(hour, minute, newAmpm);
	};

	const setToYesterday = () => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		yesterday.setHours(selectedDate.getHours());
		yesterday.setMinutes(selectedDate.getMinutes());
		setSelectedDate(yesterday);
		setViewDate(yesterday); // Construct view to yesterday too
		onChange(yesterday);
	};

	return (
		<div ref={calendarRef} className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-black rounded-xl shadow-xl p-4 z-50 w-[320px] text-slate-800 animate-in fade-in zoom-in duration-200">
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<button 
					onClick={() => navigateMonth(-1)}
					className="text-slate-500 hover:text-black p-1 hover:bg-slate-100 rounded transition-colors"
				>
					<ChevronLeft size={16} />
				</button>
				<span className="font-semibold text-slate-900">
					{viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
				</span>
				<button 
					onClick={() => navigateMonth(1)}
					className="text-slate-500 hover:text-black p-1 hover:bg-slate-100 rounded transition-colors"
				>
					<ChevronRight size={16} />
				</button>
			</div>

			{/* Custom Calendar Grid */}
			<div className="mb-4">
				{/* Weekdays */}
				<div className="grid grid-cols-7 mb-2">
					{weekDays.map((day, i) => (
						<div key={i} className="text-center text-xs font-bold text-slate-500 py-1">
							{day}
						</div>
					))}
				</div>
				
				{/* Days */}
				<div className="grid grid-cols-7 gap-1">
					{days.map((day, i) => {
						if (!day) return <div key={`empty-${i}`} />;
						
						const isSelected = day.getDate() === selectedDate.getDate() && 
										 day.getMonth() === selectedDate.getMonth() && 
										 day.getFullYear() === selectedDate.getFullYear();
						
						const isToday = day.getDate() === new Date().getDate() && 
										day.getMonth() === new Date().getMonth() &&
										day.getFullYear() === new Date().getFullYear();

						return (
							<button
								key={i}
								onClick={() => handleDateSelect(day)}
								className={clsx(
									"w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all mx-auto relative", // Added relative
									isSelected 
										? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/30" 
										: isToday 
											? "border border-blue-600 text-blue-700 font-bold"
											: "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
								)}
							>
								{day.getDate()}
							</button>
						);
					})}
				</div>
			</div>

			{/* Time Selection */}
			<div className="mb-4 pt-4 border-t border-slate-100">
				<label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Time</label>
				<div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
					<input
						type="number"
						value={hour.toString().padStart(2, '0')}
						onChange={handleHourChange}
						className="w-12 bg-transparent text-center text-slate-900 focus:outline-none font-mono"
					/>
					<span className="text-slate-400 font-bold">:</span>
					<input
						type="number"
						value={minute.toString().padStart(2, '0')}
						onChange={handleMinuteChange}
						className="w-12 bg-transparent text-center text-slate-900 focus:outline-none font-mono"
					/>
					<button
						onClick={toggleAmpm}
						className="ml-auto px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
					>
						{ampm}
					</button>
				</div>
			</div>

			{/* Footer */}
			<div className="flex items-center justify-between pt-3 border-t border-slate-100">
				<button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-800 transition-colors">
					Close
				</button>
				<button
					onClick={setToYesterday}
					className="text-xs text-blue-600 hover:text-blue-700 transition-colors font-medium"
				>
					Set to Yesterday
				</button>
			</div>
		</div>
	);
};


export function JournalEntryEditor({
	entry,
	onSave,
	onCancel,
	isSaving = false,
}: JournalEntryEditorProps) {
	const [title, setTitle] = useState(entry?.title || '');
	const [images, setImages] = useState<string[]>(entry?.images || []);
	const [uploadingImages, setUploadingImages] = useState<string[]>([]);
	const [date, setDate] = useState(entry?.created_at ? new Date(entry.created_at) : new Date());
	const [showDatePicker, setShowDatePicker] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Force re-render on editor updates to keep toolbar state in sync
	const [, forceUpdate] = useState({});

	const editor = useEditor({
		immediatelyRender: false,
		extensions: [
			StarterKit,
			Underline,
			TaskList,
			TaskItem.configure({
				nested: true,
			}),
			Placeholder.configure({
				placeholder: 'Write your thoughts here...',
			}),
		],
		content: entry?.content || '',
		editorProps: {
			attributes: {
				class: 'prose prose-slate max-w-none focus:outline-none min-h-[300px] text-slate-900 placeholder:text-slate-400',
			},
		},
		onUpdate: ({ editor }) => {
			// Update content state if needed, but we pull from editor.getHTML() on save
			// forceUpdate({}); // Optional: if we wanted to sync content state in real-time
		},
		onSelectionUpdate: () => {
			forceUpdate({});
		},
		onTransaction: () => {
			forceUpdate({});
		},
	});

	useEffect(() => {
		if (entry) {
			setTitle(entry.title);
			setImages(entry.images || []);
			setDate(entry.created_at ? new Date(entry.created_at) : new Date());
			// Only update content if it's different to avoid cursor jumping
			if (editor && entry.content !== editor.getHTML()) {
				editor.commands.setContent(entry.content);
			}
		}
	}, [entry, editor]);

	const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		// Only take the first file since we only allow one thumbnail
		const file = files[0];
		const tempId = `temp-${Date.now()}`;
		setUploadingImages([tempId]);

		try {
			const uploadedUrl = await uploadJournalImage(file, entry?.id);

			if (uploadedUrl) {
				// Replace any existing image with the new one
				setImages([uploadedUrl]);
			}
		} catch (error) {
			console.error('Error uploading image:', error);
			alert('Failed to upload image. Please try again.');
		} finally {
			setUploadingImages([]);
		}

		// Reset file input
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	};

	const handleRemoveImage = () => {
		setImages([]);
	};

	const handleSave = async () => {
		if (!title.trim()) {
			alert('Please enter a title');
			return;
		}

		const content = editor?.getHTML() || '';

		if (entry) {
			await onSave({ title, content, images, created_at: date.toISOString() });
		} else {
			await onSave({ title, content, images, created_at: date.toISOString() });
		}
	};

	const canSave = title.trim().length > 0 && !isSaving;

	const formattedDate = date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});

	return (
		<div className='h-full w-full flex flex-col bg-white'>
			{/* Header */}
			<div className='px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between relative z-20'>
				<button
					onClick={onCancel}
					className='cursor-pointer flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors cursor-pointer'
				>
					<ArrowLeft size={20} />
					<span className='text-sm font-medium'>Back</span>
				</button>
				
				{/* Date Display */}
				<div className="absolute left-1/2 -translate-x-1/2">
					<button 
						onClick={() => setShowDatePicker(!showDatePicker)}
						className={clsx(
							"text-sm font-medium transition-colors px-2 py-1 rounded-md",
							showDatePicker 
								? "text-slate-900 bg-slate-100 ring-1 ring-slate-900/10" 
								: "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
						)}
					>
						{formattedDate}
					</button>
					{showDatePicker && (
						<DatePicker 
							date={date} 
							onChange={setDate} 
							onClose={() => setShowDatePicker(false)} 
						/>
					)}
				</div>

				<div className='flex items-center gap-3'>
					{/* Thumbnail Upload */}
					<div className='flex items-center gap-2'>
						{uploadingImages.length > 0 ? (
							<div className='w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center'>
								<div className='w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin'></div>
							</div>
						) : images.length > 0 ? (
							<div className='relative group'>
								<img
									src={images[0]}
									alt='Thumbnail'
									className='w-10 h-10 rounded-lg object-cover border border-slate-200'
								/>
								<button
									onClick={handleRemoveImage}
									className='absolute -top-1 -right-1 p-0.5 bg-red-600 hover:bg-red-700 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer'
									title='Remove thumbnail'
								>
									<X size={12} />
								</button>
							</div>
						) : (
							<button
								type='button'
								onClick={() => fileInputRef.current?.click()}
								className='w-10 h-10 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 hover:border-blue-500 hover:text-blue-600 transition-colors bg-white cursor-pointer'
								title='Add thumbnail'
							>
								<ImageIcon size={18} />
							</button>
						)}
						<input
							ref={fileInputRef}
							type='file'
							accept='image/*'
							onChange={handleImageUpload}
							className='hidden'
						/>
					</div>
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
			<div className='flex-1 flex flex-col overflow-hidden'>
				{/* Title Input */}
				<div className='px-6 pt-6 pb-2'>
					<input
						type='text'
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder='Title...'
						className='w-full px-4 py-2 text-xl font-semibold border-none focus:outline-none focus:ring-0 placeholder:text-slate-400 text-slate-800'
					/>
				</div>

				{/* Toolbar */}
				<div className='px-6 border-b border-slate-100 sticky top-0 z-10 bg-white/80 backdrop-blur-sm'>
					<MenuBar editor={editor} />
				</div>

				{/* Tiptap Editor */}
				<div className='flex-1 overflow-y-auto px-6 py-6'>
					<div className='max-w-3xl mx-auto w-full h-full'>
						<EditorContent editor={editor} className='h-full' />
					</div>
				</div>
			</div>
			
			<style jsx global>{`
				.ProseMirror {
					min-height: 100%;
				}
				.ProseMirror:focus {
					outline: none;
				}
				.ProseMirror p.is-editor-empty:first-child::before {
					color: #cbd5e1;
					content: attr(data-placeholder);
					float: left;
					height: 0;
					pointer-events: none;
				}
				/* ... existing styles ... */
				.ProseMirror ul {
					list-style-type: disc;
					padding-left: 1.5em;
				}
				.ProseMirror ol {
					list-style-type: decimal;
					padding-left: 1.5em;
				}
				.ProseMirror ul[data-type="taskList"] {
					list-style: none;
					padding: 0;
				}
				.ProseMirror ul[data-type="taskList"] li {
					display: flex;
					align-items: flex-start;
					margin-bottom: 0.5em;
				}
				.ProseMirror ul[data-type="taskList"] li > label {
					margin-right: 0.5em;
					user-select: none;
					margin-top: 0.1em;
				}
				.ProseMirror ul[data-type="taskList"] li > div {
					flex: 1;
				}
				.ProseMirror h1 {
					font-size: 1.875em;
					font-weight: 800;
					margin-top: 1.5em;
					margin-bottom: 0.75em;
					line-height: 1.2;
					color: #1e293b;
				}
				.ProseMirror h2 {
					font-size: 1.5em;
					font-weight: 700;
					margin-top: 1.25em;
					margin-bottom: 0.5em;
					line-height: 1.3;
					color: #334155;
				}
				.ProseMirror p {
					margin-bottom: 1em;
					line-height: 1.75;
				}
				.ProseMirror blockquote {
					border-left: 4px solid #e2e8f0;
					padding-left: 1em;
					margin-left: 0;
					margin-right: 0;
					font-style: italic;
					color: #64748b;
				}
			`}</style>
		</div>
	);
}


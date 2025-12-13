'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { JournalEntry } from '@/utils/supabaseDatabase';

interface CustomCalendarProps {
	entries: JournalEntry[];
	onDateClick?: (date: Date) => void;
}


export function CustomCalendar({ entries, onDateClick }: CustomCalendarProps) {
	const router = useRouter();
	const [currentDate, setCurrentDate] = useState(new Date());

	// Group entries by date
	const entriesByDate = useMemo(() => {
		const map = new Map<string, JournalEntry[]>();

		entries.forEach((entry) => {
			const dateKey = new Date(entry.created_at).toDateString();
			const existing = map.get(dateKey) || [];
			existing.push(entry);
			// Sort by creation time (newest first)
			existing.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
			map.set(dateKey, existing);
		});

		return map;
	}, [entries]);

	const handleDateClick = (date: Date) => {
		const dateKey = date.toDateString();
		const dailyEntries = entriesByDate.get(dateKey);

		if (!dailyEntries || dailyEntries.length === 0) return;

		if (onDateClick) {
			onDateClick(date);
		} else {
			// Use local date components to avoid timezone issues
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const dateString = `${year}-${month}-${day}`;
			router.push(`/journal/date/${dateString}`);
		}
	};

	const navigateMonth = (direction: number) => {
		setCurrentDate((prev) => {
			const newDate = new Date(prev);
			newDate.setMonth(prev.getMonth() + direction);
			return newDate;
		});
	};

	const navigateYear = (direction: number) => {
		setCurrentDate((prev) => {
			const newDate = new Date(prev);
			newDate.setFullYear(prev.getFullYear() + direction);
			return newDate;
		});
	};

	const getDaysInMonth = (date: Date) => {
		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const daysInMonth = lastDay.getDate();
		const startingDayOfWeek = firstDay.getDay();

		const days: (Date | null)[] = [];

		// Add empty cells for days before the first day of the month
		for (let i = 0; i < startingDayOfWeek; i++) {
			days.push(null);
		}

		// Add all days of the month
		for (let day = 1; day <= daysInMonth; day++) {
			days.push(new Date(year, month, day));
		}

		return days;
	};

	const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
	const days = getDaysInMonth(currentDate);
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	// Calculate number of weeks to determine row height distribution
	const totalDays = days.length;
	const weeks = Math.ceil(totalDays / 7);

	return (
		<div className='w-full h-full flex flex-col min-h-0 overflow-hidden'>
			{/* Navigation */}
			<div className='flex items-center justify-between mb-3 flex-shrink-0'>
				<div className='flex items-center gap-2'>
					<button
						onClick={() => navigateYear(-1)}
						className='p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer'
						aria-label='Previous year'
					>
						<ChevronsLeft size={20} />
					</button>
					<button
						onClick={() => navigateMonth(-1)}
						className='p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer'
						aria-label='Previous month'
					>
						<ChevronLeft size={20} />
					</button>
				</div>
				<h2 className='text-lg font-semibold text-slate-800'>{monthName}</h2>
				<div className='flex items-center gap-2'>
					<button
						onClick={() => navigateMonth(1)}
						className='p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer'
						aria-label='Next month'
					>
						<ChevronRight size={20} />
					</button>
					<button
						onClick={() => navigateYear(1)}
						className='p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer'
						aria-label='Next year'
					>
						<ChevronsRight size={20} />
					</button>
				</div>
			</div>

			{/* Weekday Headers */}
			<div className='grid grid-cols-7 gap-4 mb-2 flex-shrink-0 px-1'>
				{weekDays.map((day) => (
					<div
						key={day}
						className='text-center text-xs font-semibold text-slate-500 uppercase tracking-wider'
					>
						{day}
					</div>
				))}
			</div>

			{/* Calendar Grid */}
			<div 
				className='grid grid-cols-7 gap-2 flex-1 min-h-0 p-1'
				style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
			>
				{days.map((date, index) => {
					if (!date) {
						return <div key={`empty-${index}`} className='min-h-0' />;
					}

					const dateKey = date.toDateString();
					const dailyEntries = entriesByDate.get(dateKey);
					const isToday = date.toDateString() === today.toDateString();
					const isWeekend = date.getDay() === 0 || date.getDay() === 6;
					const hasEntries = dailyEntries && dailyEntries.length > 0;

					// Find the first entry with a thumbnail
					const entryWithThumbnail = dailyEntries?.find(e => e.images && e.images.length > 0);
					const thumbnail = entryWithThumbnail?.images[0];

					return (
						<button
							key={dateKey}
							onClick={() => handleDateClick(date)}
							disabled={!hasEntries}
							className={`
								relative rounded-xl border transition-all duration-300 w-full h-full
								${isToday ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10' : 'border-slate-200 shadow-sm hover:shadow-md'}
								${hasEntries ? 'cursor-pointer hover:border-blue-300 hover:-translate-y-0.5' : 'cursor-default'}
								${!thumbnail && hasEntries ? 'bg-white hover:bg-slate-50' : 'bg-white'}
								${!thumbnail && !hasEntries && 'bg-slate-50/50 opacity-60'}
								flex flex-col items-start justify-start p-2 overflow-hidden group
							`}
							aria-label={`${date.toLocaleDateString()}${hasEntries ? ` - ${dailyEntries.length} entries` : ''}`}
						>
							{/* Background Thumbnail */}
							{thumbnail && (
								<div className="absolute inset-0 z-0">
									<img
										src={thumbnail}
										alt="Day thumbnail"
										className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
									/>
									<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30 group-hover:bg-black/50 transition-colors duration-300" />
								</div>
							)}

							{/* Content Container */}
							<div className="relative z-10 w-full h-full flex flex-col pointer-events-none">
								{/* Date Number */}
								<div className="flex justify-between items-start w-full mb-1">
									<span className={`
										text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full shrink-0 transition-colors
										${thumbnail ? 'text-white' : (isToday ? 'bg-blue-600 text-white' : (isWeekend ? 'text-red-500' : 'text-slate-700'))}
									`}>
										{date.getDate()}
									</span>
								</div>
								
								{/* Entries List - Flexible Spacer puts this at bottom or top depending on preference, 
								    but keeping it normally flowed is standard. Using flex-1 to push down if needed, 
									but currently simpler to just flow.
								*/}
								{hasEntries && (
									<div className="w-full flex flex-col gap-1 overflow-hidden pointer-events-auto">
										{dailyEntries.slice(0, 2).map((entry) => (
											<div 
												key={entry.id} 
												className={`
													text-[10px] sm:text-xs truncate w-full px-2 py-0.5 rounded-md font-medium transition-colors text-left
													${thumbnail ? 'text-white/95 bg-white/15 backdrop-blur-sm border border-white/10' : 'text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200'}
												`}
											>
												{entry.title || 'Untitled'}
											</div>
										))}
										{dailyEntries.length > 2 && (
											<div className={`
												text-[10px] font-semibold px-1 text-left
												${thumbnail ? 'text-white/70' : 'text-slate-400'}
											`}>
												+{dailyEntries.length - 2} more
											</div>
										)}
									</div>
								)}
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}


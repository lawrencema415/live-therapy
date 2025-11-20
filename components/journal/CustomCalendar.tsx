'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { JournalEntry } from '@/utils/supabaseDatabase';

interface CustomCalendarProps {
	entries: JournalEntry[];
	onDateClick?: (date: Date) => void;
}

interface DateEntry {
	date: Date;
	entry: JournalEntry;
	thumbnail?: string;
}

export function CustomCalendar({ entries, onDateClick }: CustomCalendarProps) {
	const router = useRouter();
	const [currentDate, setCurrentDate] = useState(new Date());

	// Group entries by date and get latest entry with thumbnail for each date
	const entriesByDate = useMemo(() => {
		const map = new Map<string, DateEntry>();

		entries.forEach((entry) => {
			const entryDate = new Date(entry.created_at);
			const dateKey = entryDate.toDateString();

			const thumbnail = entry.images && entry.images.length > 0 ? entry.images[0] : undefined;

			const existing = map.get(dateKey);
			if (!existing || new Date(entry.created_at) > new Date(existing.entry.created_at)) {
				map.set(dateKey, {
					date: entryDate,
					entry,
					thumbnail,
				});
			}
		});

		return map;
	}, [entries]);

	const handleDateClick = (date: Date) => {
		const dateKey = date.toDateString();
		const hasEntries = entriesByDate.has(dateKey);

		if (!hasEntries) return;

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

	return (
		<div className='w-full h-full flex flex-col min-h-0 overflow-hidden'>
			{/* Navigation */}
			<div className='flex items-center justify-between mb-3 flex-shrink-0'>
				<div className='flex items-center gap-2'>
					<button
						onClick={() => navigateYear(-1)}
						className='p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer'
						aria-label='Previous year'
					>
						<ChevronsLeft size={20} />
					</button>
					<button
						onClick={() => navigateMonth(-1)}
						className='p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer'
						aria-label='Previous month'
					>
						<ChevronLeft size={20} />
					</button>
				</div>
				<h2 className='text-lg font-semibold text-slate-800'>{monthName}</h2>
				<div className='flex items-center gap-2'>
					<button
						onClick={() => navigateMonth(1)}
						className='p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer'
						aria-label='Next month'
					>
						<ChevronRight size={20} />
					</button>
					<button
						onClick={() => navigateYear(1)}
						className='p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer'
						aria-label='Next year'
					>
						<ChevronsRight size={20} />
					</button>
				</div>
			</div>

			{/* Weekday Headers */}
			<div className='grid grid-cols-7 gap-1 mb-2 flex-shrink-0'>
				{weekDays.map((day) => (
					<div
						key={day}
						className='text-center text-xs font-semibold text-slate-600 py-1'
					>
						{day}
					</div>
				))}
			</div>

			{/* Calendar Grid */}
			<div className='grid grid-cols-7 gap-1 flex-1 min-h-0 overflow-hidden'>
				{days.map((date, index) => {
					if (!date) {
						return <div key={`empty-${index}`} className='min-h-0' />;
					}

					const dateKey = date.toDateString();
					const dateEntry = entriesByDate.get(dateKey);
					const isToday = date.toDateString() === today.toDateString();
					const isWeekend = date.getDay() === 0 || date.getDay() === 6;
					const hasEntry = entriesByDate.has(dateKey);

					return (
						<button
							key={dateKey}
							onClick={() => handleDateClick(date)}
							disabled={!hasEntry}
							className={`
								relative rounded-lg border transition-all duration-200
								${isToday ? 'bg-blue-100 border-blue-300' : 'bg-white border-slate-200'}
								${hasEntry ? 'hover:bg-blue-50 hover:border-blue-300 cursor-pointer' : 'cursor-default opacity-50'}
								${isWeekend ? 'text-red-600' : 'text-slate-800'}
								flex flex-col items-center justify-start p-1 overflow-hidden
								min-h-0
							`}
							style={{ aspectRatio: '1' }}
							aria-label={`${date.toLocaleDateString()}${hasEntry ? ' - Has entries' : ''}`}
						>
							<span className={`text-xs sm:text-sm font-medium z-10 ${isToday ? 'text-blue-700' : ''}`}>
								{date.getDate()}
							</span>
							{dateEntry?.thumbnail && (
								<div className='w-full flex-1 min-h-0 mt-0.5 rounded overflow-hidden border border-slate-200'>
									<img
										src={dateEntry.thumbnail}
										alt={dateEntry.entry.title}
										className='w-full h-full object-cover'
									/>
								</div>
							)}
							{dateEntry && !dateEntry.thumbnail && (
								<div className='w-2 h-2 bg-blue-500 rounded-full mt-1'></div>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}


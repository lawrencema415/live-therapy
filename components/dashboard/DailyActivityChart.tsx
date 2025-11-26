'use client';

import { useState, useEffect } from 'react';
import { getUserActivityData, type ActivityData } from '@/utils/supabaseDatabase';
import { Info } from 'lucide-react';

export function DailyActivityChart() {
	const [activityData, setActivityData] = useState<Map<string, ActivityData>>(new Map());
	const [isLoading, setIsLoading] = useState(true);

	// Calculate date range (last 365 days)
	const today = new Date();
	const startDate = new Date(today);
	startDate.setDate(today.getDate() - 365);

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		setIsLoading(true);
		try {
			const data = await getUserActivityData(startDate, today);
			const map = new Map<string, ActivityData>();
			data.forEach(item => map.set(item.date, item));
			setActivityData(map);
		} catch (error) {
			console.error('Error loading activity data:', error);
		} finally {
			setIsLoading(false);
		}
	};

	// Generate calendar grid
	const weeks: Date[][] = [];
	let currentWeek: Date[] = [];
	
	// Align start date to the previous Sunday (or Monday depending on preference)
	// Let's align to Sunday for standard calendar view
	const calendarStart = new Date(startDate);
	const dayOfWeek = calendarStart.getDay(); // 0 = Sunday
	calendarStart.setDate(calendarStart.getDate() - dayOfWeek);

	const currentDate = new Date(calendarStart);
	
	// Generate weeks until we reach today
	while (currentDate <= today) {
		if (currentWeek.length === 7) {
			weeks.push(currentWeek);
			currentWeek = [];
		}
		currentWeek.push(new Date(currentDate));
		currentDate.setDate(currentDate.getDate() + 1);
	}
	// Push last partial week
	if (currentWeek.length > 0) {
		weeks.push(currentWeek);
	}

	// Color scale based on level (0-4)
	const getColor = (level: number) => {
		switch (level) {
			case 1: return 'bg-blue-200';
			case 2: return 'bg-blue-400';
			case 3: return 'bg-blue-600';
			case 4: return 'bg-blue-800';
			default: return 'bg-slate-100';
		}
	};

	const getTooltip = (date: Date, data?: ActivityData) => {
		const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		if (!data || data.count === 0) return `No check-ins on ${dateStr}`;
		
		const parts = [];
		if (data.sessionCount > 0) parts.push(`${data.sessionCount} session${data.sessionCount !== 1 ? 's' : ''}`);
		if (data.journalCount > 0) parts.push(`${data.journalCount} journal${data.journalCount !== 1 ? 's' : ''}`);
		
		return `${parts.join(', ')} on ${dateStr}`;
	};

	if (isLoading) {
		return (
			<div className='w-full h-40 bg-slate-50 rounded-xl animate-pulse flex items-center justify-center'>
				<span className='text-slate-400 text-sm'>Loading activity...</span>
			</div>
		);
	}

	return (
		<div className='bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-x-auto'>
			<div className='flex items-center gap-2 mb-4'>
				<h3 className='text-lg font-semibold text-slate-800'>Check Ins</h3>
				<div className='relative group'>
					<Info size={16} className='text-slate-400 cursor-help' />
					<div className='absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 w-max text-center'>
						Therapy sessions and journal entries<br/>count as check-ins
						<div className='absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-slate-800'></div>
					</div>
				</div>
			</div>
			
			<div className='flex gap-1 min-w-max'>
				{/* Day labels */}
				<div className='flex flex-col gap-1 pt-5 pr-2 text-xs text-slate-400 font-medium'>
					<div className='h-3'></div> {/* Sun */}
					<div className='h-3 leading-3'>Mon</div>
					<div className='h-3'></div> {/* Tue */}
					<div className='h-3 leading-3'>Wed</div>
					<div className='h-3'></div> {/* Thu */}
					<div className='h-3 leading-3'>Fri</div>
					<div className='h-3'></div> {/* Sat */}
				</div>

				{/* Weeks */}
				{weeks.map((week, weekIndex) => (
					<div key={weekIndex} className='flex flex-col gap-1'>
						{/* Month label (only show for first week of month) */}
						<div className='h-4 text-xs text-slate-400 mb-1'>
							{week[0].getDate() <= 7 && (
								<span>{week[0].toLocaleDateString('en-US', { month: 'short' })}</span>
							)}
						</div>
						
						{/* Days */}
						{week.map((date, dayIndex) => {
							const dateStr = date.toISOString().split('T')[0];
							const data = activityData.get(dateStr);
							const count = data?.count || 0;
							const level = data?.level || 0;

							return (
								<div
									key={dateStr}
									className={`w-3 h-3 rounded-sm ${getColor(level)} transition-colors hover:ring-2 hover:ring-slate-300 hover:z-10 relative group cursor-default`}
								>
									{/* Tooltip */}
									<div className='absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20'>
										{getTooltip(date, data)}
										<div className='absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800'></div>
									</div>
								</div>
							);
						})}
					</div>
				))}
			</div>
			
			{/* Legend */}
			<div className='flex items-center justify-end gap-2 mt-4 text-xs text-slate-500'>
				<span>Less</span>
				<div className='flex gap-1'>
					<div className='w-3 h-3 rounded-sm bg-slate-100'></div>
					<div className='w-3 h-3 rounded-sm bg-blue-200'></div>
					<div className='w-3 h-3 rounded-sm bg-blue-400'></div>
					<div className='w-3 h-3 rounded-sm bg-blue-600'></div>
					<div className='w-3 h-3 rounded-sm bg-blue-800'></div>
				</div>
				<span>More</span>
			</div>
		</div>
	);
}

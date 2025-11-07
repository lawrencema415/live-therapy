/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import {
	ComposedChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from 'recharts';

interface MoodTrend {
	date: string;
	dateOnly: string;
	timestamp: number;
	preRating: number | null | undefined;
	postRating: number | null | undefined;
	change: number | null;
}

interface MoodTrendsChartProps {
	trends: MoodTrend[];
}

// Custom tooltip component - declared outside to prevent recreation on each render
const CustomTooltip = ({ active, payload }: any) => {
	if (active && payload && payload.length) {
		const data = payload[0].payload;
		return (
			<div className='bg-slate-900/95 backdrop-blur-sm p-4 border border-slate-700 rounded-xl shadow-2xl min-w-[200px]'>
				{/* <p className='text-xs font-semibold text-slate-300 mb-3'>
					{data.fullDate}
				</p> */}

				<div className='space-y-2.5'>
					{/* <div className='flex items-center justify-between gap-6'>
						<div className='flex items-center gap-2'>
							<div className='w-3 h-3 rounded-full bg-indigo-400' />
							<span className='text-xs text-slate-300'>Before</span>
						</div>
						<span className='text-sm font-bold text-white'>
							{data.before}/10
						</span>
					</div>

					<div className='flex items-center justify-center py-1'>
						<svg
							className='w-4 h-4 text-slate-500'
							fill='none'
							viewBox='0 0 24 24'
							stroke='currentColor'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M19 14l-7 7m0 0l-7-7m7 7V3'
							/>
						</svg>
					</div> */}

					<div className='flex items-center justify-between gap-6'>
						<div className='flex items-center gap-2'>
							<div className='w-3 h-3 rounded-full bg-emerald-400' />
							<span className='text-xs text-slate-300'>After</span>
						</div>
						<span className='text-sm font-bold text-white'>
							{data.after}/10
						</span>
					</div>
				</div>

				{data.change !== null && (
					<div className='mt-3 pt-3 border-t border-slate-700'>
						<div className='flex items-center justify-between'>
							<span className='text-xs text-slate-400'>Change</span>
							<div className='flex items-center gap-1.5'>
								{data.change > 0 && (
									<svg
										className='w-3.5 h-3.5 text-emerald-400'
										fill='currentColor'
										viewBox='0 0 20 20'
									>
										<path
											fillRule='evenodd'
											d='M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z'
											clipRule='evenodd'
										/>
									</svg>
								)}
								{data.change < 0 && (
									<svg
										className='w-3.5 h-3.5 text-red-400'
										fill='currentColor'
										viewBox='0 0 20 20'
									>
										<path
											fillRule='evenodd'
											d='M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z'
											clipRule='evenodd'
										/>
									</svg>
								)}
								<span
									className={`text-sm font-bold ${
										data.change > 0
											? 'text-emerald-400'
											: data.change < 0
											? 'text-red-400'
											: 'text-slate-400'
									}`}
								>
									{data.change > 0 ? '+' : ''}
									{data.change.toFixed(1)}
								</span>
							</div>
						</div>
					</div>
				)}
			</div>
		);
	}
	return null;
};

export function MoodTrendsChart({ trends }: MoodTrendsChartProps) {
	// Prepare data for chart - format dates and ensure ratings are numbers
	const chartData = trends.map((trend) => {
		const sessionDate = new Date(trend.timestamp);
		const dateLabel = sessionDate.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
		});
		const timeLabel = sessionDate.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
		});

		return {
			name: `${dateLabel} ${timeLabel}`,
			shortName: dateLabel,
			fullDate: trend.date,
			timestamp: trend.timestamp,
			before: trend.preRating ?? null,
			after: trend.postRating ?? null,
			change: trend.change,
		};
	});

	if (chartData.length === 0) {
		return (
			<div className='flex items-center justify-center h-64 text-slate-500'>
				<p className='text-sm'>No mood data available</p>
			</div>
		);
	}

	return (
		<div className='w-full h-64 sm:h-80 bg-linear-to-br from-slate-50 to-slate-100 rounded-xl p-4'>
			<ResponsiveContainer width='100%' height='100%'>
				<ComposedChart
					data={chartData}
					margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
				>
					<defs>
						<linearGradient id='changeGradient' x1='0' y1='0' x2='0' y2='1'>
							<stop offset='0%' stopColor='#10b981' stopOpacity={0.3} />
							<stop offset='100%' stopColor='#10b981' stopOpacity={0.05} />
						</linearGradient>
					</defs>
					<CartesianGrid strokeDasharray='3 3' stroke='#cbd5e1' opacity={0.5} />
					<XAxis
						dataKey='name'
						stroke='#475569'
						fontSize={11}
						angle={-45}
						textAnchor='end'
						height={80}
						tick={{ fill: '#475569', fontWeight: 500 }}
						axisLine={{ stroke: '#94a3b8', strokeWidth: 1.5 }}
					/>
					<YAxis
						domain={[0, 10]}
						stroke='#475569'
						fontSize={12}
						tick={{ fill: '#475569', fontWeight: 500 }}
						axisLine={{ stroke: '#94a3b8', strokeWidth: 1.5 }}
						label={{
							value: 'Mood Rating',
							angle: -90,
							position: 'insideLeft',
							style: {
								textAnchor: 'middle',
								fill: '#475569',
								fontWeight: 600,
								fontSize: 13,
							},
						}}
					/>
					<Tooltip
						content={<CustomTooltip />}
						cursor={{
							stroke: '#94a3b8',
							strokeWidth: 1.5,
							strokeDasharray: '5 5',
						}}
					/>
					<Legend
						wrapperStyle={{ paddingTop: '20px' }}
						formatter={(value) => (
							<span className='text-sm font-medium text-slate-700'>
								{value}
							</span>
						)}
					/>

					{/* Vertical lines connecting before and after */}
					{chartData.map((entry, index) => {
						if (entry.before === null || entry.after === null) return null;
						const isPositive = (entry.after || 0) > (entry.before || 0);
						return (
							<Line
								key={`connection-${index}`}
								type='linear'
								dataKey={(data) => {
									if (data === entry) {
										return [entry.before, entry.after];
									}
									return null;
								}}
								stroke={isPositive ? '#10b981' : '#ef4444'}
								strokeWidth={2}
								dot={false}
								connectNulls={false}
								legendType='none'
							/>
						);
					})}

					{/* Before dots */}
					{/* <Line
						type='monotone'
						dataKey='before'
						stroke='#6366f1'
						strokeWidth={0}
						name='Before Session'
						dot={{ fill: '#6366f1', r: 6, strokeWidth: 2, stroke: '#fff' }}
						activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff' }}
						connectNulls={false}
					/> */}

					{/* After dots */}
					<Line
						type='monotone'
						dataKey='after'
						stroke='#10b981'
						strokeWidth={0}
						name='After Session'
						dot={{ fill: '#10b981', r: 6, strokeWidth: 2, stroke: '#fff' }}
						activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff' }}
						connectNulls={false}
					/>
				</ComposedChart>
			</ResponsiveContainer>
		</div>
	);
}

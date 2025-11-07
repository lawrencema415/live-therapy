'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { capitalize } from 'lodash';
import type {
	SessionSummary,
	SessionMoodData,
} from '@/utils/userSessionStorage';
import {
	TrendingUp,
	Activity,
	ArrowLeft,
	ChevronDown,
	ChevronUp,
} from 'lucide-react';
import { MoodTrendsChart } from './MoodTrendsChart';

interface ProgressDashboardProps {
	userName: string;
	summaries: SessionSummary[];
	moodData: SessionMoodData[];
}

export function ProgressDashboard({
	userName,
	summaries,
	moodData,
}: ProgressDashboardProps) {
	const router = useRouter();
	const [isMoodTrendsOpen, setIsMoodTrendsOpen] = useState(false);

	// Calculate emotional state trends
	const emotionalTrends = useMemo(() => {
		const trends = summaries.map((summary, index) => ({
			date: new Date(summary.timestamp).toLocaleDateString(),
			timestamp: summary.timestamp,
			emotionalState: summary.emotionalState,
			index,
		}));

		return trends.sort((a, b) => a.timestamp - b.timestamp);
	}, [summaries]);

	// Calculate mood rating trends - show ALL sessions, not grouped by date
	const moodTrends = useMemo(() => {
		const trends = moodData
			.map((mood) => {
				const preRating = mood.preSession?.rating;
				const postRating = mood.postSession?.rating;
				const sessionDate = new Date(mood.sessionTimestamp);
				// Include time for same-day sessions to differentiate them
				const dateStr = sessionDate.toLocaleDateString();
				const timeStr = sessionDate.toLocaleTimeString([], {
					hour: '2-digit',
					minute: '2-digit',
				});
				// Use full date-time string to ensure uniqueness
				const displayDate = `${dateStr} ${timeStr}`;

				return {
					date: displayDate,
					dateOnly: dateStr, // Keep date-only for grouping if needed
					timestamp: mood.sessionTimestamp,
					preRating,
					postRating,
					change: postRating && preRating ? postRating - preRating : null,
				};
			})
			.filter((m) => m.preRating || m.postRating)
			.sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp to show chronological order

		return trends;
	}, [moodData]);

	// Calculate theme frequency
	const themeFrequency = useMemo(() => {
		const themeCounts: Record<string, number> = {};
		summaries.forEach((summary) => {
			summary.keyThemes.forEach((theme) => {
				themeCounts[theme] = (themeCounts[theme] || 0) + 1;
			});
		});

		return Object.entries(themeCounts)
			.map(([theme, count]) => ({ theme, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 10);
	}, [summaries]);

	// Calculate progress metrics
	const metrics = useMemo(() => {
		const totalSessions = summaries.length;
		const totalMoodCheckIns = moodData.length;
		const sessionsWithMoodChange = moodTrends.filter(
			(t) => t.change !== null && t.change > 0
		).length;
		const sessionsWithChange = moodTrends.filter((t) => t.change !== null);
		const averageMoodImprovement =
			sessionsWithChange.length > 0
				? sessionsWithChange.reduce((sum, t) => sum + (t.change || 0), 0) /
				  sessionsWithChange.length
				: null;

		return {
			totalSessions,
			totalMoodCheckIns,
			sessionsWithMoodChange,
			averageMoodImprovement:
				averageMoodImprovement !== null
					? averageMoodImprovement.toFixed(1)
					: null,
		};
	}, [summaries, moodData, moodTrends]);

	return (
		<div className='h-screen flex flex-col from-slate-50 to-slate-100 overflow-hidden'>
			{/* Header - Fixed */}
			<div className='shrink-0 px-4 sm:px-6 py-4 sm:py-6 bg-white border-b border-slate-200'>
				<div className='flex items-center gap-4'></div>
				<div className='flex flex-row space-x-1'>
					<h1 className='text-2xl sm:text-3xl font-bold text-slate-800'>
						Wellness Dashboard
					</h1>
					<button
						onClick={() => router.back()}
						className='flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors p-2 rounded-lg hover:cursor-pointer hover:bg-slate-100'
						aria-label='Go back'
					>
						<ArrowLeft size={20} />
						<span className='text-sm font-medium'>Back</span>
					</button>
				</div>
				<p className='text-sm sm:text-base text-slate-600 mt-1'>
					Welcome, {capitalize(userName)}
				</p>
			</div>

			{/* Main Content - Scrollable */}
			<div className='flex-1 overflow-y-auto'>
				<div className='max-w-7xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6'>
					{/* Metrics Cards */}
					<div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'>
						<div className='bg-white rounded-xl shadow-sm p-4 border border-slate-200 hover:shadow-md transition-shadow'>
							<div className='flex items-center gap-2 mb-2'>
								<div className='text-xs sm:text-sm text-slate-600'>
									Total Sessions
								</div>
							</div>
							<div className='text-2xl sm:text-3xl font-bold text-slate-800'>
								{metrics.totalSessions}
							</div>
						</div>

						<div className='bg-white rounded-xl shadow-sm p-4 border border-slate-200 hover:shadow-md transition-shadow'>
							<div className='flex items-center gap-2 mb-2'>
								<div className='text-xs sm:text-sm text-slate-600'>
									Mood Check-ins
								</div>
							</div>
							<div className='text-2xl sm:text-3xl font-bold text-slate-800'>
								{metrics.totalMoodCheckIns}
							</div>
						</div>

						<div className='bg-white rounded-xl shadow-sm p-4 border border-slate-200 hover:shadow-md transition-shadow'>
							<div className='flex items-center gap-2 mb-2'>
								<div className='text-xs sm:text-sm text-slate-600'>
									With Improvement
								</div>
							</div>
							<div className='text-2xl sm:text-3xl font-bold text-green-600'>
								{metrics.sessionsWithMoodChange}
							</div>
						</div>

						<div className='bg-white rounded-xl shadow-sm p-4 border border-slate-200 hover:shadow-md transition-shadow'>
							<div className='flex items-center gap-2 mb-2'>
								<div className='text-xs sm:text-sm text-slate-600'>
									Avg. Improvement
								</div>
							</div>
							<div className='text-2xl sm:text-3xl font-bold text-blue-600'>
								{metrics.averageMoodImprovement !== null ? (
									<>+{metrics.averageMoodImprovement}</>
								) : (
									<span className='text-slate-400 text-lg sm:text-xl'>—</span>
								)}
							</div>
						</div>
					</div>

					{/* Two Column Layout for Desktop, Stacked for Mobile */}
					<div className='grid lg:grid-cols-2 gap-4 sm:gap-6'>
						{/* Emotional State Timeline */}
						{emotionalTrends.length > 0 && (
							<div className='bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden'>
								<div className='shrink-0 px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50'>
									<div className='flex items-center gap-2'>
										<h2 className='text-base sm:text-lg font-bold text-slate-800'>
											Emotional State Over Time
										</h2>
									</div>
								</div>
								<div className='flex-1 overflow-y-auto p-4 sm:p-6 max-h-[400px]'>
									<div className='space-y-3'>
										{emotionalTrends.map((trend, index) => (
											<div
												key={index}
												className='flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors'
											>
												<div className='text-xs sm:text-sm text-slate-500 font-medium sm:min-w-[90px]'>
													{trend.date}
												</div>
												<div className='flex-1'>
													<p className='text-xs sm:text-sm text-slate-700 leading-relaxed'>
														{trend.emotionalState}
													</p>
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						)}

						{/* Theme Frequency */}
						{themeFrequency.length > 0 && (
							<div className='bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden'>
								<div className='shrink-0 px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50'>
									<div className='flex items-center gap-2'>
										<h2 className='text-base sm:text-lg font-bold text-slate-800'>
											Most Discussed Topics
										</h2>
									</div>
								</div>
								<div className='flex-1 overflow-y-auto p-4 sm:p-6 max-h-[400px]'>
									<div className='space-y-4'>
										{themeFrequency.map(({ theme, count }, index) => (
											<div key={index}>
												<div className='flex items-center justify-between mb-2'>
													<span className='text-xs sm:text-sm text-slate-700 font-medium truncate pr-2'>
														{theme}
													</span>
													<span className='text-xs text-slate-500 shrink-0'>
														{count} {count === 1 ? 'session' : 'sessions'}
													</span>
												</div>
												<div className='w-full bg-slate-100 rounded-full h-2'>
													<div
														className='bg-linear-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500'
														style={{
															width: `${
																(count /
																	Math.max(
																		...themeFrequency.map((t) => t.count)
																	)) *
																100
															}%`,
														}}
													/>
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Mood Trends - Full Width (Collapsible) */}
					{moodTrends.length > 0 && (
						<div className='bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden'>
							<button
								onClick={() => setIsMoodTrendsOpen(!isMoodTrendsOpen)}
								className='shrink-0 px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between w-full cursor-pointer'
							>
								<div className='flex items-center gap-2'>
									<TrendingUp size={18} className='text-slate-600' />
									<h2 className='text-base sm:text-lg font-bold text-slate-800'>
										Mood Trends
									</h2>
								</div>
								{isMoodTrendsOpen ? (
									<ChevronUp size={20} className='text-slate-600' />
								) : (
									<ChevronDown size={20} className='text-slate-600' />
								)}
							</button>
							{isMoodTrendsOpen && (
								<div className='flex-1 p-4 sm:p-6'>
									<MoodTrendsChart trends={moodTrends} />
								</div>
							)}
						</div>
					)}

					{/* Empty State */}
					{summaries.length === 0 && moodData.length === 0 && (
						<div className='bg-white rounded-xl shadow-sm border border-slate-200 p-8 sm:p-12 text-center'>
							<div className='w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center'>
								<Activity size={32} className='text-slate-400' />
							</div>
							<p className='text-sm sm:text-base text-slate-600 mb-2'>
								No progress data yet
							</p>
							<p className='text-xs sm:text-sm text-slate-500'>
								Start a therapy session to begin tracking your progress!
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

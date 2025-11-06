'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { capitalize } from 'lodash';
import type {
	SessionSummary,
	SessionMoodData,
} from '@/utils/userSessionStorage';
import { TrendingUp, Activity, ArrowLeft } from 'lucide-react';

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

	// Calculate mood rating trends
	const moodTrends = useMemo(() => {
		const trends = moodData
			.map((mood) => {
				const preRating = mood.preSession?.rating;
				const postRating = mood.postSession?.rating;
				return {
					date: new Date(mood.sessionTimestamp).toLocaleDateString(),
					timestamp: mood.sessionTimestamp,
					preRating,
					postRating,
					change: postRating && preRating ? postRating - preRating : null,
				};
			})
			.filter((m) => m.preRating || m.postRating)
			.sort((a, b) => a.timestamp - b.timestamp);

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
		const averageMoodImprovement =
			moodTrends.length > 0
				? moodTrends
						.filter((t) => t.change !== null)
						.reduce((sum, t) => sum + (t.change || 0), 0) /
				  moodTrends.filter((t) => t.change !== null).length
				: 0;

		return {
			totalSessions,
			totalMoodCheckIns,
			sessionsWithMoodChange,
			averageMoodImprovement: averageMoodImprovement.toFixed(1),
		};
	}, [summaries, moodData, moodTrends]);

	const getMoodColor = (rating: number | null | undefined): string => {
		if (!rating) return 'bg-gray-200';
		if (rating <= 3) return 'bg-red-500';
		if (rating <= 5) return 'bg-yellow-500';
		if (rating <= 7) return 'bg-blue-500';
		return 'bg-green-500';
	};

	return (
		<div className='h-screen flex flex-col from-slate-50 to-slate-100 overflow-hidden'>
			{/* Header - Fixed */}
			<div className='shrink-0 px-4 sm:px-6 py-4 sm:py-6 bg-white border-b border-slate-200'>
				<div className='flex items-center gap-4 mb-2'></div>
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
								+{metrics.averageMoodImprovement}
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

					{/* Mood Trends - Full Width */}
					{moodTrends.length > 0 && (
						<div className='bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden'>
							<div className='shrink-0 px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50'>
								<div className='flex items-center gap-2'>
									<TrendingUp size={18} className='text-slate-600' />
									<h2 className='text-base sm:text-lg font-bold text-slate-800'>
										Mood Trends
									</h2>
								</div>
							</div>
							<div className='flex-1 overflow-y-auto p-4 sm:p-6 max-h-[400px]'>
								<div className='space-y-4'>
									{moodTrends.map((trend, index) => (
										<div
											key={index}
											className='p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors'
										>
											<div className='flex items-center justify-between mb-3'>
												<span className='text-xs sm:text-sm font-medium text-slate-700'>
													{trend.date}
												</span>
												{trend.change !== null && (
													<span
														className={`text-xs sm:text-sm font-bold px-3 py-1 rounded-full ${
															trend.change > 0
																? 'bg-green-100 text-green-700'
																: trend.change < 0
																? 'bg-red-100 text-red-700'
																: 'bg-slate-100 text-slate-700'
														}`}
													>
														{trend.change > 0 ? '+' : ''}
														{trend.change.toFixed(1)}
													</span>
												)}
											</div>
											<div className='flex items-center gap-3 sm:gap-4'>
												{trend.preRating && (
													<div className='flex items-center gap-2'>
														<span className='text-xs text-slate-500'>
															Before:
														</span>
														<div
															className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${getMoodColor(
																trend.preRating
															)} flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-md`}
														>
															{trend.preRating}
														</div>
													</div>
												)}
												{trend.preRating && trend.postRating && (
													<span className='text-slate-300 text-lg'>→</span>
												)}
												{trend.postRating && (
													<div className='flex items-center gap-2'>
														<span className='text-xs text-slate-500'>
															After:
														</span>
														<div
															className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${getMoodColor(
																trend.postRating
															)} flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-md`}
														>
															{trend.postRating}
														</div>
													</div>
												)}
											</div>
										</div>
									))}
								</div>
							</div>
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

'use client';

import { useState, useEffect } from 'react';
import { ProgressDashboard } from '@/components/dashboard/ProgressDashboard';
import {
	loadUserSession,
	loadSessionSummaries,
	loadMoodData,
} from '@/utils/userSessionStorage';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
	const [userName, setUserName] = useState('');
	const [summaries, setSummaries] = useState<any[]>([]);
	const [moodData, setMoodData] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const router = useRouter();

	useEffect(() => {
		// Get userName from localStorage or prompt
		const rememberedName = localStorage.getItem('therapy_remembered_name');
		const shouldRemember =
			localStorage.getItem('therapy_remember_me') === 'true';

		if (shouldRemember && rememberedName) {
			setUserName(rememberedName);
			loadDashboardData(rememberedName);
		} else {
			// Prompt for name or redirect
			const name = prompt('Please enter your name to view your dashboard:');
			if (name && name.trim()) {
				setUserName(name.trim());
				loadDashboardData(name.trim());
			} else {
				router.push('/therapy');
			}
		}
	}, [router]);

	const loadDashboardData = (name: string) => {
		try {
			const session = loadUserSession(name);
			const loadedSummaries = loadSessionSummaries(name);
			const loadedMoodData = loadMoodData(name);

			setSummaries(loadedSummaries);
			setMoodData(loadedMoodData);
		} catch (error) {
			console.error('Error loading dashboard data:', error);
		} finally {
			setIsLoading(false);
		}
	};

	if (isLoading) {
		return (
			<div className='fixed inset-0 bg-white z-50 flex items-center justify-center'>
				<div className='text-center'>
					<div className='w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
					<p className='text-gray-600'>Loading dashboard...</p>
				</div>
			</div>
		);
	}

	if (!userName) {
		return null;
	}

	return (
		<ProgressDashboard
			userName={userName}
			summaries={summaries}
			moodData={moodData}
		/>
	);
}


'use client';

import { useState, useEffect } from 'react';
import { ProgressDashboard } from '@/components/dashboard/ProgressDashboard';
import {
	loadUserSession,
	loadSessionSummaries,
	loadMoodData,
} from '@/utils/userSessionStorage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
	const { user } = useAuth();
	const [userName, setUserName] = useState('');
	const [summaries, setSummaries] = useState<any[]>([]);
	const [moodData, setMoodData] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (user) {
			// Get first name from Google account metadata
			const name =
				user.user_metadata?.given_name ||
				user.user_metadata?.full_name?.split(' ')[0] ||
				user.user_metadata?.name?.split(' ')[0] ||
				user.email?.split('@')[0] ||
				user.id;
			setUserName(name);
			loadDashboardData(name);
		}
	}, [user]);

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

	return (
		<ProtectedRoute>
			{userName && (
				<ProgressDashboard
					userName={userName}
					summaries={summaries}
					moodData={moodData}
				/>
			)}
		</ProtectedRoute>
	);
}


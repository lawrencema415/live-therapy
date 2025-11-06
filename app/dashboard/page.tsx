'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
	
	// Track if data is already loading to prevent duplicate calls
	const isLoadingRef = useRef(false);
	const loadedUserIdRef = useRef<string | null>(null);

	// Memoize loadDashboardData to prevent recreation on every render
	const loadDashboardData = useCallback(async (name: string, userId?: string) => {
		// Prevent duplicate calls
		if (isLoadingRef.current || !name.trim()) {
			return;
		}

		isLoadingRef.current = true;
		try {
			// Pass userId to avoid duplicate getUser() calls in database functions
			const [loadedSummaries, loadedMoodData] = await Promise.all([
				loadSessionSummaries(name, userId),
				loadMoodData(name, userId),
			]);

			setSummaries(loadedSummaries);
			setMoodData(loadedMoodData);
		} catch (error) {
			console.error('Error loading dashboard data:', error);
		} finally {
			setIsLoading(false);
			isLoadingRef.current = false;
		}
	}, []); // Empty deps - userId is passed as parameter

	useEffect(() => {
		// Use user?.id instead of user object for more stable dependency
		// Only load if user exists and we haven't loaded for this user yet
		if (user?.id && loadedUserIdRef.current !== user.id) {
			// Get first name from Google account metadata
			const name =
				user.user_metadata?.given_name ||
				user.user_metadata?.full_name?.split(' ')[0] ||
				user.user_metadata?.name?.split(' ')[0] ||
				user.email?.split('@')[0] ||
				user.id;
			
			setUserName(name);
			
			// Debounce the data loading to prevent rapid calls
			const timeoutId = setTimeout(() => {
				loadDashboardData(name, user.id);
				loadedUserIdRef.current = user.id;
			}, 100);

			return () => {
				clearTimeout(timeoutId);
			};
		} else if (!user?.id) {
			// Reset when user logs out
			loadedUserIdRef.current = null;
			setUserName('');
			setSummaries([]);
			setMoodData([]);
		}
	}, [user?.id, loadDashboardData]);

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


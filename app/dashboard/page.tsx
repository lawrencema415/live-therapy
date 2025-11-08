'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ProgressDashboard } from '@/components/dashboard/ProgressDashboard';
import { loadSessionSummaries, loadMoodData } from '@/utils/userSessionStorage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
	const { user, loading: authLoading } = useAuth();
	const [userName, setUserName] = useState('');
	const [summaries, setSummaries] = useState<any[]>([]);
	const [moodData, setMoodData] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Track if data is already loading to prevent duplicate calls
	const isLoadingRef = useRef(false);
	const loadedUserIdRef = useRef<string | null>(null);
	const loadDashboardDataRef = useRef<
		((name: string, userId?: string) => Promise<void>) | null
	>(null);

	// Memoize loadDashboardData to prevent recreation on every render
	const loadDashboardData = useCallback(
		async (name: string, userId?: string) => {
			// Prevent duplicate calls
			if (isLoadingRef.current) {
				return;
			}

			// If name is empty, still set loading to false but don't load data
			if (!name.trim()) {
				setIsLoading(false);
				isLoadingRef.current = false;
				return;
			}

			isLoadingRef.current = true;
			setIsLoading(true);

			try {
				// Add timeout to prevent hanging
				const timeoutId = setTimeout(() => {
					console.warn('Dashboard data loading timeout');
					setIsLoading(false);
					isLoadingRef.current = false;
				}, 30000); // 30 second timeout

				// Pass userId to avoid duplicate getUser() calls in database functions
				const [loadedSummaries, loadedMoodData] = await Promise.all([
					loadSessionSummaries(name, userId),
					loadMoodData(name, userId),
				]);

				clearTimeout(timeoutId);
				setSummaries(loadedSummaries);
				setMoodData(loadedMoodData);
			} catch (error) {
				console.error('Error loading dashboard data:', error);
				// Set empty arrays on error to show empty state
				setSummaries([]);
				setMoodData([]);
			} finally {
				setIsLoading(false);
				isLoadingRef.current = false;
			}
		},
		[]
	); // Empty deps - userId is passed as parameter

	// Keep ref updated with latest function
	loadDashboardDataRef.current = loadDashboardData;

	// Extract name calculation to useMemo to satisfy exhaustive-deps
	const computedUserName = useMemo(() => {
		if (!user?.id) return '';
		return (
			user.user_metadata?.given_name ||
			user.user_metadata?.full_name?.split(' ')[0] ||
			user.user_metadata?.name?.split(' ')[0] ||
			user.email?.split('@')[0] ||
			user.id
		);
	}, [
		user?.id,
		user?.user_metadata?.given_name,
		user?.user_metadata?.full_name,
		user?.user_metadata?.name,
		user?.email,
	]);

	useEffect(() => {
		// Wait for auth to finish loading first
		if (authLoading) {
			return;
		}

		// If no user after auth loads, set loading to false (ProtectedRoute will redirect)
		if (!user?.id) {
			setIsLoading(false);
			loadedUserIdRef.current = null;
			setUserName('');
			setSummaries([]);
			setMoodData([]);
			return;
		}

		// Only load if user exists and we haven't loaded for this user yet
		if (loadedUserIdRef.current !== user.id) {
			setUserName(computedUserName);

			// Debounce the data loading to prevent rapid calls
			const timeoutId = setTimeout(() => {
				if (loadDashboardDataRef.current) {
					loadDashboardDataRef.current(computedUserName, user.id);
				}
				loadedUserIdRef.current = user.id;
			}, 100);

			return () => {
				clearTimeout(timeoutId);
			};
		}
	}, [user?.id, authLoading, computedUserName]);

	// Show loading screen only if auth is loading OR dashboard data is loading
	if (authLoading || isLoading) {
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

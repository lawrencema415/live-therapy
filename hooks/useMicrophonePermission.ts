'use client';

import { useState, useEffect, useRef } from 'react';

export type MicrophonePermissionStatus = 'granted' | 'denied' | 'prompt' | 'error' | 'checking';

interface UseMicrophonePermissionResult {
	status: MicrophonePermissionStatus;
	isBlocked: boolean;
	errorMessage: string | null;
}

/**
 * Custom hook to detect microphone permission status
 * Uses Permissions API when available, falls back to attempting microphone access
 */
export function useMicrophonePermission(): UseMicrophonePermissionResult {
	const [status, setStatus] = useState<MicrophonePermissionStatus>('checking');
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const permissionStatusRef = useRef<PermissionStatus | null>(null);
	const cleanupRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		let isMounted = true;

		const checkPermission = async () => {
			try {
				// Try Permissions API first (most reliable, doesn't prompt user)
				if ('permissions' in navigator && 'query' in navigator.permissions) {
					try {
						// Note: 'microphone' permission name may not be supported in all browsers
						// Chrome/Edge support it, but Firefox/Safari may not
						const permissionResult = await navigator.permissions.query({
							name: 'microphone' as PermissionName,
						});

						if (isMounted) {
							permissionStatusRef.current = permissionResult;
							setStatus(permissionResult.state as MicrophonePermissionStatus);
							setErrorMessage(
								permissionResult.state === 'denied'
									? 'Microphone access is blocked. Please enable it in your browser settings to start a therapy session.'
									: null
							);
						}

						// Listen for permission changes
						const handleChange = () => {
							if (isMounted && permissionStatusRef.current) {
								setStatus(
									permissionStatusRef.current.state as MicrophonePermissionStatus
								);
								setErrorMessage(
									permissionStatusRef.current.state === 'denied'
										? 'Microphone access is blocked. Please enable it in your browser settings to start a therapy session.'
										: null
								);
							}
						};

						permissionResult.addEventListener('change', handleChange);
						cleanupRef.current = () => {
							permissionResult.removeEventListener('change', handleChange);
						};
					} catch (permError) {
						// Permissions API might not support 'microphone' in this browser
						// We can't check without potentially prompting, so set to prompt state
						console.log('[MicPermission] Permissions API not available for microphone');
						if (isMounted) {
							setStatus('prompt');
							setErrorMessage(null);
						}
					}
				} else {
					// Permissions API not available at all
					// We can't check without potentially prompting, so set to prompt state
					if (isMounted) {
						setStatus('prompt');
						setErrorMessage(null);
					}
				}
			} catch (error) {
				console.error('[MicPermission] Error checking microphone permission:', error);
				if (isMounted) {
					// If we can't check, don't show an error - just set to prompt state
					// User will find out when they try to join
					setStatus('prompt');
					setErrorMessage(null);
				}
			}
		};

		checkPermission();

		return () => {
			isMounted = false;
			if (cleanupRef.current) {
				cleanupRef.current();
				cleanupRef.current = null;
			}
		};
	}, []);

	const isBlocked = status === 'denied' || status === 'error';

	return {
		status,
		isBlocked,
		errorMessage,
	};
}


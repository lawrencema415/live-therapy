'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface VolumeControlProps {
	className?: string;
}

export function VolumeControl({ className = '' }: VolumeControlProps) {
	const [volume, setVolume] = useState(0.7); // Default 70%
	const [isMuted, setIsMuted] = useState(false);
	const [isVisible, setIsVisible] = useState(false); // Start hidden, show on interaction
	const [wasRecentlyAdjusted, setWasRecentlyAdjusted] = useState(false);
	const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const audioElementsRef = useRef<HTMLAudioElement[]>([]);

	// Find and update all LiveKit audio elements
	const updateAudioVolume = useCallback((newVolume: number, muted: boolean) => {
		const audioElements = Array.from(document.querySelectorAll('audio'));
		audioElementsRef.current = audioElements;

		audioElements.forEach((audio) => {
			if (muted) {
				audio.volume = 0;
			} else {
				audio.volume = newVolume;
			}
		});
	}, []);

	// Listen for new audio elements being added (when agent connects)
	useEffect(() => {
		const observer = new MutationObserver(() => {
			const audioElements = Array.from(document.querySelectorAll('audio'));
			audioElementsRef.current = audioElements;
			updateAudioVolume(volume, isMuted);
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		return () => observer.disconnect();
	}, [volume, isMuted, updateAudioVolume]);

	// Initialize volume on mount
	useEffect(() => {
		updateAudioVolume(volume, isMuted);
	}, [volume, isMuted, updateAudioVolume]);

	// Handle volume slider change
	const handleVolumeChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newVolume = parseFloat(e.target.value);
			setVolume(newVolume);
			setIsMuted(newVolume === 0);
			updateAudioVolume(newVolume, newVolume === 0);

			// Show visual feedback
			setWasRecentlyAdjusted(true);
			setTimeout(() => setWasRecentlyAdjusted(false), 500);

			// Reset auto-hide timer
			setIsVisible(true);
			if (hideTimeoutRef.current) {
				clearTimeout(hideTimeoutRef.current);
			}
			hideTimeoutRef.current = setTimeout(() => {
				setIsVisible(false);
			}, 2000); // Auto-hide after 2 seconds of inactivity
		},
		[updateAudioVolume]
	);

	// Handle mute toggle
	const handleMuteToggle = useCallback(() => {
		const newMuted = !isMuted;
		setIsMuted(newMuted);
		updateAudioVolume(volume, newMuted);

		// Show visual feedback
		setWasRecentlyAdjusted(true);
		setTimeout(() => setWasRecentlyAdjusted(false), 500);

		// Reset auto-hide timer
		setIsVisible(true);
		if (hideTimeoutRef.current) {
			clearTimeout(hideTimeoutRef.current);
		}
		hideTimeoutRef.current = setTimeout(() => {
			setIsVisible(false);
		}, 2000);
	}, [isMuted, volume, updateAudioVolume]);

	// Show on hover/interaction
	const handleMouseEnter = useCallback(() => {
		setIsVisible(true);
		if (hideTimeoutRef.current) {
			clearTimeout(hideTimeoutRef.current);
		}
	}, []);

	const handleMouseLeave = useCallback(() => {
		if (hideTimeoutRef.current) {
			clearTimeout(hideTimeoutRef.current);
		}
		hideTimeoutRef.current = setTimeout(() => {
			setIsVisible(false);
		}, 2000); // Hide after 2 seconds of no interaction
	}, []);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (hideTimeoutRef.current) {
				clearTimeout(hideTimeoutRef.current);
			}
		};
	}, []);

	return (
		<div
			className={`flex items-center gap-2 ${className}`}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			<button
				onClick={handleMuteToggle}
				className={`p-1.5 rounded-lg transition-all duration-200 ${
					isMuted
						? 'text-red-500 hover:bg-red-50'
						: 'text-gray-600 hover:bg-gray-100'
				} ${wasRecentlyAdjusted ? 'scale-110' : ''}`}
				title={isMuted ? 'Unmute' : 'Mute'}
				aria-label={isMuted ? 'Unmute' : 'Mute'}
			>
				{isMuted ? (
					<VolumeX className='w-4 h-4' />
				) : (
					<Volume2 className='w-4 h-4' />
				)}
			</button>

			<div
				className={`transition-all duration-300 overflow-hidden ${
					isVisible ? 'w-[100px] opacity-100' : 'w-0 opacity-0'
				}`}
			>
				<div className='flex items-center gap-1.5'>
					<input
						type='range'
						min='0'
						max='1'
						step='0.01'
						value={isMuted ? 0 : volume}
						onChange={handleVolumeChange}
						className={`w-full h-1.5 rounded-full appearance-none cursor-pointer transition-all ${
							wasRecentlyAdjusted ? 'bg-blue-400' : 'bg-gray-300'
						} [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-125 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer`}
						style={{
							background: `linear-gradient(to right, ${
								wasRecentlyAdjusted ? '#60a5fa' : '#93c5fd'
							} 0%, ${wasRecentlyAdjusted ? '#60a5fa' : '#93c5fd'} ${
								(isMuted ? 0 : volume) * 100
							}%, #e5e7eb ${(isMuted ? 0 : volume) * 100}%, #e5e7eb 100%)`,
						}}
					/>
				</div>
			</div>
		</div>
	);
}

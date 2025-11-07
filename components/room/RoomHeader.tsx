import Link from 'next/link';
import { capitalize } from 'lodash';
import { Info } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { VolumeControl } from './VolumeControl';

interface RoomHeaderProps {
	patientName: string;
	onEndCall: () => void;
	isAgentConnected?: boolean;
	isSaving?: boolean;
	showDashboardLink?: boolean;
}

export function RoomHeader({
	patientName,
	onEndCall,
	isAgentConnected = false,
	isSaving = false,
	showDashboardLink = true,
}: RoomHeaderProps) {
	const [showPopover, setShowPopover] = useState(false);
	const popoverRef = useRef<HTMLDivElement>(null);
	const iconRef = useRef<HTMLButtonElement>(null);

	// Close popover when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				popoverRef.current &&
				iconRef.current &&
				!popoverRef.current.contains(event.target as Node) &&
				!iconRef.current.contains(event.target as Node)
			) {
				setShowPopover(false);
			}
		};

		if (showPopover) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [showPopover]);

	return (
		<div className='bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
			<div className='flex-1 min-w-0'>
				<div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2'>
					<h1 className='text-xl sm:text-2xl font-bold text-gray-800'>
						Therapy Session
					</h1>
					<div className='flex items-center gap-2'>
						{isAgentConnected ? (
							<span className='flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium w-fit'>
								<svg
									className='w-3 h-3'
									fill='currentColor'
									viewBox='0 0 20 20'
								>
									<path
										fillRule='evenodd'
										d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
										clipRule='evenodd'
									/>
								</svg>
								Therapist Connected
							</span>
						) : (
							<span className='flex items-center gap-1.5 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium w-fit'>
								<svg
									className='w-3 h-3 animate-pulse'
									fill='currentColor'
									viewBox='0 0 20 20'
								>
									<path
										fillRule='evenodd'
										d='M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z'
										clipRule='evenodd'
									/>
								</svg>
								Connecting...
							</span>
						)}
						{isAgentConnected && <VolumeControl />}
					</div>
				</div>
				<div className='flex items-center gap-2'>
					<p className='text-sm sm:text-base text-gray-600 truncate'>
						Patient: {capitalize(patientName)}
					</p>
					<div className='relative shrink-0'>
						<button
							ref={iconRef}
							onClick={() => setShowPopover(!showPopover)}
							onMouseEnter={() => setShowPopover(true)}
							onMouseLeave={(e) => {
								// Only close if not moving to popover
								const relatedTarget = e.relatedTarget as Node | null;
								if (
									!popoverRef.current ||
									!popoverRef.current.contains(relatedTarget)
								) {
									setShowPopover(false);
								}
							}}
							className='flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded'
							aria-label='Session information'
							aria-expanded={showPopover}
						>
							<Info className='w-4 h-4' />
						</button>
						{showPopover && (
							<div
								ref={popoverRef}
								className='absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-72 sm:w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 text-sm text-gray-700'
								onMouseEnter={() => setShowPopover(true)}
								onMouseLeave={() => setShowPopover(false)}
							>
								<div className='space-y-3'>
									<div>
										<h3 className='font-semibold text-gray-900 mb-1.5'>
											Crisis Detection
										</h3>
										<p className='text-gray-600 leading-relaxed'>
											If you show signs of self-harm or use certain keywords,
											help resources will automatically appear in the chat. For
											example say &quot;nothing matters&quot;
										</p>
									</div>
									<div className='border-t border-gray-200 pt-3'>
										<h3 className='font-semibold text-gray-900 mb-1.5'>
											Session Memory
										</h3>
										<p className='text-gray-600 leading-relaxed'>
											Only latest conversation transcripts are saved for
											summaries in order to keep the service sustainable on the
											free LiveKit plan.
										</p>
									</div>
								</div>
								{/* Arrow pointing up - centered to align with icon */}
								<div className='absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45'></div>
							</div>
						)}
					</div>
					{showDashboardLink && (
						<Link
							href='/dashboard'
							className='text-sm text-blue-600 hover:text-blue-700 font-medium ml-1'
						>
							View Dashboard →
						</Link>
					)}
				</div>
			</div>
			<button
				onClick={onEndCall}
				disabled={isSaving}
				className='bg-red-600 hover:cursor-pointer hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 sm:px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm sm:text-base shrink-0'
			>
				{isSaving ? (
					<>
						<svg
							className='animate-spin h-4 w-4 sm:h-5 sm:w-5'
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
						>
							<circle
								className='opacity-25'
								cx='12'
								cy='12'
								r='10'
								stroke='currentColor'
								strokeWidth='4'
							></circle>
							<path
								className='opacity-75'
								fill='currentColor'
								d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
							></path>
						</svg>
						<span className='hidden sm:inline'>Saving...</span>
						<span className='sm:hidden'>Saving...</span>
					</>
				) : (
					<>
						<span className='hidden sm:inline'>End Session</span>
						<span className='sm:hidden'>End</span>
					</>
				)}
			</button>
		</div>
	);
}

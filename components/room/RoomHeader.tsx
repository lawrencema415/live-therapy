interface RoomHeaderProps {
	roomName: string; // Actually userName now
	onEndCall: () => void;
	isAgentConnected?: boolean;
}

export function RoomHeader({
	roomName,
	onEndCall,
	isAgentConnected = false,
}: RoomHeaderProps) {
	return (
		<div className='bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
			<div className='flex-1 min-w-0'>
				<div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2'>
					<h1 className='text-xl sm:text-2xl font-bold text-gray-800'>
						Therapy Session
					</h1>
					{isAgentConnected ? (
						<span className='flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium w-fit'>
							<svg className='w-3 h-3' fill='currentColor' viewBox='0 0 20 20'>
								<path
									fillRule='evenodd'
									d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
									clipRule='evenodd'
								/>
							</svg>
							AI Connected
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
				</div>
				<p className='text-sm sm:text-base text-gray-600 truncate'>
					Patient: {roomName}
				</p>
			</div>
			<button
				onClick={onEndCall}
				className='bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 sm:px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm sm:text-base shrink-0'
			>
				<svg
					xmlns='http://www.w3.org/2000/svg'
					className='h-4 w-4 sm:h-5 sm:w-5'
					viewBox='0 0 20 20'
					fill='currentColor'
				>
					<path
						fillRule='evenodd'
						d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z'
						clipRule='evenodd'
					/>
				</svg>
				<span className='hidden sm:inline'>End Session</span>
				<span className='sm:hidden'>End</span>
			</button>
		</div>
	);
}

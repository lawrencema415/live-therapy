interface RoomHeaderProps {
	roomName: string; // Actually userName now
	onEndCall: () => void;
}

export function RoomHeader({ roomName, onEndCall }: RoomHeaderProps) {
	return (
		<div className='bg-white rounded-lg shadow-lg p-6 mb-6 flex items-center justify-between'>
			<div>
				<h1 className='text-2xl font-bold text-gray-800 mb-2'>
					Therapy Session
				</h1>
				<p className='text-gray-600'>Patient: {roomName}</p>
			</div>
			<button
				onClick={onEndCall}
				className='bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200 flex items-center gap-2'
			>
				<svg
					xmlns='http://www.w3.org/2000/svg'
					className='h-5 w-5'
					viewBox='0 0 20 20'
					fill='currentColor'
				>
					<path
						fillRule='evenodd'
						d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z'
						clipRule='evenodd'
					/>
				</svg>
				End Session
			</button>
		</div>
	);
}

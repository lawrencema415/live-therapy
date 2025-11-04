interface JoinScreenProps {
	roomName: string;
	onRoomNameChange: (name: string) => void;
	onJoin: () => void;
	isConnecting: boolean;
}

export function JoinScreen({
	roomName,
	onRoomNameChange,
	onJoin,
	isConnecting,
}: JoinScreenProps) {
	return (
		<div className='min-h-screen bg-gray-50 flex items-center justify-center p-6'>
			<div className='bg-white rounded-lg shadow-lg p-8 max-w-md w-full'>
				<h1 className='text-3xl font-bold text-gray-800 mb-2 text-center'>
					Live Therapy
				</h1>
				<p className='text-gray-600 text-center mb-8'>
					join a live therapy session with a therapist
				</p>

				<div className='space-y-4'>
					<div>
						<label
							htmlFor='roomName'
							className='block text-sm font-medium text-gray-700 mb-2'
						>
							Name
						</label>
						<input
							id='roomName'
							type='text'
							value={roomName}
							onChange={(e) => onRoomNameChange(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !isConnecting) {
									onJoin();
								}
							}}
							placeholder='Enter your name'
							className='w-full px-4 py-2 border text-black border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
							disabled={isConnecting}
						/>
					</div>

					<button
						onClick={onJoin}
						disabled={isConnecting || !roomName.trim()}
						className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center'
					>
						{isConnecting ? (
							<>
								<svg
									className='animate-spin -ml-1 mr-3 h-5 w-5 text-white'
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
								Connecting...
							</>
						) : (
							'Talk to your AI therapist'
						)}
					</button>
				</div>
			</div>
		</div>
	);
}

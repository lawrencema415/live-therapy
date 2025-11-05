interface JoinScreenProps {
	userName: string;
	onUserNameChange: (name: string) => void;
	onJoin: () => void;
	isConnecting: boolean;
	isWaitingForAgent?: boolean;
	hasPreviousSession?: boolean;
	rememberMe: boolean;
	onRememberMeChange: (remember: boolean) => void;
}

export function JoinScreen({
	userName,
	onUserNameChange,
	onJoin,
	isConnecting,
	isWaitingForAgent = false,
	hasPreviousSession = false,
	rememberMe,
	onRememberMeChange,
}: JoinScreenProps) {
	return (
		<div className='min-h-screen bg-gray-50 flex items-center justify-center p-6'>
			<div className='bg-white rounded-lg shadow-lg p-8 max-w-md w-full'>
				<h1 className='text-3xl font-bold text-gray-800 mb-2 text-center'>
					Live Therapy
				</h1>
				<p className='text-gray-600 text-center mb-8'>
					Join a live therapy session with an AI therapist
				</p>

				<div className='space-y-4'>
					<div>
						<label
							htmlFor='userName'
							className='block text-sm font-medium text-gray-700 mb-2'
						>
							Your Name
						</label>
						<input
							id='userName'
							type='text'
							value={userName}
							onChange={(e) => onUserNameChange(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !isConnecting) {
									onJoin();
								}
							}}
							placeholder='Enter your name'
							className='w-full px-4 py-2 border text-black border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
							disabled={isConnecting}
						/>
						{hasPreviousSession && (
							<p className='mt-2 text-xs text-blue-600 whitespace-nowrap'>
								Welcome back! Your previous conversations will be remembered.
							</p>
						)}
					</div>

					<div className='flex items-center'>
						<input
							id='rememberMe'
							type='checkbox'
							checked={rememberMe}
							onChange={(e) => onRememberMeChange(e.target.checked)}
							className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
							disabled={isConnecting}
						/>
						<label
							htmlFor='rememberMe'
							className='ml-2 block text-sm text-gray-700 cursor-pointer'
						>
							Remember me
						</label>
					</div>

					<button
						onClick={onJoin}
						disabled={isConnecting || !userName.trim()}
						className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center'
					>
						{isConnecting || isWaitingForAgent ? (
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
								{isWaitingForAgent
									? 'Waiting for AI therapist...'
									: 'Connecting...'}
							</>
						) : (
							'Start Therapy Session'
						)}
					</button>
					{isWaitingForAgent && (
						<p className='text-sm text-gray-500 text-center mt-2'>
							Connecting to AI therapist, please wait...
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

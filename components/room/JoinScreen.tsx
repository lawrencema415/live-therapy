import Link from 'next/link';

interface JoinScreenProps {
	userName: string;
	onUserNameChange: (name: string) => void;
	onJoin: () => void;
	isConnecting: boolean;
	isWaitingForAgent?: boolean;
	hasPreviousSession?: boolean;
	onLogout?: () => void;
}

export function JoinScreen({
	userName,
	onUserNameChange,
	onJoin,
	isConnecting,
	isWaitingForAgent = false,
	hasPreviousSession = false,
	onLogout,
}: JoinScreenProps) {
	return (
		<div className='min-h-screen flex items-center justify-center p-4 sm:p-6'>
			<div className='bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full border border-slate-200'>
				<div className='text-center mb-6'>
					<h1 className='text-3xl sm:text-4xl font-bold text-slate-800 mb-2'>
						Live Therapy
					</h1>
					<p className='text-slate-600 text-sm sm:text-base'>
						Get support when you need it most
					</p>
				</div>

				<div className='space-y-5'>
					<div>
						<label
							htmlFor='userName'
							className='block text-sm font-medium text-slate-700 mb-2'
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
							className='w-full px-4 py-3 border text-slate-900 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
							disabled={isConnecting}
						/>
						{hasPreviousSession && (
							<p className='mt-2 text-xs text-blue-600'>
								Welcome back! Your previous conversations will be remembered.
							</p>
						)}
					</div>

					<button
						onClick={onJoin}
						disabled={isConnecting || !userName.trim()}
						className='cursor-pointer w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 disabled:shadow-none'
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
						<p className='text-sm text-slate-500 text-center -mt-1'>
							Connecting to AI therapist, please wait...
						</p>
					)}

					{onLogout && (
						<button
							onClick={onLogout}
							disabled={isConnecting}
							className='cursor-pointer w-full text-slate-500 hover:text-slate-700 hover:bg-slate-50 font-medium py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 hover:border-slate-300'
						>
							Logout
						</button>
					)}
					<div className='pt-5 border-t border-slate-200'>
						<Link
							href='/dashboard'
							className='block text-center text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors'
						>
							Wellness Dashboard →
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}

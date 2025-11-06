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
	onJoin,
	isConnecting,
	isWaitingForAgent = false,
	hasPreviousSession = false,
	onLogout,
}: JoinScreenProps) {
	return (
		<div className='min-h-screen flex items-center justify-center p-4 sm:p-6 bg-linear-to-br from-blue-50 via-purple-50 to-pink-50'>
			<div className='bg-white rounded-3xl shadow-2xl p-8 sm:p-10 max-w-md w-full border border-slate-100'>
				<div className='text-center mb-8'>
					<h1 className='text-3xl sm:text-4xl font-bold text-slate-800 mb-2'>
						Live Therapy
					</h1>
					<p className='text-slate-600 text-sm sm:text-base'>
						Get support when you need it most
					</p>
				</div>

				<div className='space-y-6'>
					<div className='bg-linear-to-r from-blue-50 to-purple-50 rounded-2xl p-5 border border-blue-100'>
						<div className='flex items-center gap-3'>
							<div className='shrink-0 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm'>
								<span className='text-xl font-semibold text-blue-600'>
									{userName.charAt(0).toUpperCase()}
								</span>
							</div>
							<div className='flex-1 min-w-0'>
								<p className='text-xs text-slate-500 font-medium mb-0.5'>
									Signed in as
								</p>
								<p className='text-lg font-semibold text-slate-800 truncate'>
									{userName}
								</p>
							</div>
							{onLogout && (
								<button
									onClick={onLogout}
									disabled={isConnecting}
									className='cursor-pointer shrink-0 text-xs text-slate-600 hover:text-slate-800 hover:bg-white/80 font-medium py-2 px-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 hover:border-slate-300'
								>
									Logout
								</button>
							)}
						</div>
						{hasPreviousSession && (
							<div className='mt-3 pt-3 border-t border-blue-200/50'>
								<p className='text-xs text-blue-700 flex items-center gap-1.5'>
									<svg
										className='w-3.5 h-3.5'
										fill='currentColor'
										viewBox='0 0 20 20'
									>
										<path
											fillRule='evenodd'
											d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
											clipRule='evenodd'
										/>
									</svg>
									Welcome back! Your previous sessions are saved.
								</p>
							</div>
						)}
					</div>

					<button
						onClick={onJoin}
						disabled={isConnecting || !userName.trim()}
						className='cursor-pointer w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 disabled:shadow-none'
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
									? 'Connecting to therapist...'
									: 'Connecting...'}
							</>
						) : (
							<span>Start Therapy Session</span>
						)}
					</button>

					{isWaitingForAgent && (
						<p className='text-sm text-slate-500 text-center -mt-2 flex items-center justify-center gap-2'>
							<span className='inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse'></span>
							Finding an available therapist...
						</p>
					)}

					<div>
						<Link
							href='/dashboard'
							className='block w-full text-center text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium py-3 px-4 rounded-xl transition-all border border-blue-200 hover:border-blue-300'
						>
							Dashboard
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}

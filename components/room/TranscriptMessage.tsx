import type { TranscriptMessage } from '@/types/room';

interface TranscriptMessageProps {
	message: TranscriptMessage;
}

export function TranscriptMessageComponent({
	message,
}: TranscriptMessageProps) {
	const isAgent = message.speaker.startsWith('agent');
	const displayName = isAgent ? 'Agent' : 'You';

	return (
		<div className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
			<div
				className={`max-w-[75%] rounded-lg px-4 py-2 ${
					isAgent ? 'bg-blue-100 text-blue-900' : 'bg-green-100 text-green-900'
				}`}
			>
				<div className='flex items-center justify-between mb-1'>
					<div className='text-xs font-semibold opacity-70'>{displayName}</div>
					<div className='text-xs opacity-50'>
						{new Date(message.timestamp).toLocaleTimeString([], {
							hour: '2-digit',
							minute: '2-digit',
							second: '2-digit',
						})}
					</div>
				</div>
				<div
					className={`text-sm ${
						message.isFinal ? 'font-normal' : 'font-light italic opacity-80'
					}`}
				>
					{message.text}
					{!message.isFinal && (
						<span className='inline-block w-2 h-4 ml-1 bg-current animate-pulse' />
					)}
				</div>
			</div>
		</div>
	);
}

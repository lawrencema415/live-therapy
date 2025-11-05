import type { TranscriptMessage } from '@/types/room';

interface TranscriptMessageProps {
	message: TranscriptMessage;
}

export function TranscriptMessageComponent({
	message,
}: TranscriptMessageProps) {
	const isAgent = message.speaker.startsWith('agent');
	const displayName = isAgent ? 'Therapist' : 'You';

	return (
		<div className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
			<div
				className={`max-w-[75%] rounded-lg px-4 py-2 ${
					isAgent ? 'bg-blue-100 text-blue-900' : 'bg-green-100 text-green-900'
				}`}
			>
				<div className='flex items-center justify-between mb-1'>
					<div className='text-xs font-semibold opacity-70'>{displayName}</div>
					<div className='text-xs opacity-50 whitespace-nowrap ml-2'>
						{new Date(message.timestamp).toLocaleTimeString([], {
							hour: 'numeric',
							minute: '2-digit',
							hour12: true,
						})}
					</div>
				</div>
				<div
					className={`text-sm ${
						message.isFinal ? 'font-normal' : 'font-light italic opacity-80'
					}`}
				>
					{message.text}
				</div>
			</div>
		</div>
	);
}

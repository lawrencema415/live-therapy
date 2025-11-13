import type { TranscriptMessage } from '@/types/room';
import { AlertCircle } from 'lucide-react';

interface TranscriptMessageProps {
	message: TranscriptMessage;
}

export function TranscriptMessageComponent({
	message,
}: TranscriptMessageProps) {
	const isAgent = message.speaker.startsWith('agent');
	const isSystem = message.speaker === 'system';
	const displayName = isAgent ? 'Therapist' : isSystem ? 'System' : 'You';

	// System messages (crisis resources) get special styling
	if (isSystem) {
		const lines = message.text.split('\n');
		const title = lines[0];
		const body = lines.slice(1).join('\n');

		return (
			<div className='flex justify-center my-4'>
				<div className='max-w-[85%] rounded-lg px-5 py-4 bg-amber-50 border-2 border-amber-300 shadow-lg'>
					<div className='flex items-start gap-3 mb-2'>
						<AlertCircle className='w-5 h-5 text-amber-600 shrink-0 mt-0.5' />
						<div className='flex-1'>
							<div className='text-sm font-bold text-amber-900 mb-2'>
								{title}
							</div>
							<div className='text-sm text-amber-800 whitespace-pre-line leading-relaxed'>
								{body}
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

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
					className={`text-sm whitespace-pre-wrap ${
						message.isFinal ? 'font-normal' : 'font-light italic opacity-80'
					}`}
				>
					{message.text}
				</div>
			</div>
		</div>
	);
}

import type { TranscriptMessage } from '@/types/room';
import { TranscriptMessageComponent } from './TranscriptMessage';

interface TranscriptListProps {
	transcripts: TranscriptMessage[];
}

export function TranscriptList({ transcripts }: TranscriptListProps) {
	return (
		<div className='bg-white rounded-lg shadow-lg p-6'>
			<h2 className='text-lg font-semibold text-gray-800 mb-4'>Conversation</h2>

			<div className='space-y-3 min-h-[400px] max-h-[600px] overflow-y-auto'>
				{transcripts.length === 0 ? (
					<div className='text-center py-12 text-gray-400'>
						<p>Waiting for conversation to start...</p>
					</div>
				) : (
					transcripts.map((msg) => (
						<TranscriptMessageComponent
							key={`${msg.id}-${msg.timestamp}`}
							message={msg}
						/>
					))
				)}
			</div>
		</div>
	);
}

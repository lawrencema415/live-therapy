'use client';

import type { JournalEntry } from '@/utils/supabaseDatabase';
import { CustomCalendar } from './CustomCalendar';

interface JournalCalendarProps {
	entries: JournalEntry[];
	onDateClick?: (date: Date) => void;
}

export function JournalCalendar({ entries, onDateClick }: JournalCalendarProps) {
	return <CustomCalendar entries={entries} onDateClick={onDateClick} />;
}


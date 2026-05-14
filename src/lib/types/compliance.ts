export interface ComplianceWeek {
	week: string;
	reset_start: string;
	count: number;
	total_dungeons: number;
	highest_key_level: number | null;
	met: boolean;
}

export interface RecordEntry {
	count?: number;
	level?: number;
	week: string;
}

export interface RaiderCompliance {
	current_streak: number;
	longest_streak: number;
	total_weeks_met: number;
	total_weeks_tracked: number;
	record_dungeons_week: { count: number; week: string } | null;
	record_highest_key: { level: number; week: string } | null;
	weeks: ComplianceWeek[];
}

export interface ComplianceFile {
	last_updated: string | null;
	raiders: Record<string, RaiderCompliance>;
}

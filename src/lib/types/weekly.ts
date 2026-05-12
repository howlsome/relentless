import type { Role, TeamDesignation } from './roster.js';

export interface MplusRun {
	dungeon: string;
	level: number;
	timed: boolean;
	completed_at: string;
}

export type ResilienceProgress = Record<string, number>;

export interface MplusRaiderEntry {
	raider_id: string;
	display_name: string;
	team_designation: TeamDesignation;
	active_character: string;
	realm: string;
	class: string;
	spec: string;
	role: Role;
	rio_score: number | null;
	mplus_runs_this_week: MplusRun[];
	mplus_weekly_count_at_or_above_minimum: number;
	mplus_total_dungeons_this_week: number;
	mplus_highest_key_this_week: number | null;
	mplus_requirement_met: boolean;
	resilience_level: number | null;
	resilience_progress: ResilienceProgress;
	error?: string;
}

export interface MplusWeeklyFile {
	season_id: string;
	week: string;
	fetched_at: string;
	raiders: MplusRaiderEntry[];
}

export interface BossParseDifficulty {
	kill: boolean;
	parse_percentile: number | null;
	spec: string | null;
	dps: number | null;
}

export interface BossParse {
	boss_id: number;
	boss_name: string;
	difficulties: {
		heroic?: BossParseDifficulty;
		mythic?: BossParseDifficulty;
	};
}

export interface RaidRaiderEntry {
	raider_id: string;
	display_name: string;
	team_designation: TeamDesignation;
	active_character: string;
	realm: string;
	class: string;
	spec: string;
	role: Role;
	raid_parses: BossParse[];
	error?: string;
}

export interface RaidBoss {
	id: number;
	name: string;
}

export interface RaidTierMeta {
	wcl_zone_id: number;
	name: string;
	bosses: RaidBoss[];
}

export interface RaidWeeklyFile {
	season_id: string;
	week: string;
	fetched_at: string;
	raid_tier: RaidTierMeta;
	raiders: RaidRaiderEntry[];
}

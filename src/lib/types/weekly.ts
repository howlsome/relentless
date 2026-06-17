import type { KillCategory, Role, TeamDesignation } from './roster.js';

export interface MplusRun {
	dungeon: string;
	level: number;
	timed: boolean;
	completed_at: string;
}

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
	previous_characters?: PreviousCharacterEntry[];
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
	kill_time?: string | null;
	kill_category?: KillCategory | null;
	detected_session?: string | null;
	wcl_report_code?: string | null;
	wcl_fight_id?: number | null;
	/** Best parse for this raider before their tracking_start_date (pre-guild history). */
	historical_best_parse?: number | null;
}

export interface LockoutWarning {
	boss_id: number;
	boss_name: string;
	difficulty: string;
	kill_time: string;
	detected_local_time: string;
	reason: string;
	prior_blocks_last_4_weeks: number;
	wcl_report_code?: string | null;
	wcl_fight_id?: number | null;
}

export interface SafePugKill {
	boss_id: number;
	boss_name: string;
	difficulty: string;
	kill_time: string;
	detected_local_time: string;
}

export interface ExemptPugKill {
	boss_id: number;
	boss_name: string;
	difficulty: string;
	kill_time: string;
	detected_local_time: string;
	exemption_reason: string;
	exemption_granted_by: string;
}

export interface BossParse {
	boss_id: number;
	boss_name: string;
	difficulties: {
		heroic?: BossParseDifficulty;
		mythic?: BossParseDifficulty;
	};
}

export interface PreviousCharacterEntry {
	name: string;
	realm: string;
	class: string;
	spec: string;
	role: Role;
	rio_score?: number | null;
	raid_parses?: BossParse[];
	offspec_parses?: Record<string, BossParse[]>;
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
	offspec_parses?: Record<string, BossParse[]>;
	lockout_warnings: LockoutWarning[];
	safe_pug_kills: SafePugKill[];
	exempt_pug_kills: ExemptPugKill[];
	previous_characters?: PreviousCharacterEntry[];
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

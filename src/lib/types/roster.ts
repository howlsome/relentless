export type Role = 'tank' | 'healer' | 'dps';
export type KillCategory = 'in_raid' | 'safe_pug' | 'exempt_pug' | 'blocking_pug';
export type DifficultyStatus = 'progression' | 'farm' | 'retired';
export type Status = 'active' | 'inactive';
export type TeamDesignation = 'main' | 'alt';

export type WowClass =
	| 'DeathKnight'
	| 'DemonHunter'
	| 'Druid'
	| 'Evoker'
	| 'Hunter'
	| 'Mage'
	| 'Monk'
	| 'Paladin'
	| 'Priest'
	| 'Rogue'
	| 'Shaman'
	| 'Warlock'
	| 'Warrior';

export type MembershipEvent =
	| { event: 'joined'; date: string; note?: string }
	| { event: 'left'; date: string; note?: string }
	| {
			event: 'team_changed';
			date: string;
			from: TeamDesignation;
			to: TeamDesignation;
			reason: string;
	  };

export interface RoleHistoryEntry {
	role: Role;
	class: WowClass;
	spec: string;
	character: string;
	from: string;
	to: string | null;
}

export interface SpecEntry {
	spec: string;
	role: Role;
	primary: boolean;
	wcl_active: boolean;
}

export interface Character {
	name: string;
	realm: string;
	class: WowClass;
	/** New multi-spec form. When present, replaces legacy spec/role fields. */
	specs?: SpecEntry[];
	/** Legacy single-spec field — kept for backwards compat. */
	spec?: string;
	/** Legacy single-role field — kept for backwards compat. */
	role?: Role;
	active: boolean;
	last_seen?: string;
}

export interface Player {
	raider_id: string;
	display_name: string;
	status: Status;
	tracking_start_date?: string;
	team_designation: TeamDesignation;
	membership_history: MembershipEvent[];
	characters: Character[];
	role_history: RoleHistoryEntry[];
	exemptions?: Exemption[];
	designation_history?: Array<{ season_id: string; designation: TeamDesignation }>;
}

export interface MplusSeason {
	season_id: string;
	label: string;
	start_date: string;
	end_date: string | null;
	dungeon_count: number;
	dungeons: string[];
}

export interface RaidSession {
	day: string;
	start: string;
	end: string;
	grace_minutes: number;
}

export interface SafePugWindow {
	day: string;
	start: string;
	end: string;
}

export interface Exemption {
	week: string;
	raid_nights_excused: string[];
	reason: string;
	granted_by: string;
	granted_at: string;
}

export interface RaidSchedule {
	timezone: string;
	sessions: RaidSession[];
	safe_pug_windows: SafePugWindow[];
}

export interface RaidDifficultyStatus {
	heroic?: DifficultyStatus;
	mythic?: DifficultyStatus;
	/** ISO date on/after which mythic kills outside raid windows trigger lockout warnings. Null = mythic not yet started. */
	mythic_start_date?: string | null;
}

export interface Roster {
	app_name: string;
	realm: string;
	region: string;
	mplus_weekly_minimum: number;
	mplus_minimum_key_level: number;
	tracking_start_date: string;
	mplus_seasons: MplusSeason[];
	raid_difficulties: string[];
	wcl_expansion_id: number;
	players: Player[];
	raid_schedule?: RaidSchedule;
	raid_difficulty_status?: Record<string, RaidDifficultyStatus>;
}

export type Role = 'tank' | 'healer' | 'dps';
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

export interface Character {
	name: string;
	realm: string;
	class: WowClass;
	spec: string;
	role: Role;
	active: boolean;
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
}

export interface MplusSeason {
	season_id: string;
	label: string;
	start_date: string;
	end_date: string | null;
	dungeon_count: number;
	dungeons: string[];
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
}

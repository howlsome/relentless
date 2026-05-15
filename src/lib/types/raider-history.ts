import type {
	MembershipEvent,
	Role,
	RoleHistoryEntry,
	TeamDesignation,
	WowClass,
} from './roster.js';

export interface CharacterHistoryEntry {
	name: string;
	realm: string;
	class: WowClass;
	spec: string;
	role: Role;
	active: boolean;
	first_seen: string;
	last_seen?: string;
}

export interface RaiderHistoryEntry {
	display_name: string;
	team_designation: TeamDesignation;
	membership_history: MembershipEvent[];
	characters: CharacterHistoryEntry[];
	role_history: RoleHistoryEntry[];
}

export interface RaiderHistoryFile {
	last_updated: string | null;
	raiders: Record<string, RaiderHistoryEntry>;
}

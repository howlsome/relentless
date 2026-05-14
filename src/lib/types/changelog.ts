import type { Role, TeamDesignation } from './roster.js';

interface BaseEntry {
	id: string;
	timestamp: string;
	week: string;
	team: TeamDesignation;
	raider_id: string;
	display_name: string;
}

interface JoinedEntry extends BaseEntry {
	event: 'joined';
	character: string;
	class: string;
	spec: string;
	role: Role;
	note?: string;
}

interface LeftEntry extends BaseEntry {
	event: 'left';
	character: string;
	class: string;
	spec: string;
	role: Role;
	note?: string;
}

interface TeamChangedEntry extends BaseEntry {
	event: 'team_changed';
	character: string;
	from: TeamDesignation;
	to: TeamDesignation;
	reason: string;
}

interface RerolledEntry extends BaseEntry {
	event: 'rerolled';
	from_character: string;
	from_class: string;
	from_spec: string;
	to_character: string;
	to_class: string;
	to_spec: string;
	role: Role;
	note?: string;
}

interface RoleChangedEntry extends BaseEntry {
	event: 'role_changed';
	character: string;
	from_spec: string;
	from_role: Role;
	to_spec: string;
	to_role: Role;
	note?: string;
}

interface SpecChangedEntry extends BaseEntry {
	event: 'spec_changed';
	character: string;
	from_spec: string;
	to_spec: string;
	note?: string;
}

interface BlockingPugEntry extends BaseEntry {
	event: 'blocking_pug';
	character: string;
	class: string;
	spec: string;
	boss_name: string;
	difficulty: string;
	kill_time: string;
	detected_local_time: string;
	wcl_report_code?: string;
	wcl_fight_id?: number;
	note?: string;
}

interface ExemptPugEntry extends BaseEntry {
	event: 'exempt_pug';
	character: string;
	class: string;
	spec: string;
	boss_name: string;
	difficulty: string;
	kill_time: string;
	detected_local_time: string;
	exemption_reason: string;
	exemption_granted_by: string;
	wcl_report_code?: string;
	wcl_fight_id?: number;
	note?: string;
}

export type ChangelogEntry =
	| JoinedEntry
	| LeftEntry
	| TeamChangedEntry
	| RerolledEntry
	| RoleChangedEntry
	| SpecChangedEntry
	| BlockingPugEntry
	| ExemptPugEntry;

export interface ChangelogFile {
	last_updated: string | null;
	roster_hash: string | null;
	entries: ChangelogEntry[];
}

import type { WowClass, Role, Roster, Player, Character, SpecEntry } from '$lib/types/index.js';

/** Canonical spec → role mapping per class. Covers Midnight Season 1 (Patch 12.0). */
export const CLASS_SPECS: Record<WowClass, Record<string, Role>> = {
	DeathKnight: { Blood: 'tank', Frost: 'dps', Unholy: 'dps' },
	DemonHunter: { Havoc: 'dps', Vengeance: 'tank', Devourer: 'dps' },
	Druid: { Balance: 'dps', Feral: 'dps', Guardian: 'tank', Restoration: 'healer' },
	Evoker: { Devastation: 'dps', Preservation: 'healer', Augmentation: 'dps' },
	Hunter: { 'Beast Mastery': 'dps', Marksmanship: 'dps', Survival: 'dps' },
	Mage: { Arcane: 'dps', Fire: 'dps', Frost: 'dps' },
	Monk: { Brewmaster: 'tank', Mistweaver: 'healer', Windwalker: 'dps' },
	Paladin: { Holy: 'healer', Protection: 'tank', Retribution: 'dps' },
	Priest: { Discipline: 'healer', Holy: 'healer', Shadow: 'dps' },
	Rogue: { Assassination: 'dps', Outlaw: 'dps', Subtlety: 'dps' },
	Shaman: { Elemental: 'dps', Enhancement: 'dps', Restoration: 'healer' },
	Warlock: { Affliction: 'dps', Demonology: 'dps', Destruction: 'dps' },
	Warrior: { Arms: 'dps', Fury: 'dps', Protection: 'tank' }
};

export const VALID_CLASSES = Object.keys(CLASS_SPECS) as WowClass[];

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Returns whether the class + spec combination exists in the canonical table.
 * Does not check role consistency — that is a separate warning.
 */
export function isValidClassSpec(cls: string, spec: string): boolean {
	const specs = CLASS_SPECS[cls as WowClass];
	if (!specs) return false;
	return spec in specs;
}

/**
 * Returns the canonical role for a class/spec, or null if the combination is invalid.
 */
export function canonicalRole(cls: string, spec: string): Role | null {
	const specs = CLASS_SPECS[cls as WowClass];
	if (!specs) return null;
	return specs[spec] ?? null;
}

/** Validate a single character entry. */
function validateCharacter(char: Character, raiderName: string): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	const label = `${raiderName} / ${char.name}`;

	if (!char.name) errors.push(`${label}: missing character name`);
	if (!char.realm) errors.push(`${label}: missing realm`);
	if (!char.class) errors.push(`${label}: missing class`);
	if (char.active === undefined || char.active === null) {
		warnings.push(
			`${label}: "active" field is missing — character will be treated as inactive and not polled`
		);
	}

	if (char.specs && char.specs.length > 0) {
		// New multi-spec form — validate each spec entry
		const specsResult = validateSpecsArray(char.specs, char.class, label);
		errors.push(...specsResult.errors);
		warnings.push(...specsResult.warnings);
	} else {
		// Legacy single-spec form
		if (!char.spec) errors.push(`${label}: missing spec`);
		if (!char.role) errors.push(`${label}: missing role`);
		if (char.class && char.spec) {
			if (!isValidClassSpec(char.class, char.spec)) {
				errors.push(
					`${label}: invalid class/spec combination "${char.class} / ${char.spec}"`,
				);
			} else if (char.role) {
				const canonical = canonicalRole(char.class, char.spec);
				if (canonical && canonical !== char.role) {
					warnings.push(
						`${label}: spec "${char.spec}" is a ${canonical} spec but role is listed as "${char.role}"`,
					);
				}
			}
		}
	}

	return { valid: errors.length === 0, errors, warnings };
}

/** Validate a single player entry. */
function validatePlayer(player: Player): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	const label = player.display_name || player.raider_id;

	if (!player.raider_id) errors.push(`${label}: missing raider_id`);
	if (!player.display_name) errors.push(`${label}: missing display_name`);
	if (!player.status) errors.push(`${label}: missing status`);
	if (player.status !== 'active' && player.status !== 'inactive') {
		errors.push(`${label}: status must be "active" or "inactive", got "${player.status}"`);
	}
	if (!player.team_designation) errors.push(`${label}: missing team_designation`);
	if (player.team_designation !== 'main' && player.team_designation !== 'alt') {
		errors.push(
			`${label}: team_designation must be "main" or "alt", got "${player.team_designation}"`
		);
	}
	if (!Array.isArray(player.characters) || player.characters.length === 0) {
		errors.push(`${label}: must have at least one character entry`);
	}

	const activeChars = (player.characters ?? []).filter((c) => c.active === true);
	if (activeChars.length === 0 && player.status === 'active') {
		warnings.push(`${label}: active raider has no active characters — will be skipped by cron`);
	}

	for (const char of player.characters ?? []) {
		const charResult = validateCharacter(char, label);
		errors.push(...charResult.errors);
		warnings.push(...charResult.warnings);
	}

	for (const event of player.membership_history ?? []) {
		if (event.event === 'team_changed' && !('reason' in event && event.reason)) {
			warnings.push(
				`${label}: team_changed event on ${event.date} is missing a reason`
			);
		}
	}

	return { valid: errors.length === 0, errors, warnings };
}

/** Validate the entire roster file. */
export function validateRoster(roster: Roster): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!roster.app_name) errors.push('Missing app_name');
	if (!roster.realm) errors.push('Missing realm');
	if (!roster.region) errors.push('Missing region');
	if (typeof roster.mplus_weekly_minimum !== 'number') {
		errors.push('mplus_weekly_minimum must be a number');
	}
	if (typeof roster.mplus_minimum_key_level !== 'number') {
		errors.push('mplus_minimum_key_level must be a number');
	}
	if (!roster.tracking_start_date) errors.push('Missing tracking_start_date');
	if (!Array.isArray(roster.mplus_seasons) || roster.mplus_seasons.length === 0) {
		errors.push('mplus_seasons must be a non-empty array');
	}
	if (!Array.isArray(roster.players)) {
		errors.push('players must be an array');
	}

	// Validate raid_schedule if present
	if (roster.raid_schedule !== undefined) {
		const sched = roster.raid_schedule;
		if (!sched.timezone) {
			errors.push('raid_schedule: missing timezone');
		}
		if (!Array.isArray(sched.sessions) || sched.sessions.length === 0) {
			warnings.push('raid_schedule: sessions array is empty — lockout detection is disabled');
		}
		for (const win of sched.safe_pug_windows ?? []) {
			const [sh, sm] = win.start.split(':').map(Number);
			const [eh, em] = win.end.split(':').map(Number);
			if (sh * 60 + sm >= eh * 60 + em) {
				warnings.push(
					`raid_schedule: safe_pug_window on ${win.day} has start >= end (${win.start}–${win.end}) — window will be ignored`,
				);
			}
		}
	}

	const seenIds = new Set<string>();
	for (const player of roster.players ?? []) {
		if (player.raider_id && seenIds.has(player.raider_id)) {
			errors.push(`Duplicate raider_id: ${player.raider_id}`);
		}
		seenIds.add(player.raider_id);

		const result = validatePlayer(player);
		errors.push(...result.errors);
		warnings.push(...result.warnings);
	}

	return { valid: errors.length === 0, errors, warnings };
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/**
 * Return all active players (status === 'active' or status field absent).
 * Missing status defaults to 'active' for backwards compatibility.
 */
export function getActivePlayers(roster: Roster): Player[] {
	return (roster.players ?? []).filter(
		(p) => !p.status || p.status === 'active'
	);
}

/**
 * Return the effective tracking start date for a player.
 * Uses per-player override if set; falls back to roster top-level date.
 * If neither is set, logs a warning and returns today's ISO date.
 */
export function getEffectiveStartDate(player: Player, roster: Roster): string {
	if (player.tracking_start_date) return player.tracking_start_date;
	if (roster.tracking_start_date) return roster.tracking_start_date;
	const today = new Date().toISOString().slice(0, 10);
	console.warn(
		`[roster] No tracking_start_date for ${player.display_name} or roster — defaulting to ${today}`
	);
	return today;
}

/**
 * Return whether a given ISO week ("YYYY-WW") falls on or after the player's
 * effective start date (using the Monday of the ISO week as the reference).
 */
export function isWeekTracked(isoWeek: string, player: Player, roster: Roster): boolean {
	const startDate = getEffectiveStartDate(player, roster);
	const [yearStr, weekStr] = isoWeek.split('-');
	const year = Number(yearStr);
	const week = Number(weekStr);
	const jan4 = new Date(Date.UTC(year, 0, 4));
	const dayOfWeek = jan4.getUTCDay() || 7;
	const weekStart = new Date(jan4);
	weekStart.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
	return weekStart.toISOString().slice(0, 10) >= startDate;
}

/**
 * Return true when the role is consistent with the spec's canonical role.
 * e.g. Holy Paladin listed as 'dps' → false (Holy is a healer spec).
 */
export function validateRoleForSpec(cls: string, spec: string, role: string): boolean {
	const canonical = canonicalRole(cls, spec);
	if (canonical === null) return false;
	return canonical === role;
}

// ── Stage 8: Multi-spec helpers ───────────────────────────────────────────────

/** A Character-like object that may have specs[] or legacy spec/role. */
interface CharLike {
	class?: string;
	spec?: string;
	role?: Role;
	specs?: SpecEntry[];
}

/** Return only specs with wcl_active: true. */
export function getActiveSpecs(char: CharLike): SpecEntry[] {
	return (char.specs ?? []).filter((s) => s.wcl_active);
}

/** Return the primary spec entry (first with primary: true, fallback to first entry). */
export function getPrimarySpec(char: CharLike): SpecEntry | null {
	const specs = char.specs ?? [];
	if (specs.length === 0) return null;
	return specs.find((s) => s.primary) ?? specs[0];
}

/** Return the deduplicated set of roles across all wcl_active specs. */
export function getRolesPlayed(char: CharLike): Role[] {
	const roles = new Set<Role>();
	for (const spec of getActiveSpecs(char)) {
		roles.add(spec.role);
	}
	return [...roles];
}

/** Validate a specs[] array. Returns errors and warnings. */
export function validateSpecsArray(
	specs: SpecEntry[],
	charClass: string,
	label: string,
): { errors: string[]; warnings: string[] } {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (specs.length === 0) {
		errors.push(`${label}: specs array must have at least one entry`);
		return { errors, warnings };
	}

	const primaryCount = specs.filter((s) => s.primary).length;
	if (primaryCount === 0) {
		warnings.push(`${label}: no primary spec set — first entry will be used as primary`);
	} else if (primaryCount > 1) {
		warnings.push(`${label}: multiple primary: true entries — first occurrence will be used`);
	}

	for (const entry of specs) {
		if (!isValidClassSpec(charClass, entry.spec)) {
			errors.push(`${label}: invalid class/spec combination "${charClass} / ${entry.spec}"`);
		}
	}

	return { errors, warnings };
}

/** Migrate a legacy spec/role character entry to the specs[] form (idempotent). */
export function migrateCharacterToSpecs(char: CharLike): SpecEntry[] {
	if (char.specs && char.specs.length > 0) return char.specs;
	if (char.spec && char.role) {
		return [{ spec: char.spec, role: char.role, primary: true, wcl_active: true }];
	}
	return [];
}

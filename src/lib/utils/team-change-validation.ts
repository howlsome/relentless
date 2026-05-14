/**
 * Validation helpers for team_changed events and designation parity checks.
 * Used by the cron to warn when officers forget to add reasons or paired events.
 */

import type { MembershipEvent, Player, Roster } from '$lib/types/roster.js';

export interface ValidationWarning {
	level: 'warning' | 'error';
	message: string;
	raiderId?: string;
}

/**
 * Validate a single membership_history event.
 * Returns an array of warnings (empty = valid).
 */
export function validateTeamChange(event: MembershipEvent): ValidationWarning[] {
	const warnings: ValidationWarning[] = [];
	if (event.event !== 'team_changed') return warnings; // only validates team_changed

	const te = event as Extract<MembershipEvent, { event: 'team_changed' }>;
	if (!te.reason || te.reason.trim() === '') {
		warnings.push({
			level: 'warning',
			message: `team_changed event on ${te.date} is missing a reason — recording "(no reason given)"`
		});
	}
	return warnings;
}

/**
 * Check that every team_designation change is paired with a team_changed membership event.
 * Also checks for team_changed events without a matching designation change.
 *
 * @param currentRoster  The current roster.json
 * @param previousRoster  The roster state from the previous cron run (or null on first run)
 */
export function checkDesignationParity(
	currentRoster: Roster,
	previousRoster: Roster | null
): ValidationWarning[] {
	if (!previousRoster) return [];

	const warnings: ValidationWarning[] = [];
	const prevMap = new Map((previousRoster.players ?? []).map((p) => [p.raider_id, p]));

	for (const current of currentRoster.players) {
		const prev = prevMap.get(current.raider_id);
		if (!prev) continue;

		const designationChanged = prev.team_designation !== current.team_designation;
		const hasTeamChangedEvent = (current.membership_history ?? []).some(
			(e) =>
				e.event === 'team_changed' &&
				!(prev.membership_history ?? []).some(
					(pe) => pe.event === 'team_changed' && pe.date === e.date
				)
		);

		if (designationChanged && !hasTeamChangedEvent) {
			warnings.push({
				level: 'warning',
				raiderId: current.raider_id,
				message: `team_designation changed for ${current.display_name} without a corresponding team_changed event in membership_history`
			});
		}

		if (!designationChanged && hasTeamChangedEvent) {
			warnings.push({
				level: 'warning',
				raiderId: current.raider_id,
				message: `team_changed event found for ${current.display_name} but team_designation did not change`
			});
		}
	}

	return warnings;
}

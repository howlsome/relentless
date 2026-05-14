<script lang="ts">
	import type { Role } from '$lib/types/roster.js';

	let {
		role,
		spec = null,
		charClass = null
	}: {
		role: Role;
		spec?: string | null;
		charClass?: string | null;
	} = $props();

	// Specs that are ranged DPS. "Frost" is both Mage (ranged) and DK (melee) — resolved by class.
	const RANGED_SPECS = new Set([
		'Balance', 'Elemental', 'Shadow',
		'Arcane', 'Fire',
		'Affliction', 'Demonology', 'Destruction',
		'Beast Mastery', 'Marksmanship',
		'Devastation', 'Augmentation',
	]);

	const isRanged = $derived(
		role === 'dps' && spec != null && (
			RANGED_SPECS.has(spec) ||
			(spec === 'Frost' && charClass === 'Mage')
		)
	);

	const label = $derived(
		role === 'tank' ? 'Tank' : role === 'healer' ? 'Healer' : isRanged ? 'Ranged DPS' : 'DPS'
	);

	const emoji = $derived(
		role === 'tank' ? '🛡️' : role === 'healer' ? '❤️' : isRanged ? '🏹' : '🗡️'
	);
</script>

<span
	class="role-icon"
	class:role-icon--melee={role === 'dps' && !isRanged}
	aria-label={label}
	title={label}
	role="img"
>{emoji}</span>

<style>
	.role-icon {
		font-style: normal;
		line-height: 1;
		display: inline-block;
	}

	.role-icon--melee {
		transform: rotate(-190deg);
	}
</style>

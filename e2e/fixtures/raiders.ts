/** Stable fixture raiders in roster.json (status: inactive) — one per role. */
export const FIXTURES = {
	tank: {
		uuid: 'e2e00000-0000-0000-0000-000000000001',
		displayName: 'Arthas',
		charClass: 'DeathKnight',
		spec: 'Blood',
		roleLabel: 'Tank',
	},
	healer: {
		uuid: 'e2e00000-0000-0000-0000-000000000002',
		displayName: 'Anduin',
		charClass: 'Priest',
		spec: 'Holy',
		roleLabel: 'Healer',
	},
	melee: {
		uuid: 'e2e00000-0000-0000-0000-000000000003',
		displayName: 'Garrosh',
		charClass: 'Warrior',
		spec: 'Fury',
		roleLabel: 'DPS',
	},
	ranged: {
		uuid: 'e2e00000-0000-0000-0000-000000000004',
		displayName: 'Jaina',
		charClass: 'Mage',
		spec: 'Frost',
		roleLabel: 'Ranged DPS',
	},
} as const;

import { readFileSync } from 'node:fs';
import adapter from '@sveltejs/adapter-static';

const roster = JSON.parse(readFileSync('./data/roster.json', 'utf-8'));
const seasonsIndex = JSON.parse(readFileSync('./data/seasons/index.json', 'utf-8'));

const raiderIds = roster.players.map((r) => r.raider_id);
const seasonIds = [
	...seasonsIndex.all_mplus_seasons.map((s) => s.season_id),
	...seasonsIndex.all_raid_zones.map((z) => z.season_id),
];

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: undefined,
			precompress: false,
			strict: true,
		}),
		prerender: {
			entries: [
				'*',
				'/changelog',
				...raiderIds.map((id) => `/raider/${id}`),
				...seasonIds.map((id) => `/season/${id}`),
			],
		},
	},
};

export default config;

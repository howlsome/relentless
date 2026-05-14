export const prerender = true;

import { readFileSync } from 'fs';
import { join } from 'path';

/** @type {import('@sveltejs/kit').ServerLoad} */
export function load() {
	/** @type {import('$lib/types').SeasonsIndex} */
	const seasonsIndex = JSON.parse(
		readFileSync(join(process.cwd(), 'data', 'seasons', 'index.json'), 'utf-8')
	);
	return { seasonsIndex };
}

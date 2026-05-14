export const prerender = true;

import { readFileSync } from 'fs';
import { join } from 'path';

/** @type {import('@sveltejs/kit').Load} */
export function load() {
	const dataDir = join(process.cwd(), 'data');
	/** @type {import('$lib/types').ChangelogFile} */
	const changelog = JSON.parse(readFileSync(join(dataDir, 'changelog.json'), 'utf-8'));
	return { changelog };
}

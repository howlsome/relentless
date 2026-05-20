export const prerender = true;

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const E2E_FIXTURE_ENTRIES =
	process.env.E2E_FIXTURES === 'true'
		? JSON.parse(
				readFileSync(join(process.cwd(), 'e2e/fixtures/changelog-entries.json'), 'utf-8'),
			)
		: null;

/** @type {import('@sveltejs/kit').Load} */
export function load() {
	const dataDir = join(process.cwd(), 'data');
	/** @type {import('$lib/types').ChangelogFile} */
	const changelog = JSON.parse(readFileSync(join(dataDir, 'changelog.json'), 'utf-8'));
	if (E2E_FIXTURE_ENTRIES) {
		changelog.entries = E2E_FIXTURE_ENTRIES;
	}
	return { changelog };
}

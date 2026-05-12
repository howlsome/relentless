import '@testing-library/jest-dom/vitest';

// Stub localStorage for tests that run in jsdom
if (typeof localStorage === 'undefined') {
	const store: Record<string, string> = {};
	Object.defineProperty(globalThis, 'localStorage', {
		value: {
			getItem: (key: string) => store[key] ?? null,
			setItem: (key: string, value: string) => { store[key] = value; },
			removeItem: (key: string) => { delete store[key]; },
			clear: () => { for (const k in store) delete store[k]; }
		}
	});
}

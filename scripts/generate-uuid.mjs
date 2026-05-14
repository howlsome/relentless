#!/usr/bin/env node
/**
 * Generate a UUID v4 for use as a raider_id in roster.json.
 * Usage: node scripts/generate-uuid.mjs
 */
const uuid = crypto.randomUUID();
console.log(uuid);

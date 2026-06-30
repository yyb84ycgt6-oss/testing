import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  getProfile,
  validateProfile,
  ProfileNotFoundError,
  ProfileValidationError,
} from '../src/services/profileService.js';

test('validateProfile accepts a valid profile', () => {
  const profile = { name: 'Jackie', title: 'Engineer' };
  assert.equal(validateProfile(profile), profile);
});

test('validateProfile rejects missing required fields', () => {
  assert.throws(() => validateProfile({ name: 'Jackie' }), ProfileValidationError);
  assert.throws(() => validateProfile(null), ProfileValidationError);
});

test('getProfile loads and parses the real data file', async () => {
  const profile = await getProfile();
  assert.equal(typeof profile.name, 'string');
  assert.ok(profile.title);
  assert.ok(Array.isArray(profile.skills));
});

test('getProfile throws ProfileNotFoundError for a missing file', async () => {
  await assert.rejects(
    getProfile({ profileFile: '/nonexistent/profile.json' }),
    ProfileNotFoundError
  );
});

test('getProfile throws ProfileValidationError for invalid JSON', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'profile-test-'));
  const file = path.join(dir, 'bad.json');
  await writeFile(file, '{ not valid json');
  try {
    await assert.rejects(getProfile({ profileFile: file }), ProfileValidationError);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

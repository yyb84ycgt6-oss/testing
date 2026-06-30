import { readFile, writeFile } from 'node:fs/promises';
import { config } from '../config.js';

const REQUIRED_FIELDS = ['name', 'title'];

export class ProfileNotFoundError extends Error {}
export class ProfileValidationError extends Error {}

export function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new ProfileValidationError('Profile must be an object.');
  }
  const missing = REQUIRED_FIELDS.filter((field) => !profile[field]);
  if (missing.length > 0) {
    throw new ProfileValidationError(`Profile is missing required fields: ${missing.join(', ')}.`);
  }
  return profile;
}

export async function getProfile({ profileFile = config.profileFile } = {}) {
  let raw;
  try {
    raw = await readFile(profileFile, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new ProfileNotFoundError(`Profile data file not found at ${profileFile}.`);
    }
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ProfileValidationError('Profile data file contains invalid JSON.');
  }

  return validateProfile(parsed);
}

export async function updateProfile(newProfile, { profileFile = config.profileFile } = {}) {
  validateProfile(newProfile);
  const raw = JSON.stringify(newProfile, null, 2);
  await writeFile(profileFile, raw, 'utf-8');
  return newProfile;
}

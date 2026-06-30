import { sendJson, sendError } from '../lib/http.js';
import {
  getProfile,
  ProfileNotFoundError,
  ProfileValidationError,
} from '../services/profileService.js';

export async function handleGetProfile(req, res) {
  try {
    const profile = await getProfile();
    sendJson(res, 200, { data: profile });
  } catch (err) {
    if (err instanceof ProfileNotFoundError) {
      sendError(res, 404, err.message);
    } else if (err instanceof ProfileValidationError) {
      sendError(res, 422, err.message);
    } else {
      sendError(res, 500, 'Internal server error while loading profile.');
    }
  }
}

export function handleHealth(req, res) {
  sendJson(res, 200, { status: 'ok', uptime: process.uptime() });
}

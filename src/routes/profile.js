import { sendJson, sendError, readJsonBody } from '../lib/http.js';
import { config } from '../config.js';
import {
  getProfile,
  updateProfile,
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

export async function handleUpdateProfile(req, res) {
  // Validate token
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Unauthorized: Missing or invalid token.');
  }
  const token = authHeader.substring(7);
  if (token !== config.adminToken) {
    return sendError(res, 401, 'Unauthorized: Invalid token.');
  }

  // Read and parse JSON body
  let newProfile;
  try {
    newProfile = await readJsonBody(req);
  } catch (err) {
    return sendError(res, 400, err.message);
  }

  // Update profile
  try {
    const updated = await updateProfile(newProfile);
    sendJson(res, 200, { data: updated });
  } catch (err) {
    if (err instanceof ProfileValidationError) {
      sendError(res, 422, err.message);
    } else {
      sendError(res, 500, 'Internal server error while updating profile.');
    }
  }
}

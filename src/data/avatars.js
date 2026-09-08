// src/data/avatars.js
//
// Avatars live in src/assets/avatars/, which means they must be
// IMPORTED so the bundler fingerprints and serves them. Referencing
// them as "/avatars/xyz.png" only works for files in public/.
//
// NOTE: the actual files on disk are UPPERCASE .PNG. Import paths must
// match exactly — Windows dev machines are case-insensitive and will
// happily resolve "avatar1.png", but the Linux build servers Firebase
// Hosting deploys from are NOT, so a lowercase path breaks in
// production while working locally.
//
// There is no default.png in the asset folder, so avatar1 doubles as
// the fallback for missing/unknown values.

import avatar1 from "../assets/avatars/avatar1.PNG";
import avatar2 from "../assets/avatars/avatar2.PNG";
import avatar3 from "../assets/avatars/avatar3.PNG";
import avatar4 from "../assets/avatars/avatar4.PNG";
import avatar5 from "../assets/avatars/avatar5.PNG";

// Keys are the values stored in each student's profile.avatar field.
// Both the .PNG and legacy .png spellings map to the same image so any
// profiles already saved with lowercase values keep working.
const AVATAR_MAP = {
  "avatar1.PNG": avatar1,
  "avatar2.PNG": avatar2,
  "avatar3.PNG": avatar3,
  "avatar4.PNG": avatar4,
  "avatar5.PNG": avatar5,
  // legacy lowercase keys from earlier saved profiles
  "avatar1.png": avatar1,
  "avatar2.png": avatar2,
  "avatar3.png": avatar3,
  "avatar4.png": avatar4,
  "avatar5.png": avatar5,
  "default.png": avatar1
};

/** The list shown in ProfileSetup's picker. */
export const AVATAR_OPTIONS = [
  "avatar1.PNG",
  "avatar2.PNG",
  "avatar3.PNG",
  "avatar4.PNG",
  "avatar5.PNG"
];

/** Resolves a stored avatar filename to a real bundled image URL,
 *  falling back to the first avatar if the name is missing or unknown. */
export function avatarSrc(filename) {
  return AVATAR_MAP[filename] || avatar1;
}

export const defaultAvatar = avatar1;

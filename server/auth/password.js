import bcrypt from "bcrypt";
import { isCommonPassword } from "./common-passwords.js";

const COST = 12;
const MIN_LEN = 12;

export function validatePolicy(pw) {
  if (typeof pw !== "string" || pw.length < MIN_LEN) {
    return { ok: false, reason: "min_length" };
  }
  if (isCommonPassword(pw)) {
    return { ok: false, reason: "common" };
  }
  return { ok: true };
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, COST);
}

export async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

export function needsRehash(hash) {
  const m = /^\$2[aby]\$(\d+)\$/.exec(hash);
  return !m || Number(m[1]) < COST;
}

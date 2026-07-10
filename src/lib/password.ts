import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// scryptによるパスワードハッシュ化。bcrypt等のネイティブ依存を追加せず、
// Node.js標準のcryptoモジュールだけで完結させるための選択（Docker/Cloud Runでの
// ビルド時にネイティブモジュールのコンパイルが不要になる）。
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) {
    return false;
  }
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  if (keyBuffer.length !== derivedKey.length) {
    return false;
  }
  return timingSafeEqual(keyBuffer, derivedKey);
}

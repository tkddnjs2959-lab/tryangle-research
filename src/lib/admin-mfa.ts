import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(value: string) {
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('ADMIN_TOTP_SECRET 형식이 올바르지 않습니다.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function codeAt(secret: Buffer, counter: number) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, '0');
}

export function isMfaRequired() {
  return process.env.ADMIN_MFA_REQUIRED === 'true';
}

export function verifyAdminTotp(input: string) {
  const configured = process.env.ADMIN_TOTP_SECRET?.trim();
  if (!configured) return !isMfaRequired();
  if (!/^\d{6}$/.test(input)) return false;
  const secret = decodeBase32(configured);
  const counter = Math.floor(Date.now() / 30_000);
  return [-1, 0, 1].some((offset) => {
    const expected = Buffer.from(codeAt(secret, counter + offset));
    const actual = Buffer.from(input);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  });
}

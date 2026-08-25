import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'aes-256-gcm-v1';

function key(): Buffer {
  const raw = process.env.CONSULTATION_ENCRYPTION_KEY;
  const decoded = raw
    ? Buffer.from(raw, 'base64')
    : createHash('sha256').update(`consultation:${process.env.SESSION_SECRET ?? ''}`).digest();
  if (decoded.length !== 32) {
    throw new Error('CONSULTATION_ENCRYPTION_KEY는 32바이트 base64 값이어야 합니다.');
  }
  if (!raw && !process.env.SESSION_SECRET) throw new Error('상담 원문 암호화 키가 설정되지 않았습니다.');
  return decoded;
}

export function encryptConsultationText(text: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return {
    fullTextMarker: '[encrypted:v1]',
    encryptedText: encrypted.toString('base64'),
    encryptionIv: iv.toString('base64'),
    encryptionTag: cipher.getAuthTag().toString('base64'),
    encryptionVersion: VERSION,
  };
}

export function decryptConsultationText(input: {
  fullText: string;
  encryptedText?: string | null;
  encryptionIv?: string | null;
  encryptionTag?: string | null;
  encryptionVersion?: string | null;
}) {
  if (!input.encryptedText) return input.fullText;
  if (input.encryptionVersion !== VERSION || !input.encryptionIv || !input.encryptionTag) {
    throw new Error('지원하지 않는 상담 원문 암호화 형식입니다.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(input.encryptionIv, 'base64'));
  decipher.setAuthTag(Buffer.from(input.encryptionTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(input.encryptedText, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function privacyHash(value: string) {
  return createHash('sha256').update(`${process.env.SESSION_SECRET ?? ''}:${value}`).digest('hex');
}

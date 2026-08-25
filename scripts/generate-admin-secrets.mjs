import { randomBytes } from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i < bits.length; i += 5) output += alphabet[Number.parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return output;
}

const totp = base32(randomBytes(20));
const encryption = randomBytes(32).toString('base64');
const loginId = process.argv[2] || 'admin';

console.log(`ADMIN_LOGIN_ID=${loginId}`);
console.log(`ADMIN_TOTP_SECRET=${totp}`);
console.log('ADMIN_MFA_REQUIRED=true');
console.log(`CONSULTATION_ENCRYPTION_KEY=${encryption}`);
console.log(`\n인증 앱 수동 등록: 계정 TRY앵글-${loginId}, 비밀키 ${totp}`);
console.log(`otpauth://totp/TRYangle:${encodeURIComponent(loginId)}?secret=${totp}&issuer=TRYangle`);

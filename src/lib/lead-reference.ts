import 'server-only';

import { createHash } from 'node:crypto';

export function createLeadReference(inquiryId: string) {
  const digest = createHash('sha256').update(`inquiry:${inquiryId}`).digest('hex');
  return `lead_${digest.slice(0, 16)}`;
}

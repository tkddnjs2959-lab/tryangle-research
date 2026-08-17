export type LegacyRecordKind = 'consultation' | 'student_profile' | 'unknown';

export type LegacyImportRow = {
  rowNumber: number;
  rawText: string;
  recordKind: LegacyRecordKind;
  cohortLabel: string | null;
  consultedAt: string | null;
  normalizedName: string | null;
  age: number | null;
  gender: string | null;
  experience: string | null;
  paymentNote: string | null;
  metadata: Record<string, unknown>;
};

const COHORT_HEADER = /^\*{2,}\s*(\d+)기(?:\s*\/\s*([^*]+))?/;
const CONSULTATION_LINE = /^(\d{1,2})\.(\d{1,2})\s+(.+?)(?:\((\d{2})(?:\s*\/\s*(남|여))?\))?(?:\s*\/\s*(.*))?$/;
const PROFILE_LINE = /^(.+?)\s*\((\d{2})(?:\s+(남|여))?\)\s*(?:-\s*(.*))?$/;

function clean(value: string | undefined | null) {
  const result = value?.replace(/\s+/g, ' ').trim();
  return result || null;
}

function parseAge(value: string | undefined) {
  return value ? Number.parseInt(value, 10) : null;
}

export function parseLegacyConsultationText(text: string): LegacyImportRow[] {
  const rows: LegacyImportRow[] = [];
  let cohortLabel: string | null = null;
  let inProfileSection = false;

  text.split(/\r?\n/).forEach((line, index) => {
    const rawText = line.trim();
    if (!rawText || rawText === '-' || rawText.startsWith('=')) return;

    const header = rawText.match(COHORT_HEADER);
    if (header) {
      cohortLabel = `${header[1]}기`;
      inProfileSection = false;
      return;
    }
    if (/^\d+기\s*$/.test(rawText)) {
      cohortLabel = rawText;
      inProfileSection = true;
      return;
    }

    const profile = rawText.match(PROFILE_LINE);
    if (inProfileSection && profile) {
      rows.push({
        rowNumber: index + 1,
        rawText,
        recordKind: 'student_profile',
        cohortLabel,
        consultedAt: null,
        normalizedName: clean(profile[1]),
        age: parseAge(profile[2]),
        gender: clean(profile[3]),
        experience: clean(profile[4]),
        paymentNote: null,
        metadata: {},
      });
      return;
    }

    const consultation = rawText.match(CONSULTATION_LINE);
    if (consultation && cohortLabel) {
      rows.push({
        rowNumber: index + 1,
        rawText,
        recordKind: 'consultation',
        cohortLabel,
        consultedAt: null,
        normalizedName: clean(consultation[3]),
        age: parseAge(consultation[4]),
        gender: clean(consultation[5]),
        experience: null,
        paymentNote: clean(consultation[6]),
        metadata: {},
      });
      return;
    }

    rows.push({
      rowNumber: index + 1,
      rawText,
      recordKind: 'unknown',
      cohortLabel,
      consultedAt: null,
      normalizedName: null,
      age: null,
      gender: null,
      experience: null,
      paymentNote: null,
      metadata: {},
    });
  });

  return rows;
}

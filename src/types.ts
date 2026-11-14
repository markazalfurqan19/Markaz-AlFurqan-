export type MemberStatus = 'active' | 'inactive' | 'suspended';

export type PaymentMethod =
  | 'cbe'
  | 'telebirr'
  | 'awash'
  | 'cbe_birr'
  | 'cash'
  | 'bank_transfer'
  | 'other';

export type ContributionStatus = 'completed' | 'verified' | 'pending' | 'voided';

export type AdminRoleType = 'owner' | 'admin';

export interface Member {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  halqa?: string;
  memberId: string;
  monthlyPledgeETB: number;
  status: MemberStatus;
  city?: string;
  createdBy: string;
  createdByEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Contribution {
  id: string;
  memberId: string;
  memberName: string;
  receiptNumber: string;
  amountETB: number;
  ethiopianMonth: string;
  ethiopianYear: number;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  notes?: string;
  recordedBy: string;
  status: ContributionStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminRole {
  id: string;
  email: string;
  role: AdminRoleType;
  grantedBy: string;
  grantedAt: string;
}

export interface CenterSetting {
  centerName: string;
  phone?: string;
  email?: string;
  bankAccountDetails?: string;
  monthlyTargetETB?: number;
  updatedBy?: string;
  updatedAt?: string;
}

export const SCHEMA_LIMITS = {
  MEMBER_FULL_NAME: 120,
  MEMBER_PHONE: 30,
  MEMBER_EMAIL: 100,
  MEMBER_HALQA: 60,
  MEMBER_CODE: 30,
  MEMBER_CITY: 80,
  CONTRIBUTION_MEMBER_ID: 64,
  CONTRIBUTION_MEMBER_NAME: 120,
  CONTRIBUTION_RECEIPT: 40,
  CONTRIBUTION_MONTH: 30,
  CONTRIBUTION_TX_REF: 100,
  CONTRIBUTION_NOTES: 300,
  ADMIN_EMAIL: 120,
  SETTING_CENTER_NAME: 150,
  SETTING_PHONE: 40,
  SETTING_EMAIL: 100,
  SETTING_BANK_DETAILS: 500,
  MAX_TARGET_ETB: 1000000000,
  DOC_ID: 128,
} as const;

export const HARDCODED_OWNER_EMAILS = [
  'markazalfurqan19@gmail.com',
  'iibrahimabdela@gmail.com',
  'shaxaa72@gmail.com',
] as const;

export const ETHIOPIAN_MONTHS = [
  'Fulbaana',
  'Onkololeessa',
  'Sadaasa',
  'Muddee',
  'Amajjii',
  'Guraandhala',
  'Bitootessa',
  'Ebla',
  'Caamsaa',
  'Waxabajjii',
  'Adoolessa',
  'Hagayya',
  'Qaammee',
] as const;

/**
 * Converts a Gregorian Date to approximate Ethiopian Calendar Year & Month name.
 */
export function getCurrentEthiopianDate(date: Date = new Date()): { month: string; year: number } {
  const gYear = date.getFullYear();
  const gMonth = date.getMonth() + 1; // 1-12
  const gDay = date.getDate();

  // Ethiopian New Year is Sept 11 (or Sept 12 in Gregorian leap years before Eth leap)
  const isNextGregorianLeap = (gYear + 1) % 4 === 0;
  const newYearDay = isNextGregorianLeap ? 12 : 11;

  let ethYear = gYear - 8;
  if (gMonth > 9 || (gMonth === 9 && gDay >= newYearDay)) {
    ethYear = gYear - 7;
  }

  // Approximate Ethiopian month start mapping
  // Fulbaana ~ Sept 11, Onkololeessa ~ Oct 11, Sadaasa ~ Nov 10, Muddee ~ Dec 10,
  // Amajjii ~ Jan 9, Guraandhala ~ Feb 8, Bitootessa ~ Mar 10, Ebla ~ Apr 9,
  // Caamsaa ~ May 9, Waxabajjii ~ Jun 8, Adoolessa ~ Jul 8, Hagayya ~ Aug 7, Qaammee ~ Sept 6-10
  let monthIdx = 0;
  const md = gMonth * 100 + gDay;
  if (md >= 911 && md <= 1010) monthIdx = 0;
  else if (md >= 1011 && md <= 1109) monthIdx = 1;
  else if (md >= 1110 && md <= 1209) monthIdx = 2;
  else if (md >= 1210 || md <= 108) monthIdx = 3;
  else if (md >= 109 && md <= 207) monthIdx = 4;
  else if (md >= 208 && md <= 309) monthIdx = 5;
  else if (md >= 310 && md <= 408) monthIdx = 6;
  else if (md >= 409 && md <= 508) monthIdx = 7;
  else if (md >= 509 && md <= 607) monthIdx = 8;
  else if (md >= 608 && md <= 707) monthIdx = 9;
  else if (md >= 708 && md <= 806) monthIdx = 10;
  else if (md >= 807 && md <= 905) monthIdx = 11;
  else monthIdx = 12;

  return {
    month: ETHIOPIAN_MONTHS[monthIdx],
    year: ethYear,
  };
}

export function sanitizeDocId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, SCHEMA_LIMITS.DOC_ID);
}

export function formatETB(amount: number): string {
  return `${new Intl.NumberFormat('en-ET', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)} ETB`;
}

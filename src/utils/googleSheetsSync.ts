import {
  CenterSetting,
  Contribution,
  ContributionStatus,
  ETHIOPIAN_MONTHS,
  Member,
  MemberStatus,
  PaymentMethod,
  SCHEMA_LIMITS,
  getCurrentEthiopianDate,
} from '../types';
import { Language } from '../i18n';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export const SHEET_TAB_MEMBERS = 'Miseensota';
export const SHEET_TAB_CONTRIBUTIONS = 'Buusii';
export const SHEET_TAB_SUMMARY = 'Cuunfaa';

export class SheetsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SheetsAuthError';
  }
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  sheetTabs: { sheetId: number; title: string }[];
}

export interface PushSyncSummary {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  membersCount: number;
  contributionsCount: number;
  syncedAt: string;
}

export interface ImportedMemberDraft {
  existingDocId?: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  memberId: string;
  monthlyPledgeETB: number;
  status: MemberStatus;
  city: string;
}

export interface ImportedContributionDraft {
  memberId: string;
  memberName: string;
  receiptNumber: string;
  amountETB: number;
  ethiopianMonth: string;
  ethiopianYear: number;
  paymentMethod: PaymentMethod;
  transactionReference: string;
  notes: string;
  status: ContributionStatus;
}

export interface PullSyncPreview {
  spreadsheetId: string;
  spreadsheetTitle: string;
  newMembers: ImportedMemberDraft[];
  updatedMembers: ImportedMemberDraft[];
  newContributions: ImportedContributionDraft[];
  skippedRows: number;
}

export function parseSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Spreadsheet URL or ID is required.');
  }
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].slice(0, SCHEMA_LIMITS.SETTING_SHEET_ID);
  }
  if (/^[a-zA-Z0-9-_]{15,120}$/.test(trimmed)) {
    return trimmed;
  }
  throw new Error('Invalid Google Spreadsheet URL or ID.');
}

async function sheetsFetch<T>(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    const errText = await res.text().catch(() => '');
    throw new SheetsAuthError(
      errText || 'Google Sheets authorization expired or missing permission.'
    );
  }

  if (!res.ok) {
    let msg = `Google Sheets API error (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) msg = body.error.message;
    } catch {
      // ignore parse fallback
    }
    throw new Error(msg);
  }

  return (await res.json()) as T;
}

export async function fetchSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const fields = 'spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title)';
  const data = await sheetsFetch<{
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: { properties?: { sheetId?: number; title?: string } }[];
  }>(`${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}?fields=${encodeURIComponent(fields)}`, accessToken);

  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl:
      data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    title: data.properties?.title || 'Al-Furqaan Ledger',
    sheetTabs: (data.sheets || [])
      .map((s) => ({
        sheetId: s.properties?.sheetId ?? 0,
        title: s.properties?.title || '',
      }))
      .filter((s) => Boolean(s.title)),
  };
}

export async function createAlFurqaanSpreadsheet(
  accessToken: string,
  centerName: string
): Promise<SpreadsheetMetadata> {
  const currentEth = getCurrentEthiopianDate();
  const safeName = (centerName || 'Al-Furqaan').trim().slice(0, 80);
  const title = `${safeName} — Buusii Ledger (${currentEth.year} E.C.)`;

  const created = await sheetsFetch<{
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: { properties?: { sheetId?: number; title?: string } }[];
  }>(SHEETS_API_BASE, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: [
        {
          properties: {
            title: SHEET_TAB_MEMBERS,
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: SHEET_TAB_CONTRIBUTIONS,
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: SHEET_TAB_SUMMARY,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    }),
  });

  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl:
      created.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
    title: created.properties?.title || title,
    sheetTabs: (created.sheets || [])
      .map((s) => ({
        sheetId: s.properties?.sheetId ?? 0,
        title: s.properties?.title || '',
      }))
      .filter((s) => Boolean(s.title)),
  };
}

async function ensureRequiredTabs(
  accessToken: string,
  metadata: SpreadsheetMetadata
): Promise<SpreadsheetMetadata> {
  const required = [SHEET_TAB_MEMBERS, SHEET_TAB_CONTRIBUTIONS, SHEET_TAB_SUMMARY];
  const existingTitles = new Set(metadata.sheetTabs.map((t) => t.title));
  const missing = required.filter((title) => !existingTitles.has(title));

  if (missing.length === 0) return metadata;

  await sheetsFetch(`${SHEETS_API_BASE}/${encodeURIComponent(metadata.spreadsheetId)}:batchUpdate`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      requests: missing.map((title) => ({
        addSheet: {
          properties: {
            title,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      })),
    }),
  });

  return fetchSpreadsheetMetadata(accessToken, metadata.spreadsheetId);
}

function formatTabHeaderRequests(tabs: { sheetId: number; title: string }[]) {
  const targetTitles = new Set([SHEET_TAB_MEMBERS, SHEET_TAB_CONTRIBUTIONS, SHEET_TAB_SUMMARY]);
  return tabs
    .filter((tab) => targetTitles.has(tab.title))
    .flatMap((tab) => [
      {
        repeatCell: {
          range: {
            sheetId: tab.sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.043, green: 0.122, blue: 0.227 },
              textFormat: {
                foregroundColor: { red: 1, green: 1, blue: 1 },
                bold: true,
              },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      },
      {
        updateSheetProperties: {
          properties: {
            sheetId: tab.sheetId,
            gridProperties: { frozenRowCount: 1 },
          },
          fields: 'gridProperties.frozenRowCount',
        },
      },
    ]);
}

export async function pushAllToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  members: Member[],
  contributions: Contribution[],
  centerSettings: CenterSetting,
  lang: Language
): Promise<PushSyncSummary> {
  const initialMeta = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
  const meta = await ensureRequiredTabs(accessToken, initialMeta);

  const syncedAt = new Date().toISOString();
  const currentEth = getCurrentEthiopianDate();

  const memberRows: (string | number)[][] = [
    [
      'Member ID',
      'Full Name',
      'Phone Number',
      'Email',
      'Monthly Pledge (ETB)',
      'Status',
      'City',
      'Updated At',
    ],
    ...members.map((m) => [
      m.memberId,
      m.fullName,
      m.phoneNumber,
      m.email || '',
      m.monthlyPledgeETB,
      m.status,
      m.city || '',
      m.updatedAt || m.createdAt || '',
    ]),
  ];

  const sortedContributions = [...contributions].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  const contributionRows: (string | number)[][] = [
    [
      'Receipt No',
      'Member ID',
      'Member Name',
      'Amount (ETB)',
      'Ethiopian Month',
      'Ethiopian Year',
      'Payment Method',
      'Transaction Ref',
      'Status',
      'Notes',
      'Recorded At',
    ],
    ...sortedContributions.map((c) => [
      c.receiptNumber,
      c.memberId,
      c.memberName,
      c.amountETB,
      c.ethiopianMonth,
      c.ethiopianYear,
      c.paymentMethod,
      c.transactionReference || '',
      c.status,
      c.notes || '',
      c.createdAt || '',
    ]),
  ];

  const validContribs = contributions.filter((c) => c.status !== 'voided');
  const activeCount = members.filter((m) => m.status === 'active').length;
  const inactiveCount = members.filter((m) => m.status === 'inactive').length;
  const suspendedCount = members.filter((m) => m.status === 'suspended').length;
  const totalCollected = validContribs.reduce((sum, c) => sum + c.amountETB, 0);
  const thisMonthCollected = validContribs
    .filter(
      (c) =>
        c.ethiopianMonth === currentEth.month && c.ethiopianYear === currentEth.year
    )
    .reduce((sum, c) => sum + c.amountETB, 0);

  const summaryRows: (string | number)[][] = [
    [
      lang === 'om' ? 'Odeeffannoo Cuunfaa Al-Furqaan' : 'Al-Furqaan Summary Metric',
      lang === 'om' ? 'Gatii / Baay’ina' : 'Value',
    ],
    ['Center Name', centerSettings.centerName],
    ['Synced At (UTC)', syncedAt],
    ['Current Ethiopian Period', `${currentEth.month} ${currentEth.year} E.C.`],
    ['Active Members', activeCount],
    ['Inactive Members', inactiveCount],
    ['Suspended Members', suspendedCount],
    ['Total Members', members.length],
    ['Total Collected (ETB)', totalCollected],
    [`${currentEth.month} ${currentEth.year} Collected (ETB)`, thisMonthCollected],
    ['Monthly Target (ETB)', centerSettings.monthlyTargetETB ?? 0],
    ['', ''],
    [`${currentEth.year} E.C. Monthly Breakdown`, 'Collected (ETB)'],
    ...ETHIOPIAN_MONTHS.map((month) => {
      const monthSum = validContribs
        .filter((c) => c.ethiopianYear === currentEth.year && c.ethiopianMonth === month)
        .reduce((sum, c) => sum + c.amountETB, 0);
      return [month, monthSum];
    }),
  ];

  // Clear old content on all 3 tabs before writing clean tables
  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(meta.spreadsheetId)}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        ranges: [
          `'${SHEET_TAB_MEMBERS}'!A1:Z`,
          `'${SHEET_TAB_CONTRIBUTIONS}'!A1:Z`,
          `'${SHEET_TAB_SUMMARY}'!A1:Z`,
        ],
      }),
    }
  );

  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(meta.spreadsheetId)}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `'${SHEET_TAB_MEMBERS}'!A1`, values: memberRows },
          { range: `'${SHEET_TAB_CONTRIBUTIONS}'!A1`, values: contributionRows },
          { range: `'${SHEET_TAB_SUMMARY}'!A1`, values: summaryRows },
        ],
      }),
    }
  );

  const styleRequests = formatTabHeaderRequests(meta.sheetTabs);
  if (styleRequests.length > 0) {
    await sheetsFetch(
      `${SHEETS_API_BASE}/${encodeURIComponent(meta.spreadsheetId)}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ requests: styleRequests }),
      }
    );
  }

  return {
    spreadsheetId: meta.spreadsheetId,
    spreadsheetUrl: meta.spreadsheetUrl,
    title: meta.title,
    membersCount: members.length,
    contributionsCount: contributions.length,
    syncedAt,
  };
}

function normalizeMemberStatus(raw: string): MemberStatus {
  const val = raw.trim().toLowerCase();
  if (val === 'inactive' || val === 'dhaabbataa') return 'inactive';
  if (val === 'suspended' || val === 'dhorkame') return 'suspended';
  return 'active';
}

function normalizePaymentMethod(raw: string): PaymentMethod {
  const val = raw.trim().toLowerCase();
  const valid: PaymentMethod[] = [
    'cbe',
    'telebirr',
    'awash',
    'cbe_birr',
    'cash',
    'bank_transfer',
    'other',
  ];
  if ((valid as string[]).includes(val)) return val as PaymentMethod;
  if (val.includes('telebirr')) return 'telebirr';
  if (val.includes('awash')) return 'awash';
  if (val.includes('cbe birr')) return 'cbe_birr';
  if (val.includes('cbe')) return 'cbe';
  if (val.includes('cash')) return 'cash';
  if (val.includes('transfer')) return 'bank_transfer';
  return 'other';
}

function normalizeContributionStatus(raw: string): ContributionStatus {
  const val = raw.trim().toLowerCase();
  if (val === 'verified' || val === 'mirkanaa’e') return 'verified';
  if (val === 'pending' || val === 'eegaa jira') return 'pending';
  if (val === 'voided' || val === 'haqame') return 'voided';
  return 'completed';
}

export async function previewPullFromGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  existingMembers: Member[],
  existingContributions: Contribution[]
): Promise<PullSyncPreview> {
  const meta = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
  const tabTitles = meta.sheetTabs.map((t) => t.title);

  // Discover member & contribution tabs without hardcoding Sheet1 blindly
  const membersTab =
    tabTitles.find((t) => t.toLowerCase() === SHEET_TAB_MEMBERS.toLowerCase()) ||
    tabTitles.find((t) => t.toLowerCase().includes('member')) ||
    tabTitles[0];

  const contributionsTab =
    tabTitles.find((t) => t.toLowerCase() === SHEET_TAB_CONTRIBUTIONS.toLowerCase()) ||
    tabTitles.find((t) => t.toLowerCase().includes('contrib') || t.toLowerCase().includes('buusii'));

  const existingMemberByCode = new Map(
    existingMembers.map((m) => [m.memberId.trim().toLowerCase(), m])
  );
  const existingReceipts = new Set(
    existingContributions.map((c) => c.receiptNumber.trim().toLowerCase())
  );

  const newMembers: ImportedMemberDraft[] = [];
  const updatedMembers: ImportedMemberDraft[] = [];
  const newContributions: ImportedContributionDraft[] = [];
  let skippedRows = 0;

  if (membersTab) {
    const memberRes = await sheetsFetch<{ values?: string[][] }>(
      `${SHEETS_API_BASE}/${encodeURIComponent(meta.spreadsheetId)}/values/${encodeURIComponent(
        `'${membersTab}'!A1:H2000`
      )}`,
      accessToken
    );
    const rows = memberRes.values || [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const memberId = (row[0] || '').trim().slice(0, SCHEMA_LIMITS.MEMBER_CODE);
      const fullName = (row[1] || '').trim().slice(0, SCHEMA_LIMITS.MEMBER_FULL_NAME);
      const phoneNumber = (row[2] || '').trim().slice(0, SCHEMA_LIMITS.MEMBER_PHONE);
      const email = (row[3] || '').trim().slice(0, SCHEMA_LIMITS.MEMBER_EMAIL);
      const pledgeNum = Number(String(row[4] || '0').replace(/,/g, ''));
      const status = normalizeMemberStatus(row[5] || 'active');
      const city = (row[6] || '').trim().slice(0, SCHEMA_LIMITS.MEMBER_CITY);

      if (!memberId || !fullName || !phoneNumber || Number.isNaN(pledgeNum) || pledgeNum < 0) {
        if (row.some((cell) => String(cell || '').trim() !== '')) skippedRows += 1;
        continue;
      }

      const existing = existingMemberByCode.get(memberId.toLowerCase());
      if (!existing) {
        newMembers.push({
          fullName,
          phoneNumber,
          email,
          memberId,
          monthlyPledgeETB: pledgeNum,
          status,
          city,
        });
      } else {
        const changed =
          existing.fullName !== fullName ||
          existing.phoneNumber !== phoneNumber ||
          (existing.email || '') !== email ||
          existing.monthlyPledgeETB !== pledgeNum ||
          existing.status !== status ||
          (existing.city || '') !== city;

        if (changed) {
          updatedMembers.push({
            existingDocId: existing.id,
            fullName,
            phoneNumber,
            email,
            memberId: existing.memberId,
            monthlyPledgeETB: pledgeNum,
            status,
            city,
          });
        }
      }
    }
  }

  if (contributionsTab) {
    const contribRes = await sheetsFetch<{ values?: string[][] }>(
      `${SHEETS_API_BASE}/${encodeURIComponent(meta.spreadsheetId)}/values/${encodeURIComponent(
        `'${contributionsTab}'!A1:K5000`
      )}`,
      accessToken
    );
    const rows = contribRes.values || [];
    const currentEth = getCurrentEthiopianDate();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const receiptNumber = (row[0] || '').trim().slice(0, SCHEMA_LIMITS.CONTRIBUTION_RECEIPT);
      const memberId = (row[1] || '').trim().slice(0, SCHEMA_LIMITS.CONTRIBUTION_MEMBER_ID);
      const memberName = (row[2] || '').trim().slice(0, SCHEMA_LIMITS.CONTRIBUTION_MEMBER_NAME);
      const amountNum = Number(String(row[3] || '0').replace(/,/g, ''));
      const ethMonthRaw = (row[4] || currentEth.month).trim();
      const ethiopianMonth =
        (ETHIOPIAN_MONTHS as readonly string[]).find(
          (m) => m.toLowerCase() === ethMonthRaw.toLowerCase()
        ) || ethMonthRaw.slice(0, SCHEMA_LIMITS.CONTRIBUTION_MONTH);
      const yearNum = Number(row[5] || currentEth.year);
      const paymentMethod = normalizePaymentMethod(row[6] || 'cbe');
      const transactionReference = (row[7] || '').trim().slice(0, SCHEMA_LIMITS.CONTRIBUTION_TX_REF);
      const status = normalizeContributionStatus(row[8] || 'completed');
      const notes = (row[9] || '').trim().slice(0, SCHEMA_LIMITS.CONTRIBUTION_NOTES);

      if (
        !receiptNumber ||
        !memberId ||
        !memberName ||
        Number.isNaN(amountNum) ||
        amountNum <= 0 ||
        Number.isNaN(yearNum)
      ) {
        if (row.some((cell) => String(cell || '').trim() !== '')) skippedRows += 1;
        continue;
      }

      if (existingReceipts.has(receiptNumber.toLowerCase())) {
        continue;
      }

      newContributions.push({
        memberId,
        memberName,
        receiptNumber,
        amountETB: amountNum,
        ethiopianMonth,
        ethiopianYear: yearNum,
        paymentMethod,
        transactionReference,
        notes,
        status,
      });
    }
  }

  return {
    spreadsheetId: meta.spreadsheetId,
    spreadsheetTitle: meta.title,
    newMembers,
    updatedMembers,
    newContributions,
    skippedRows,
  };
}

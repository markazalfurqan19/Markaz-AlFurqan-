import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CenterSetting, Contribution, Member, formatETB } from '../types';
import { Language, TRANSLATIONS } from '../i18n';

const LOGO_PATH = '/assets/aistudio/loog_6003b99d.jpg';
let cachedCircularLogo: string | null = null;

function sanitizePdfText(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, '-')
    .replace(/\u00B7/g, ' | ');
}

async function getCircularLogoDataUrl(): Promise<string | null> {
  if (cachedCircularLogo) return cachedCircularLogo;
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 0, 0, size, size);
        ctx.restore();

        cachedCircularLogo = canvas.toDataURL('image/png');
        resolve(cachedCircularLogo);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = LOGO_PATH;
  });
}

export async function downloadReceiptPDF(
  contribution: Contribution,
  center: CenterSetting,
  lang: Language = 'om'
) {
  const t = TRANSLATIONS[lang];
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
  const logoDataUrl = await getCircularLogoDataUrl();

  // Deep Navy Header Banner
  doc.setFillColor(11, 31, 58);
  doc.rect(0, 0, 148, 38, 'F');

  const textX = logoDataUrl ? 40 : 12;
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 10, 6, 26, 26);
  }

  doc.setTextColor(212, 175, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const cleanCenterName = sanitizePdfText(center.centerName || t.centerDefaultName);
  const titleLines = doc.splitTextToSize(cleanCenterName, logoDataUrl ? 98 : 124);
  doc.text(titleLines[0] || cleanCenterName, textX, 15);

  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('NAGAHEE KAFFALTII DIJITAALAA / OFFICIAL RECEIPT', textX, 23);
  if (center.phone || center.email) {
    doc.setFontSize(7.5);
    doc.text(
      sanitizePdfText([center.phone, center.email].filter(Boolean).join('  |  ')),
      textX,
      29
    );
  }

  // Receipt metadata box
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${t.labels.receiptNo}: ${contribution.receiptNumber}`, 12, 49);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const dateStr = contribution.createdAt
    ? new Date(contribution.createdAt).toLocaleDateString()
    : new Date().toLocaleDateString();
  doc.text(`${t.labels.date}: ${dateStr}`, 12, 55);
  doc.text(
    sanitizePdfText(`${t.labels.statusLabel}: ${t.status[contribution.status] || contribution.status}`),
    95,
    55
  );

  // Table with contribution details
  autoTable(doc, {
    startY: 63,
    margin: { left: 12, right: 12 },
    theme: 'grid',
    headStyles: { fillColor: [11, 31, 58], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 46 },
      1: { cellWidth: 78 },
    },
    head: [['Odeeffannoo / Field', 'Ibsa / Value']],
    body: [
      [t.labels.fullName, sanitizePdfText(contribution.memberName)],
      [t.labels.memberCode, contribution.memberId],
      [
        `${t.labels.ethiopianMonth} / ${t.labels.ethiopianYear}`,
        `${contribution.ethiopianMonth} ${contribution.ethiopianYear} E.C.`,
      ],
      [
        t.labels.paymentMethod,
        sanitizePdfText(t.paymentMethods[contribution.paymentMethod] || contribution.paymentMethod),
      ],
      [t.labels.txReference, contribution.transactionReference || '-'],
      [t.labels.amountETB, formatETB(contribution.amountETB)],
      [t.labels.notes, sanitizePdfText(contribution.notes) || '-'],
    ],
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 140;

  // Amount Highlight Strip (Minimalist Deep Blue)
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(30, 58, 138);
  doc.roundedRect(12, finalY + 8, 124, 16, 2, 2, 'FD');
  doc.setTextColor(11, 31, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Waliigala Kaffalame: ${formatETB(contribution.amountETB)}`, 18, finalY + 18);

  // Bank Footer
  if (center.bankAccountDetails) {
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(sanitizePdfText(center.bankAccountDetails), 124);
    doc.text(lines, 12, finalY + 34);
  }

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7.5);
  doc.text('Jazaakumullaahu Khayran - Al-Furqaan Quran Center', 12, 198);

  doc.save(`${contribution.receiptNumber}.pdf`);
}

export async function downloadLedgerReportPDF(
  contributions: Contribution[],
  members: Member[],
  center: CenterSetting,
  filterLabel: string,
  lang: Language = 'om'
) {
  const t = TRANSLATIONS[lang];
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoDataUrl = await getCircularLogoDataUrl();

  doc.setFillColor(11, 31, 58);
  doc.rect(0, 0, 297, 32, 'F');

  const textX = logoDataUrl ? 40 : 14;
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 12, 4, 24, 24);
  }

  doc.setTextColor(212, 175, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(sanitizePdfText(center.centerName || t.centerDefaultName), textX, 14);

  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    sanitizePdfText(`Gabaasa Faayinaansii Buusii  |  ${filterLabel}  |  ${new Date().toLocaleDateString()}`),
    textX,
    22
  );

  const activeTotal = contributions
    .filter((c) => c.status !== 'voided')
    .reduce((sum, c) => sum + c.amountETB, 0);

  const memberCount =
    members.length > 0 ? members.length : new Set(contributions.map((c) => c.memberId)).size;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(
    `Galmeewwan: ${contributions.length}   |   Miseensota: ${memberCount}   |   Waliigala: ${formatETB(activeTotal)}`,
    14,
    40
  );

  autoTable(doc, {
    startY: 46,
    margin: { left: 14, right: 14 },
    theme: 'striped',
    headStyles: { fillColor: [11, 31, 58], textColor: [255, 255, 255], fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
    head: [
      [
        t.labels.receiptNo,
        t.labels.memberCode,
        t.labels.fullName,
        `${t.labels.ethiopianMonth} / Bara`,
        t.labels.paymentMethod,
        t.labels.txReference,
        t.labels.statusLabel,
        t.labels.amountETB,
      ],
    ],
    body: contributions.map((c) => [
      c.receiptNumber,
      c.memberId,
      sanitizePdfText(c.memberName),
      `${c.ethiopianMonth} ${c.ethiopianYear}`,
      sanitizePdfText(t.paymentMethods[c.paymentMethod] || c.paymentMethod),
      c.transactionReference || '-',
      sanitizePdfText(t.status[c.status] || c.status),
      formatETB(c.amountETB),
    ]),
  });

  doc.save(`Al-Furqaan-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function escapeCSV(val: string | number | undefined): string {
  const s = val === undefined || val === null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadContributionsCSV(contributions: Contribution[]) {
  const headers = [
    'ReceiptNumber',
    'MemberID',
    'MemberName',
    'AmountETB',
    'EthiopianMonth',
    'EthiopianYear',
    'PaymentMethod',
    'TransactionReference',
    'Status',
    'Notes',
    'CreatedAt',
  ];
  const rows = contributions.map((c) => [
    escapeCSV(c.receiptNumber),
    escapeCSV(c.memberId),
    escapeCSV(c.memberName),
    escapeCSV(c.amountETB),
    escapeCSV(c.ethiopianMonth),
    escapeCSV(c.ethiopianYear),
    escapeCSV(c.paymentMethod),
    escapeCSV(c.transactionReference),
    escapeCSV(c.status),
    escapeCSV(c.notes),
    escapeCSV(c.createdAt),
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `al-furqaan-contributions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadMembersCSV(members: Member[]) {
  const headers = [
    'MemberCode',
    'FullName',
    'PhoneNumber',
    'Email',
    'City',
    'MonthlyPledgeETB',
    'Status',
    'CreatedAt',
  ];
  const rows = members.map((m) => [
    escapeCSV(m.memberId),
    escapeCSV(m.fullName),
    escapeCSV(m.phoneNumber),
    escapeCSV(m.email),
    escapeCSV(m.city),
    escapeCSV(m.monthlyPledgeETB),
    escapeCSV(m.status),
    escapeCSV(m.createdAt),
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `al-furqaan-members-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface PrintableReceiptData {
  recipientEmail: string;
  centerName: string;
  centerContact: string;
  logoUrl: string;
  receiptNumber: string;
  formattedDate: string;
  memberName: string;
  memberId: string;
  ethiopianPeriod: string;
  paymentMethodLabel: string;
  transactionReference: string;
  statusLabel: string;
  formattedAmount: string;
  notes: string;
  bankAccountDetails: string;
  loggedAt: string;
}

export function formatPrintableReceipt(
  contribution: Contribution,
  recipientEmail: string,
  center: CenterSetting,
  lang: Language = 'om'
): PrintableReceiptData {
  const t = TRANSLATIONS[lang];
  const loggedAt = new Date().toISOString();
  const formattedDate = contribution.createdAt
    ? new Date(contribution.createdAt).toLocaleDateString()
    : new Date().toLocaleDateString();

  const payload: PrintableReceiptData = {
    recipientEmail,
    centerName: center.centerName || t.centerDefaultName,
    centerContact: [center.phone, center.email].filter(Boolean).join(' · '),
    logoUrl: LOGO_PATH,
    receiptNumber: contribution.receiptNumber,
    formattedDate,
    memberName: contribution.memberName,
    memberId: contribution.memberId,
    ethiopianPeriod: `${contribution.ethiopianMonth} ${contribution.ethiopianYear} E.C.`,
    paymentMethodLabel: t.paymentMethods[contribution.paymentMethod] || contribution.paymentMethod,
    transactionReference: contribution.transactionReference || '—',
    statusLabel: t.status[contribution.status] || contribution.status,
    formattedAmount: formatETB(contribution.amountETB),
    notes: contribution.notes || '—',
    bankAccountDetails: center.bankAccountDetails || '',
    loggedAt,
  };

  console.info('[Al-Furqaan] Send Receipt action logged:', {
    recipientEmail: payload.recipientEmail,
    receiptNumber: payload.receiptNumber,
    memberId: payload.memberId,
    memberName: payload.memberName,
    ethiopianPeriod: payload.ethiopianPeriod,
    amount: payload.formattedAmount,
    loggedAt: payload.loggedAt,
  });

  return payload;
}

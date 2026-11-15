import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Printer,
  X,
} from 'lucide-react';
import {
  CenterSetting,
  Contribution,
  ETHIOPIAN_MONTHS,
  Member,
  formatETB,
  getCurrentEthiopianDate,
} from '../types';
import { Language, TRANSLATIONS } from '../i18n';
import { downloadReceiptPDF } from '../utils/pdfGenerator';
import { ProofPreviewModal } from './ProofPreviewModal';

interface MemberPaymentHistoryProps {
  member: Member;
  contributions: Contribution[];
  centerSettings: CenterSetting;
  lang: Language;
  onClose: () => void;
  onRecordForMember: (member: Member) => void;
  onPrintReceipt: (contribution: Contribution) => void;
}

export const MemberPaymentHistory: React.FC<MemberPaymentHistoryProps> = ({
  member,
  contributions,
  centerSettings,
  lang,
  onClose,
  onRecordForMember,
  onPrintReceipt,
}) => {
  const t = TRANSLATIONS[lang];
  const currentEth = getCurrentEthiopianDate();

  const memberContributions = useMemo(() => {
    return contributions
      .filter((c) => c.memberId === member.memberId)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [contributions, member.memberId]);

  const availableYears = useMemo(() => {
    const yrs = new Set<number>([currentEth.year]);
    memberContributions.forEach((c) => yrs.add(c.ethiopianYear));
    return Array.from(yrs).sort((a, b) => b - a);
  }, [memberContributions, currentEth.year]);

  const [selectedYear, setSelectedYear] = useState<number>(currentEth.year);
  const [proofPreview, setProofPreview] = useState<Contribution | null>(null);

  const totalContributed = useMemo(
    () =>
      memberContributions
        .filter((c) => c.status !== 'voided')
        .reduce((sum, c) => sum + c.amountETB, 0),
    [memberContributions]
  );

  const regularityStats = useMemo(() => {
    const validForYear = memberContributions.filter(
      (c) => c.status !== 'voided' && c.ethiopianYear === selectedYear
    );
    const currentMonthIdx = ETHIOPIAN_MONTHS.indexOf(
      currentEth.month as (typeof ETHIOPIAN_MONTHS)[number]
    );
    const expectedCutoffIdx =
      selectedYear === currentEth.year && currentMonthIdx >= 0
        ? currentMonthIdx
        : selectedYear < currentEth.year
        ? ETHIOPIAN_MONTHS.length - 1
        : -1;

    const chartData = ETHIOPIAN_MONTHS.map((month, idx) => {
      const amount = validForYear
        .filter((c) => c.ethiopianMonth === month)
        .reduce((sum, c) => sum + c.amountETB, 0);
      const isDue = idx <= expectedCutoffIdx;
      const isMissed = isDue && amount === 0;
      return {
        month: month.slice(0, 3),
        fullMonth: month,
        amount,
        isDue,
        isMissed,
      };
    });

    const dueMonths = chartData.filter((d) => d.isDue);
    const paidDueCount = dueMonths.filter((d) => d.amount > 0).length;
    const missedMonths = dueMonths.filter((d) => d.isMissed).map((d) => d.fullMonth);
    const regularityPct =
      dueMonths.length > 0 ? Math.round((paidDueCount / dueMonths.length) * 100) : 100;

    return {
      chartData,
      dueCount: dueMonths.length,
      paidDueCount,
      missedMonths,
      regularityPct,
    };
  }, [memberContributions, selectedYear, currentEth.month, currentEth.year]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1B3158] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/assets/aistudio/loog_6003b99d.jpg"
            alt="Al-Furqaan Logo"
            className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-[#1B3158] bg-white shrink-0"
          />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {t.labels.contributionHistory}
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {member.fullName} · <span className="font-mono-tabular">{member.memberId}</span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onRecordForMember(member)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white whitespace-nowrap shrink-0"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>{t.actions.recordPayment}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.labels.closePanel}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#13294E] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Member Info & Total Strip */}
      <div className="px-5 py-3 border-b border-slate-200 dark:border-[#1B3158] bg-slate-50/70 dark:bg-[#060E1F]/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-slate-600 dark:text-slate-400">
          <span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{t.labels.phone}:</span>{' '}
            <span className="font-mono-tabular">{member.phoneNumber}</span>
          </span>
          {member.email && (
            <span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Email:</span>{' '}
              <span>{member.email}</span>
            </span>
          )}
          <span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{t.labels.monthlyPledge}:</span>{' '}
            <span className="font-mono-tabular">{formatETB(member.monthlyPledgeETB)}</span>
          </span>
        </div>

        <div className="font-mono-tabular text-slate-600 dark:text-slate-400">
          <span>
            {memberContributions.length} {lang === 'om' ? 'galmee' : 'records'}
          </span>
          <span className="mx-2" aria-hidden="true">·</span>
          <span className="font-bold text-[#1E3A8A] dark:text-blue-400">
            {formatETB(totalContributed)}
          </span>
        </div>
      </div>

      {/* Payment Regularity Trend & Missed Months Detector */}
      <div className="p-5 border-b border-slate-200 dark:border-[#1B3158] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              {t.labels.paymentRegularity} · {selectedYear} E.C.
            </h4>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-mono-tabular font-semibold text-[#1E3A8A] dark:text-blue-300">
                {regularityStats.paidDueCount} / {regularityStats.dueCount}{' '}
                {lang === 'om' ? "ji'a kaffalame" : 'months paid'} ({regularityStats.regularityPct}%)
              </span>
              {regularityStats.missedMonths.length === 0 ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t.labels.allCaughtUp}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>
                    {t.labels.missedMonths}: {regularityStats.missedMonths.length}
                  </span>
                </span>
              )}
            </div>
          </div>

          <select
            aria-label={t.labels.ethiopianYear}
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-2.5 py-1.5 text-xs font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr} E.C.
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Small Regularity Trend Line */}
          <div className="lg:col-span-7 h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={regularityStats.chartData}
                margin={{ top: 8, right: 10, left: -12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: unknown) => [formatETB(Number(value || 0)), t.labels.amountETB]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullMonth
                      ? `${payload[0].payload.fullMonth} ${selectedYear} E.C.`
                      : ''
                  }
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '11px',
                  }}
                />
                {member.monthlyPledgeETB > 0 && (
                  <ReferenceLine
                    y={member.monthlyPledgeETB}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#1D4ED8"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#0B1F3A', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                  activeDot={{ r: 4.5, fill: '#1D4ED8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 13-Month Status Grid + Missed List */}
          <div className="lg:col-span-5 space-y-2">
            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 gap-1.5">
              {regularityStats.chartData.map((item) => (
                <div
                  key={item.fullMonth}
                  title={`${item.fullMonth}: ${
                    item.amount > 0
                      ? formatETB(item.amount)
                      : item.isMissed
                      ? t.labels.unpaid
                      : '—'
                  }`}
                  className={`rounded-md border px-2 py-1 text-[10px] font-semibold flex items-center justify-between gap-1 ${
                    item.amount > 0
                      ? 'border-blue-200 dark:border-blue-900 bg-blue-50/80 dark:bg-blue-950/40 text-[#0B1F3A] dark:text-blue-300'
                      : item.isMissed
                      ? 'border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'
                      : 'border-slate-200 dark:border-[#1B3158] bg-slate-50/60 dark:bg-[#060E1F]/50 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <span className="truncate">{item.month}</span>
                  <span className="font-mono-tabular shrink-0">
                    {item.amount > 0 ? '✓' : item.isMissed ? '!' : '·'}
                  </span>
                </div>
              ))}
            </div>

            {regularityStats.missedMonths.length > 0 && (
              <div className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                <span className="font-semibold">{t.labels.missedMonths}: </span>
                <span>{regularityStats.missedMonths.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment History Table */}
      {memberContributions.length === 0 ? (
        <div className="p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {t.labels.emptyContributions}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.labels.emptyContributionsHint}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#1B3158] text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/40 dark:bg-[#060E1F]/40">
                <th className="py-2.5 px-4 whitespace-nowrap">{t.labels.contributionDate}</th>
                <th className="py-2.5 px-4 whitespace-nowrap">{t.labels.receiptNo}</th>
                <th className="py-2.5 px-4 whitespace-nowrap">{t.labels.ethiopianMonth}</th>
                <th className="py-2.5 px-4 whitespace-nowrap">{t.labels.paymentMethod}</th>
                <th className="py-2.5 px-4 whitespace-nowrap">{t.labels.proofColumn}</th>
                <th className="py-2.5 px-4 whitespace-nowrap">{t.labels.statusLabel}</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">{t.labels.amountETB}</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">{t.labels.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1B3158]/80 text-xs">
              {memberContributions.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50 dark:hover:bg-[#13294E]/50 transition-colors"
                >
                  <td className="py-2.5 px-4 font-mono-tabular text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2.5 px-4 font-mono-tabular font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    {c.receiptNumber}
                  </td>
                  <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {c.ethiopianMonth} {c.ethiopianYear}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {t.paymentMethods[c.paymentMethod] || c.paymentMethod}
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    {c.proofFileUrl ? (
                      <button
                        type="button"
                        onClick={() => setProofPreview(c)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E3A8A] dark:text-blue-300 hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t.labels.viewProof}</span>
                      </button>
                    ) : (
                      <span className="font-mono-tabular text-slate-500 dark:text-slate-400">
                        {c.transactionReference || '—'}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        c.status === 'verified' || c.status === 'completed'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : c.status === 'pending'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {t.status[c.status] || c.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatETB(c.amountETB)}
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onPrintReceipt(c)}
                        title={t.actions.printReceipt}
                        aria-label={t.actions.printReceipt}
                        className="p-1.5 rounded-md text-[#0B1F3A] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-[#13294E] transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadReceiptPDF(c, centerSettings, lang)}
                        title={t.actions.downloadReceipt}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-[#1B3158] px-2 py-1 text-[11px] font-semibold text-[#1E3A8A] dark:text-blue-300 hover:bg-slate-100 dark:hover:bg-[#13294E] whitespace-nowrap shrink-0"
                      >
                        <FileText className="w-3 h-3" />
                        <span>PDF</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProofPreviewModal
        contribution={proofPreview}
        lang={lang}
        onClose={() => setProofPreview(null)}
      />
    </div>
  );
};

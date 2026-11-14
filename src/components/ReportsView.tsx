import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import {
  CenterSetting,
  Contribution,
  ETHIOPIAN_MONTHS,
  Member,
  formatETB,
  getCurrentEthiopianDate,
} from '../types';
import { Language, TRANSLATIONS } from '../i18n';
import {
  downloadContributionsCSV,
  downloadLedgerReportPDF,
  downloadMembersCSV,
} from '../utils/pdfGenerator';
import { MonthlyTrendChart } from './MonthlyTrendChart';

interface ReportsViewProps {
  members: Member[];
  contributions: Contribution[];
  centerSettings: CenterSetting;
  lang: Language;
  onOpenSheetsSync: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  members,
  contributions,
  centerSettings,
  lang,
  onOpenSheetsSync,
}) => {
  const t = TRANSLATIONS[lang];
  const currentEth = getCurrentEthiopianDate();

  const availableYears = useMemo(() => {
    const yrs = new Set<number>([currentEth.year]);
    contributions.forEach((c) => yrs.add(c.ethiopianYear));
    return Array.from(yrs).sort((a, b) => b - a);
  }, [contributions, currentEth.year]);

  const [selectedYear, setSelectedYear] = useState<number>(currentEth.year);

  const filteredMembers = useMemo(
    () => members.filter((m) => m.status === 'active'),
    [members]
  );

  const yearContributions = useMemo(
    () =>
      contributions.filter(
        (c) => c.status !== 'voided' && c.ethiopianYear === selectedYear
      ),
    [contributions, selectedYear]
  );

  const paymentLookup = useMemo(() => {
    const map = new Map<string, number>();
    yearContributions.forEach((c) => {
      const key = `${c.memberId}__${c.ethiopianMonth}`;
      map.set(key, (map.get(key) || 0) + c.amountETB);
    });
    return map;
  }, [yearContributions]);

  const yearTotal = useMemo(
    () => yearContributions.reduce((sum, c) => sum + c.amountETB, 0),
    [yearContributions]
  );

  return (
    <div className="space-y-6">
      {/* Official Document Header */}
      <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <img
            src="/assets/aistudio/loog_6003b99d.jpg"
            alt="Al-Furqaan Logo"
            className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-[#1B3158] bg-white shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {centerSettings.centerName || t.centerDefaultName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.nav.reports} · {selectedYear} E.C.
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
          {[centerSettings.phone, centerSettings.email].filter(Boolean).join(' · ')}
        </div>
      </div>

      {/* Export Actions & Filters */}
      <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              {t.labels.ethiopianYear}
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-lg border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3 py-2 text-xs font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr} E.C.
                </option>
              ))}
            </select>
          </div>

          <div className="pl-2">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {selectedYear} E.C. {t.kpi.totalCollected}
            </div>
            <div className="text-base font-bold font-mono-tabular text-[#1E3A8A] dark:text-blue-400">
              {formatETB(yearTotal)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void downloadLedgerReportPDF(
                yearContributions,
                filteredMembers,
                centerSettings,
                `${selectedYear} E.C.`,
                lang
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t.actions.exportPDF}</span>
          </button>
          <button
            type="button"
            onClick={onOpenSheetsSync}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E3A8A]/30 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-2 text-xs font-semibold text-[#0B1F3A] dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t.actions.syncGoogleSheets}</span>
          </button>
          <button
            type="button"
            onClick={() => downloadContributionsCSV(yearContributions)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#1B3158] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#13294E] whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t.actions.exportCSV} (Buusii)</span>
          </button>
          <button
            type="button"
            onClick={() => downloadMembersCSV(members)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#1B3158] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#13294E] whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.actions.exportCSV} (Miseensa)</span>
          </button>
        </div>
      </div>

      {/* Monthly Trend Line Chart */}
      <MonthlyTrendChart
        contributions={contributions}
        ethiopianYear={selectedYear}
        lang={lang}
      />

      {/* Ethiopian Calendar Monthly Matrix */}
      <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1B3158] flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {t.labels.monthlyMatrix} · {selectedYear} E.C.
          </h3>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">✓ {t.labels.paid}</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>— {t.labels.unpaid}</span>
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            {t.labels.emptyMembers}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1B3158] text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#060E1F]/60">
                  <th className="py-2.5 px-3 sticky left-0 bg-slate-50 dark:bg-[#060E1F] z-10">
                    {t.labels.fullName}
                  </th>
                  {ETHIOPIAN_MONTHS.map((m) => (
                    <th key={m} className="py-2.5 px-2 text-center whitespace-nowrap">
                      {m.slice(0, 4)}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-right">{t.kpi.totalCollected}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1B3158]/80 text-xs">
                {filteredMembers.map((member) => {
                  let memberYearSum = 0;
                  return (
                    <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-[#13294E]/50">
                      <td className="py-2.5 px-3 sticky left-0 bg-white dark:bg-[#0B1933] z-10 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {member.fullName}
                        </div>
                        <div className="text-[11px] font-mono-tabular text-slate-500">
                          {member.memberId}
                        </div>
                      </td>
                      {ETHIOPIAN_MONTHS.map((month) => {
                        const paidAmount = paymentLookup.get(`${member.memberId}__${month}`) || 0;
                        memberYearSum += paidAmount;
                        return (
                          <td
                            key={month}
                            className="py-2.5 px-2 text-center font-mono-tabular"
                            title={paidAmount > 0 ? formatETB(paidAmount) : t.labels.unpaid}
                          >
                            {paidAmount > 0 ? (
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                {paidAmount >= 1000
                                  ? `${(paidAmount / 1000).toFixed(1)}k`
                                  : paidAmount}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatETB(memberYearSum)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

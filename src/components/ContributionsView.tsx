import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import {
  CenterSetting,
  Contribution,
  ContributionStatus,
  ETHIOPIAN_MONTHS,
  PaymentMethod,
  formatETB,
  getCurrentEthiopianDate,
} from '../types';
import { Language, TRANSLATIONS } from '../i18n';
import {
  downloadContributionsCSV,
  downloadLedgerReportPDF,
  downloadReceiptPDF,
} from '../utils/pdfGenerator';
import { PrintReceiptModal } from './PrintReceiptModal';
import { ProofPreviewModal } from './ProofPreviewModal';

interface ContributionsViewProps {
  contributions: Contribution[];
  centerSettings: CenterSetting;
  loading: boolean;
  isAdmin: boolean;
  lang: Language;
  onAddContribution: () => void;
  onEditContribution: (c: Contribution) => void;
  onQuickVerify: (c: Contribution) => Promise<void>;
  onDeleteContribution: (c: Contribution) => Promise<void>;
}

export const ContributionsView: React.FC<ContributionsViewProps> = ({
  contributions,
  centerSettings,
  loading,
  isAdmin,
  lang,
  onAddContribution,
  onEditContribution,
  onQuickVerify,
  onDeleteContribution,
}) => {
  const t = TRANSLATIONS[lang];
  const currentEth = getCurrentEthiopianDate();
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ContributionStatus>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [printContribution, setPrintContribution] = useState<Contribution | null>(null);
  const [proofPreview, setProofPreview] = useState<Contribution | null>(null);

  const availableYears = useMemo(() => {
    const yrs = new Set<number>([currentEth.year]);
    contributions.forEach((c) => yrs.add(c.ethiopianYear));
    return Array.from(yrs).sort((a, b) => b - a);
  }, [contributions, currentEth.year]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...contributions]
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .filter((c) => {
        if (monthFilter !== 'all' && c.ethiopianMonth !== monthFilter) return false;
        if (yearFilter !== 'all' && c.ethiopianYear !== Number(yearFilter)) return false;
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        if (methodFilter !== 'all' && c.paymentMethod !== methodFilter) return false;
        if (!q) return true;
        return (
          c.memberName.toLowerCase().includes(q) ||
          c.memberId.toLowerCase().includes(q) ||
          c.receiptNumber.toLowerCase().includes(q) ||
          (c.proofFileName || '').toLowerCase().includes(q) ||
          (c.transactionReference || '').toLowerCase().includes(q)
        );
      });
  }, [contributions, search, monthFilter, yearFilter, statusFilter, methodFilter]);

  const filteredTotal = useMemo(
    () =>
      filtered
        .filter((c) => c.status !== 'voided')
        .reduce((sum, c) => sum + c.amountETB, 0),
    [filtered]
  );

  const filterLabel = useMemo(() => {
    const parts: string[] = [];
    if (monthFilter !== 'all') parts.push(monthFilter);
    if (yearFilter !== 'all') parts.push(`${yearFilter} E.C.`);
    if (parts.length === 0) return t.nav.contributions;
    return parts.join(' ');
  }, [monthFilter, yearFilter, t.nav.contributions]);

  const currentYearMonthlySummary = useMemo(() => {
    const yearContributions = contributions.filter(
      (c) => c.status !== 'voided' && c.ethiopianYear === currentEth.year
    );
    const total = yearContributions.reduce((sum, c) => sum + c.amountETB, 0);
    const months = ETHIOPIAN_MONTHS.map((month) => {
      const monthItems = yearContributions.filter((c) => c.ethiopianMonth === month);
      const amount = monthItems.reduce((sum, c) => sum + c.amountETB, 0);
      return {
        month,
        amount,
        count: monthItems.length,
      };
    });
    return { total, months };
  }, [contributions, currentEth.year]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-6 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 rounded bg-slate-100 dark:bg-[#13294E] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.labels.searchContributions}
              className="w-full rounded-lg border border-slate-200 dark:border-[#1B3158] bg-slate-50 dark:bg-[#060E1F] pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Ethiopian Month & Year Picker */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-2.5 py-1 gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-blue-400 shrink-0" />
              <select
                aria-label={t.labels.ethiopianMonth}
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="bg-transparent py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">{t.labels.allMonths}</option>
                {ETHIOPIAN_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <select
                aria-label={t.labels.ethiopianYear}
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="bg-transparent py-1 text-xs font-mono-tabular text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">{t.labels.allYears}</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={String(yr)}>
                    {yr} E.C.
                  </option>
                ))}
              </select>
            </div>

            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as 'all' | PaymentMethod)}
              className="rounded-lg border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="all">{t.labels.paymentMethod}: {t.labels.allStatuses}</option>
              {(['cbe', 'telebirr', 'awash', 'cbe_birr', 'cash', 'bank_transfer', 'other'] as PaymentMethod[]).map(
                (m) => (
                  <option key={m} value={m}>
                    {t.paymentMethods[m]}
                  </option>
                )
              )}
            </select>

            <button
              type="button"
              disabled={filtered.length === 0}
              onClick={() =>
                void downloadLedgerReportPDF(
                  filtered,
                  [],
                  centerSettings,
                  filterLabel,
                  lang
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#1B3158] px-3.5 py-2 text-xs font-semibold text-[#0B1F3A] dark:text-blue-300 hover:bg-slate-50 dark:hover:bg-[#13294E] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{t.actions.exportPDF}</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                disabled={filtered.length === 0}
                onClick={() => downloadContributionsCSV(filtered)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#1B3158] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#13294E] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.actions.exportCSV}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onAddContribution}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.actions.recordPayment}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-[#1B3158]">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#060E1F]">
            {(['all', 'completed', 'verified', 'pending', 'voided'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-white dark:bg-[#13294E] text-[#0B1F3A] dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st === 'all' ? t.labels.allStatuses : t.status[st]}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 font-mono-tabular">
            <span>{filtered.length} {lang === 'om' ? 'galmee' : 'records'}</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {formatETB(filteredTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* Current Year Summary by Ethiopian Month */}
      <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-[#1B3158] flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-900 dark:text-white">
            {t.labels.monthlySummaryTitle} · {currentEth.year} E.C.
          </div>
          <div className="text-xs font-mono-tabular text-slate-600 dark:text-slate-300">
            <span>{t.kpi.totalCollected}: </span>
            <strong className="text-[#0B1F3A] dark:text-blue-300">
              {formatETB(currentYearMonthlySummary.total)}
            </strong>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-[#1B3158]">
          {currentYearMonthlySummary.months.map((item) => {
            const isSelected =
              monthFilter === item.month && yearFilter === String(currentEth.year);
            return (
              <button
                key={item.month}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setMonthFilter('all');
                    setYearFilter('all');
                  } else {
                    setMonthFilter(item.month);
                    setYearFilter(String(currentEth.year));
                  }
                }}
                className={`px-3.5 py-2.5 text-left transition-colors ${
                  isSelected
                    ? 'bg-blue-50/90 dark:bg-[#13294E]'
                    : 'hover:bg-slate-50 dark:hover:bg-[#13294E]/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-medium truncate">{item.month}</span>
                  <span className="font-mono-tabular shrink-0">{item.count}</span>
                </div>
                <div
                  className={`mt-0.5 text-xs font-bold font-mono-tabular ${
                    item.amount > 0
                      ? 'text-[#0B1F3A] dark:text-blue-300'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {formatETB(item.amount)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t.labels.emptyContributions}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {t.labels.emptyContributionsHint}
            </p>
            <button
              type="button"
              onClick={onAddContribution}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-blue-700 px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.actions.recordPayment}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1B3158] text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#060E1F]/60">
                  <th className="py-2.5 px-3 whitespace-nowrap">{t.labels.receiptNo}</th>
                  <th className="py-2.5 px-3">{t.labels.fullName}</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">{t.labels.ethiopianMonth}</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">{t.labels.paymentMethod}</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">{t.labels.proofColumn}</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">{t.labels.statusLabel}</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">{t.labels.amountETB}</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">{t.labels.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1B3158]/80 text-xs">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50 dark:hover:bg-[#13294E]/50 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono-tabular font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {c.receiptNumber}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {c.memberName}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-slate-500">
                        {c.memberId}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {c.ethiopianMonth} {c.ethiopianYear}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {t.paymentMethods[c.paymentMethod] || c.paymentMethod}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
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
                    <td className="py-2.5 px-3 whitespace-nowrap">
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
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatETB(c.amountETB)}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {c.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => void onQuickVerify(c)}
                            title={t.actions.verifyPayment}
                            className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPrintContribution(c)}
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
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-[#1B3158] px-2 py-1 text-[11px] font-semibold text-[#0B1F3A] dark:text-blue-300 hover:bg-slate-100 dark:hover:bg-[#13294E] whitespace-nowrap shrink-0"
                        >
                          <FileText className="w-3 h-3" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditContribution(c)}
                          title={t.actions.edit}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && (
                          confirmDeleteId === c.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  void onDeleteContribution(c);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 rounded bg-rose-600 text-[11px] font-semibold text-white"
                              >
                                {t.actions.delete}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-1 rounded text-[11px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(c.id)}
                              title={t.actions.delete}
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PrintReceiptModal
        contribution={printContribution}
        centerSettings={centerSettings}
        lang={lang}
        onClose={() => setPrintContribution(null)}
      />

      <ProofPreviewModal
        contribution={proofPreview}
        lang={lang}
        onClose={() => setProofPreview(null)}
      />
    </div>
  );
};

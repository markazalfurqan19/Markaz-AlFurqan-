import React, { useMemo } from 'react';
import { CreditCard, FileText, X } from 'lucide-react';
import { CenterSetting, Contribution, Member, formatETB } from '../types';
import { Language, TRANSLATIONS } from '../i18n';
import { downloadReceiptPDF } from '../utils/pdfGenerator';

interface MemberHistoryModalProps {
  member: Member | null;
  contributions: Contribution[];
  centerSettings: CenterSetting;
  lang: Language;
  onClose: () => void;
  onRecordForMember: (member: Member) => void;
}

export const MemberHistoryModal: React.FC<MemberHistoryModalProps> = ({
  member,
  contributions,
  centerSettings,
  lang,
  onClose,
  onRecordForMember,
}) => {
  const t = TRANSLATIONS[lang];

  const memberContributions = useMemo(() => {
    if (!member) return [];
    return contributions
      .filter((c) => c.memberId === member.memberId)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [contributions, member]);

  const totalContributed = useMemo(
    () =>
      memberContributions
        .filter((c) => c.status !== 'voided')
        .reduce((sum, c) => sum + c.amountETB, 0),
    [memberContributions]
  );

  if (!member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060E1F]/70 p-4 backdrop-blur-xs">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header with Al-Furqaan Logo */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1B3158] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/loog_6003b99d.jpg"
              alt="Al-Furqaan Logo"
              className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-[#1B3158] bg-white shrink-0"
            />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                {t.labels.contributionHistory}
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {member.fullName} · <span className="font-mono-tabular">{member.memberId}</span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#13294E] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary Metadata Strip */}
        <div className="px-6 py-3.5 border-b border-slate-200 dark:border-[#1B3158] bg-slate-50/70 dark:bg-[#060E1F]/60 flex flex-wrap items-center justify-between gap-4 text-xs">
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

        {/* Contributions List */}
        <div className="flex-1 overflow-y-auto">
          {memberContributions.length === 0 ? (
            <div className="p-12 text-center space-y-3">
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
                    <th className="py-2.5 px-4">{t.labels.receiptNo}</th>
                    <th className="py-2.5 px-4">{t.labels.ethiopianMonth}</th>
                    <th className="py-2.5 px-4">{t.labels.paymentMethod}</th>
                    <th className="py-2.5 px-4">{t.labels.txReference}</th>
                    <th className="py-2.5 px-4">{t.labels.statusLabel}</th>
                    <th className="py-2.5 px-4 text-right">{t.labels.amountETB}</th>
                    <th className="py-2.5 px-4 text-right">{t.actions.downloadReceipt}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1B3158]/80 text-xs">
                  {memberContributions.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50 dark:hover:bg-[#13294E]/50 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono-tabular font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {c.receiptNumber}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {c.ethiopianMonth} {c.ethiopianYear}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {t.paymentMethods[c.paymentMethod] || c.paymentMethod}
                      </td>
                      <td className="py-2.5 px-4 font-mono-tabular text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {c.transactionReference || '—'}
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
                        <button
                          type="button"
                          onClick={() => void downloadReceiptPDF(c, centerSettings, lang)}
                          title={t.actions.downloadReceipt}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] dark:text-blue-400 hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-[#1B3158] flex items-center justify-between gap-3 bg-white dark:bg-[#0B1933]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onRecordForMember(member);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>{t.actions.recordPayment}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-[#1B3158] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13294E] whitespace-nowrap shrink-0"
          >
            {lang === 'om' ? 'Cufi' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

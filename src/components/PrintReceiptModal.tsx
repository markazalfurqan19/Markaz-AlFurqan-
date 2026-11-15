import React, { useRef } from 'react';
import { FileText, Printer, X } from 'lucide-react';
import { CenterSetting, Contribution, formatETB } from '../types';
import { Language, TRANSLATIONS } from '../i18n';
import { downloadReceiptPDF } from '../utils/pdfGenerator';
import { printSheetElement } from '../utils/printHelper';

interface PrintReceiptModalProps {
  contribution: Contribution | null;
  centerSettings: CenterSetting;
  lang: Language;
  onClose: () => void;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  contribution,
  centerSettings,
  lang,
  onClose,
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  if (!contribution) return null;

  const t = TRANSLATIONS[lang];
  const centerName = centerSettings.centerName || t.centerDefaultName;
  const centerContact = [centerSettings.phone, centerSettings.email].filter(Boolean).join(' · ');
  const formattedDate = contribution.createdAt
    ? new Date(contribution.createdAt).toLocaleDateString()
    : new Date().toLocaleDateString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060E1F]/70 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Bar (hidden when printing) */}
        <div className="no-print px-6 py-4 border-b border-slate-200 dark:border-[#1B3158] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {t.actions.printReceipt}
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white truncate font-mono-tabular">
              {contribution.receiptNumber}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.labels.closePanel}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#13294E] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Print-Optimized Receipt Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <div
            ref={sheetRef}
            className="print-receipt-sheet rounded-xl border border-slate-200 bg-white text-slate-900 overflow-hidden"
          >
            {/* Organization Header */}
            <div className="bg-[#0B1F3A] px-6 py-5 flex items-center gap-4 text-white">
              <img
                src="/assets/aistudio/loog_6003b99d.jpg"
                alt="Al-Furqaan Logo"
                className="w-14 h-14 rounded-full object-cover border border-amber-300/40 bg-white shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-base font-bold text-[#D4AF37] leading-snug">
                  {centerName}
                </div>
                <div className="text-[11px] text-slate-200 tracking-wide mt-0.5">
                  NAGAHEE KAFFALTII DIJITAALAA / OFFICIAL PAYMENT RECEIPT
                </div>
                {centerContact && (
                  <div className="text-[11px] text-slate-300 mt-1 font-mono-tabular">
                    {centerContact}
                  </div>
                )}
              </div>
            </div>

            {/* Receipt Details */}
            <div className="p-6 space-y-5 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="text-[11px] font-medium text-slate-500">
                    {t.labels.receiptNo}
                  </div>
                  <div className="text-base font-bold font-mono-tabular text-slate-900 mt-0.5">
                    {contribution.receiptNumber}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-medium text-slate-500">
                    {t.labels.contributionDate}
                  </div>
                  <div className="font-mono-tabular font-semibold text-slate-900 mt-0.5">
                    {formattedDate}
                  </div>
                  <div className="text-[11px] font-semibold text-[#1E3A8A] mt-0.5">
                    {t.status[contribution.status] || contribution.status}
                  </div>
                </div>
              </div>

              <table className="w-full text-left border-collapse border border-slate-200">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <th className="py-2.5 px-3.5 bg-slate-50 font-semibold text-slate-700 w-44">
                      {t.labels.fullName}
                    </th>
                    <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                      {contribution.memberName}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-2.5 px-3.5 bg-slate-50 font-semibold text-slate-700">
                      {t.labels.memberCode}
                    </th>
                    <td className="py-2.5 px-3.5 font-mono-tabular text-slate-800">
                      {contribution.memberId}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-2.5 px-3.5 bg-slate-50 font-semibold text-slate-700">
                      {t.labels.ethiopianMonth} / {t.labels.ethiopianYear}
                    </th>
                    <td className="py-2.5 px-3.5 text-slate-800">
                      {contribution.ethiopianMonth} {contribution.ethiopianYear} E.C.
                    </td>
                  </tr>
                  <tr>
                    <th className="py-2.5 px-3.5 bg-slate-50 font-semibold text-slate-700">
                      {t.labels.paymentMethod}
                    </th>
                    <td className="py-2.5 px-3.5 text-slate-800">
                      {t.paymentMethods[contribution.paymentMethod] || contribution.paymentMethod}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-2.5 px-3.5 bg-slate-50 font-semibold text-slate-700">
                      {t.labels.proofColumn}
                    </th>
                    <td className="py-2.5 px-3.5 font-mono-tabular text-slate-800">
                      {contribution.proofFileName || contribution.transactionReference || '—'}
                    </td>
                  </tr>
                  {contribution.notes && (
                    <tr>
                      <th className="py-2.5 px-3.5 bg-slate-50 font-semibold text-slate-700">
                        {t.labels.notes}
                      </th>
                      <td className="py-2.5 px-3.5 text-slate-700">{contribution.notes}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="rounded-lg border border-[#1E3A8A]/30 bg-blue-50 px-4 py-3.5 flex items-center justify-between">
                <span className="font-bold text-[#0B1F3A]">
                  {lang === 'om' ? 'Waliigala Kaffalame' : 'Total Amount Paid'}
                </span>
                <span className="text-lg font-bold font-mono-tabular text-[#0B1F3A]">
                  {formatETB(contribution.amountETB)}
                </span>
              </div>

              {centerSettings.bankAccountDetails && (
                <div className="text-[11px] text-slate-600 border-t border-slate-200 pt-3">
                  <span className="font-semibold text-slate-700">{t.labels.bankDetails}: </span>
                  {centerSettings.bankAccountDetails}
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex items-end justify-between gap-4 text-[11px] text-slate-500">
                <div>Jazaakumullaahu Khayran — {centerName}</div>
                <div className="text-right">
                  <div className="w-36 border-b border-slate-300 mb-1" />
                  <span>{lang === 'om' ? 'Mallattoo / Chaappaa' : 'Authorized Signature'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons (hidden when printing) */}
        <div className="no-print px-6 py-4 border-t border-slate-200 dark:border-[#1B3158] flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#0B1933]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-[#1B3158] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13294E] whitespace-nowrap shrink-0"
          >
            {t.labels.closePanel}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void downloadReceiptPDF(contribution, centerSettings, lang)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-[#1B3158] text-xs font-semibold text-[#0B1F3A] dark:text-blue-300 hover:bg-slate-100 dark:hover:bg-[#13294E] whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{t.actions.downloadReceipt}</span>
            </button>
            <button
              type="button"
              onClick={() => printSheetElement(sheetRef.current, contribution.receiptNumber)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 text-xs font-semibold text-white whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t.actions.printReceipt}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

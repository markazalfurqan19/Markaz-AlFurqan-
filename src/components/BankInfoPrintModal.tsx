import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Printer, X } from 'lucide-react';
import { CenterSetting } from '../types';
import { Language, TRANSLATIONS } from '../i18n';
import { downloadBankInfoImagePNG } from '../utils/bankImageUtils';
import { printSheetElement } from '../utils/printHelper';

interface BankInfoPrintModalProps {
  isOpen: boolean;
  centerSettings: CenterSetting;
  lang: Language;
  onClose: () => void;
}

export const BankInfoPrintModal: React.FC<BankInfoPrintModalProps> = ({
  isOpen,
  centerSettings,
  lang,
  onClose,
}) => {
  const [exporting, setExporting] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;

  const t = TRANSLATIONS[lang];
  const centerName = centerSettings.centerName || t.centerDefaultName;
  const centerContact = [centerSettings.phone, centerSettings.email].filter(Boolean).join(' · ');

  const handleDownloadPNG = async () => {
    setExporting(true);
    try {
      await downloadBankInfoImagePNG(centerSettings, lang);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060E1F]/70 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="no-print px-6 py-4 border-b border-slate-200 dark:border-[#1B3158] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {t.labels.bankDetails}
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {t.labels.printBankInfo}
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

        {/* Printable Bank Info Sheet */}
        <div className="p-6 overflow-y-auto flex-1">
          <div
            ref={sheetRef}
            className="print-receipt-sheet rounded-xl border border-slate-200 bg-white text-slate-900 overflow-hidden"
          >
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
                  {lang === 'om'
                    ? 'ODEEFFANNOO BAANKII FI TELEBIRR'
                    : 'OFFICIAL BANK & TELEBIRR ACCOUNT DETAILS'}
                </div>
                {centerContact && (
                  <div className="text-[11px] text-slate-300 mt-1 font-mono-tabular">
                    {centerContact}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {centerSettings.bankAccountDetails && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#1E3A8A]">
                    {t.labels.bankDetails}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 whitespace-pre-line leading-relaxed">
                    {centerSettings.bankAccountDetails}
                  </div>
                </div>
              )}

              {centerSettings.bankInfoImage && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col items-center justify-center">
                  <img
                    src={centerSettings.bankInfoImage}
                    alt={t.labels.bankImageLabel}
                    className="max-h-96 w-auto rounded-lg object-contain border border-slate-200 bg-white"
                  />
                </div>
              )}

              {!centerSettings.bankAccountDetails && !centerSettings.bankInfoImage && (
                <div className="py-8 text-center text-slate-500">
                  {lang === 'om'
                    ? 'Odeeffannoon baankii ykn suuraan ammaaf hin galmoofne.'
                    : 'No bank details or image saved yet.'}
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-4 text-[11px] text-slate-500">
                <span>Jazaakumullaahu Khayran — {centerName}</span>
                <span className="font-mono-tabular">{new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
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
              disabled={exporting}
              onClick={() => void handleDownloadPNG()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-[#1B3158] text-xs font-semibold text-[#0B1F3A] dark:text-blue-300 hover:bg-slate-100 dark:hover:bg-[#13294E] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{exporting ? '...' : t.labels.downloadBankImage}</span>
            </button>
            <button
              type="button"
              onClick={() => printSheetElement(sheetRef.current, 'Al-Furqaan-Bank-Info')}
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

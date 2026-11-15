import React from 'react';
import { Download, FileText, X } from 'lucide-react';
import { Contribution } from '../types';
import { Language, TRANSLATIONS } from '../i18n';

interface ProofPreviewModalProps {
  contribution: Contribution | null;
  lang: Language;
  onClose: () => void;
}

export const ProofPreviewModal: React.FC<ProofPreviewModalProps> = ({
  contribution,
  lang,
  onClose,
}) => {
  if (!contribution || !contribution.proofFileUrl) return null;

  const t = TRANSLATIONS[lang];
  const isPdf =
    contribution.proofFileUrl.startsWith('data:application/pdf') ||
    (contribution.proofFileName || '').toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060E1F]/70 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1B3158] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono-tabular">
              {contribution.receiptNumber} · {contribution.memberName}
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {contribution.proofFileName || t.labels.proofColumn}
            </h3>
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

        <div className="p-5 overflow-y-auto flex-1 flex items-center justify-center bg-slate-50 dark:bg-[#060E1F]">
          {isPdf ? (
            <div className="w-full space-y-3 text-center">
              <iframe
                src={contribution.proofFileUrl}
                title={contribution.proofFileName || 'Payment Proof PDF'}
                className="w-full h-[55vh] rounded-lg border border-slate-200 dark:border-[#1B3158] bg-white"
              />
              <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <FileText className="w-4 h-4" />
                <span>{contribution.proofFileName || 'payment-proof.pdf'}</span>
              </div>
            </div>
          ) : (
            <img
              src={contribution.proofFileUrl}
              alt={contribution.proofFileName || t.labels.proofColumn}
              className="max-h-[65vh] w-auto rounded-lg border border-slate-200 dark:border-[#1B3158] object-contain bg-white"
            />
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-[#1B3158] flex items-center justify-between gap-3 bg-white dark:bg-[#0B1933]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-[#1B3158] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13294E]"
          >
            {t.labels.closePanel}
          </button>
          <a
            href={contribution.proofFileUrl}
            download={
              contribution.proofFileName ||
              `${contribution.receiptNumber}-proof.${isPdf ? 'pdf' : 'jpg'}`
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 text-xs font-semibold text-white"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'om' ? 'Buusi' : 'Download'}</span>
          </a>
        </div>
      </div>
    </div>
  );
};

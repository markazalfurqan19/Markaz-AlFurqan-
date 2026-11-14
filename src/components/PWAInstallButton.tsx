import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  label: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ label }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#1E3A8A]/30 bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-xs font-semibold text-[#0B1F3A] dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{label}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-[#1B3158] px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13294E] transition-colors whitespace-nowrap shrink-0"
        >
          <Share className="w-3.5 h-3.5" />
          <span>{label} (iOS)</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  iPhone / iPad irratti Fe&apos;adhu
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300 list-decimal list-inside">
                <li>
                  Safari keessatti mallattoo <strong>Share</strong> tuqaa.
                </li>
                <li>
                  Gadi bu&apos;uun <strong>Add to Home Screen</strong> filadhaa.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-slate-900 dark:bg-slate-100 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
              >
                Cufi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

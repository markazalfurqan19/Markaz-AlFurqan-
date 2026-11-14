import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { BookOpenCheck, FileSpreadsheet, Receipt, ShieldCheck } from 'lucide-react';
import { auth, googleProvider, setCachedGoogleAccessToken } from '../firebase';
import { Language, TRANSLATIONS } from '../i18n';

interface AuthGateProps {
  lang: Language;
  onToggleLang: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ lang, onToggleLang }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = TRANSLATIONS[lang];

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedGoogleAccessToken(credential.accessToken);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t.auth.popupError;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#060E1F] flex flex-col justify-between">
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/loog_6003b99d.jpg"
            alt="Al-Furqaan Logo"
            className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-[#1B3158] bg-white shrink-0"
          />
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
            {t.appName}
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleLang}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13294E] transition-colors whitespace-nowrap shrink-0"
        >
          {lang === 'om' ? 'English' : 'Afaan Oromoo'}
        </button>
      </header>

      <main className="w-full max-w-6xl mx-auto px-6 py-10 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="text-xs font-semibold tracking-wide text-[#1E3A8A] dark:text-blue-400">
            {t.centerDefaultName}
          </div>

          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight"
            style={{ textWrap: 'balance' }}
          >
            {t.auth.heroTitle}
          </h1>

          <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            {t.auth.heroDesc}
          </p>

          <div className="grid sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933]">
              <BookOpenCheck className="w-5 h-5 text-[#1D4ED8] dark:text-blue-400 mb-2.5" />
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {lang === 'om' ? 'Galmee Miseensotaa' : 'Member Registry'}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {lang === 'om'
                  ? "Waadaa ji'aa fi odeeffannoo miseensotaa bakka tokkotti."
                  : 'Track monthly pledges & member records.'}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933]">
              <Receipt className="w-5 h-5 text-amber-600 dark:text-amber-400 mb-2.5" />
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {lang === 'om' ? 'Nagahee PDF' : 'Digital Receipts'}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {lang === 'om'
                  ? 'Nagahee lakk. addaa qabu battalumatti maxxansi.'
                  : 'Instant serialized PDF receipts per payment.'}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933]">
              <FileSpreadsheet className="w-5 h-5 text-sky-600 dark:text-sky-400 mb-2.5" />
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {lang === 'om' ? 'Google Sheets Sync' : 'Google Sheets Sync'}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {lang === 'om'
                  ? 'Fulbaana hanga Qaammeetti hordoffii & wal-simsiisa.'
                  : '13-month Ethiopian ledger & Sheets sync.'}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-8 shadow-xs space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/aistudio/loog_6003b99d.jpg"
                  alt="Al-Furqaan Logo"
                  className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-[#1B3158] bg-white shrink-0"
                />
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-[#1D4ED8] dark:text-blue-400" />
                    <span>{t.auth.securityNote}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {t.actions.signInGoogle}
                  </h2>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{t.auth.signInPrompt}</p>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleSignIn()}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>{loading ? '...' : t.actions.signInGoogle}</span>
            </button>
          </div>
        </div>
      </main>

      <footer className="w-full max-w-6xl mx-auto px-6 py-5 border-t border-slate-200 dark:border-[#1B3158] flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span>{t.centerDefaultName}</span>
        <span>CBE · Telebirr · Awash · CBE Birr</span>
      </footer>
    </div>
  );
};

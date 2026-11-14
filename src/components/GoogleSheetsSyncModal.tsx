import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  PlusCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  clearCachedGoogleAccessToken,
  connectGoogleSheets,
  getCachedGoogleAccessToken,
  subscribeGoogleAccessToken,
} from '../firebase';
import { CenterSetting, Contribution, Member } from '../types';
import { Language, TRANSLATIONS } from '../i18n';
import {
  PullSyncPreview,
  SHEET_TAB_CONTRIBUTIONS,
  SHEET_TAB_MEMBERS,
  SHEET_TAB_SUMMARY,
  SheetsAuthError,
  createAlFurqaanSpreadsheet,
  fetchSpreadsheetMetadata,
  parseSpreadsheetId,
  previewPullFromGoogleSheet,
  pushAllToGoogleSheet,
} from '../utils/googleSheetsSync';

const LOCAL_SHEET_STORAGE_KEY = 'alfurqaan_linked_sheet';

export interface LinkedSheetInfo {
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  lastSyncAt?: string;
}

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  contributions: Contribution[];
  centerSettings: CenterSetting;
  isAdmin: boolean;
  lang: Language;
  onSaveSheetSettings: (patch: Partial<CenterSetting>) => Promise<void>;
  onImportFromSheet: (preview: PullSyncPreview) => Promise<{
    membersAdded: number;
    membersUpdated: number;
    contributionsAdded: number;
  }>;
}

type ConfirmAction =
  | { type: 'push'; target: LinkedSheetInfo }
  | { type: 'pull'; preview: PullSyncPreview };

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  members,
  contributions,
  centerSettings,
  isAdmin,
  lang,
  onSaveSheetSettings,
  onImportFromSheet,
}) => {
  const t = TRANSLATIONS[lang];

  const [hasToken, setHasToken] = useState<boolean>(() => Boolean(getCachedGoogleAccessToken()));
  const [sheetInput, setSheetInput] = useState('');
  const [localLinked, setLocalLinked] = useState<LinkedSheetInfo | null>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_SHEET_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as LinkedSheetInfo) : null;
    } catch {
      return null;
    }
  });

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  useEffect(() => {
    return subscribeGoogleAccessToken(setHasToken);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setNotice(null);
      setConfirmAction(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeLinkedSheet: LinkedSheetInfo | null = centerSettings.googleSpreadsheetId
    ? {
        spreadsheetId: centerSettings.googleSpreadsheetId,
        spreadsheetTitle: centerSettings.googleSpreadsheetTitle || 'Al-Furqaan Ledger',
        spreadsheetUrl:
          centerSettings.googleSpreadsheetUrl ||
          `https://docs.google.com/spreadsheets/d/${centerSettings.googleSpreadsheetId}/edit`,
        lastSyncAt: centerSettings.googleLastSyncAt || localLinked?.lastSyncAt,
      }
    : localLinked;

  const persistLinkedSheet = async (info: LinkedSheetInfo) => {
    setLocalLinked(info);
    try {
      localStorage.setItem(LOCAL_SHEET_STORAGE_KEY, JSON.stringify(info));
    } catch {
      // ignore storage quota fallback
    }
    if (isAdmin) {
      await onSaveSheetSettings({
        googleSpreadsheetId: info.spreadsheetId,
        googleSpreadsheetTitle: info.spreadsheetTitle,
        googleSpreadsheetUrl: info.spreadsheetUrl,
        googleLastSyncAt: info.lastSyncAt || '',
      });
    }
  };

  const ensureToken = async (): Promise<string> => {
    const existing = getCachedGoogleAccessToken();
    if (existing) return existing;
    return connectGoogleSheets();
  };

  const handleError = (err: unknown) => {
    if (err instanceof SheetsAuthError) {
      clearCachedGoogleAccessToken();
      setConfirmAction(null);
      setError(
        lang === 'om'
          ? 'Hayyamni Google Sheets yeroon isaa darbeera. Maaloo "Google Sheets Wal-qabsiisi" tuqaa.'
          : 'Google Sheets permission expired or missing. Please click "Connect Google Sheets".'
      );
      return;
    }
    setError(err instanceof Error ? err.message : 'Google Sheets sync failed.');
  };

  const handleConnect = async () => {
    setBusyAction('connect');
    setError(null);
    setNotice(null);
    try {
      await connectGoogleSheets();
      setNotice(t.labels.sheetsConnected);
    } catch (err) {
      handleError(err);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateSpreadsheet = async () => {
    setBusyAction('create');
    setError(null);
    setNotice(null);
    try {
      const token = await ensureToken();
      const created = await createAlFurqaanSpreadsheet(token, centerSettings.centerName);
      const info: LinkedSheetInfo = {
        spreadsheetId: created.spreadsheetId,
        spreadsheetTitle: created.title,
        spreadsheetUrl: created.spreadsheetUrl,
      };
      await persistLinkedSheet(info);
      setNotice(
        lang === 'om'
          ? `Google Sheet haaraan "${created.title}" uumameera. Amma daataa gara isaatti erguuf mirkaneessaa.`
          : `Created "${created.title}". Confirm below to sync your current records.`
      );
      setConfirmAction({ type: 'push', target: info });
    } catch (err) {
      handleError(err);
    } finally {
      setBusyAction(null);
    }
  };

  const handleLinkSpreadsheet = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('link');
    setError(null);
    setNotice(null);
    try {
      const spreadsheetId = parseSpreadsheetId(sheetInput);
      const token = await ensureToken();
      const meta = await fetchSpreadsheetMetadata(token, spreadsheetId);
      const info: LinkedSheetInfo = {
        spreadsheetId: meta.spreadsheetId,
        spreadsheetTitle: meta.title,
        spreadsheetUrl: meta.spreadsheetUrl,
      };
      await persistLinkedSheet(info);
      setSheetInput('');
      setNotice(
        lang === 'om'
          ? `Sheet "${meta.title}" milkaa'inaan hidhameera.`
          : `Linked "${meta.title}" (${meta.sheetTabs.length} tabs found).`
      );
    } catch (err) {
      handleError(err);
    } finally {
      setBusyAction(null);
    }
  };

  const handlePreparePush = () => {
    if (!activeLinkedSheet) return;
    setError(null);
    setNotice(null);
    setConfirmAction({ type: 'push', target: activeLinkedSheet });
  };

  const handleConfirmPush = async () => {
    if (!confirmAction || confirmAction.type !== 'push') return;
    setBusyAction('push');
    setError(null);
    try {
      const token = await ensureToken();
      const result = await pushAllToGoogleSheet(
        token,
        confirmAction.target.spreadsheetId,
        members,
        contributions,
        centerSettings,
        lang
      );
      await persistLinkedSheet({
        spreadsheetId: result.spreadsheetId,
        spreadsheetTitle: result.title,
        spreadsheetUrl: result.spreadsheetUrl,
        lastSyncAt: result.syncedAt,
      });
      setConfirmAction(null);
      setNotice(
        lang === 'om'
          ? `Miseensonni ${result.membersCount} fi buusiin ${result.contributionsCount} gara "${result.title}" wal-simsiifamaniiru.`
          : `Synced ${result.membersCount} members and ${result.contributionsCount} contributions to "${result.title}".`
      );
    } catch (err) {
      handleError(err);
    } finally {
      setBusyAction(null);
    }
  };

  const handlePreparePull = async () => {
    if (!activeLinkedSheet) return;
    setBusyAction('previewPull');
    setError(null);
    setNotice(null);
    try {
      const token = await ensureToken();
      const preview = await previewPullFromGoogleSheet(
        token,
        activeLinkedSheet.spreadsheetId,
        members,
        contributions
      );
      if (
        preview.newMembers.length === 0 &&
        preview.updatedMembers.length === 0 &&
        preview.newContributions.length === 0
      ) {
        setNotice(
          lang === 'om'
            ? 'Daataan haaraan Google Sheet irraa argame hin jiru (hunduu wal-simeera).'
            : 'No new or changed records found in Google Sheet (already up to date).'
        );
      } else {
        setConfirmAction({ type: 'pull', preview });
      }
    } catch (err) {
      handleError(err);
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirmPull = async () => {
    if (!confirmAction || confirmAction.type !== 'pull') return;
    setBusyAction('pull');
    setError(null);
    try {
      const stats = await onImportFromSheet(confirmAction.preview);
      const now = new Date().toISOString();
      if (activeLinkedSheet) {
        await persistLinkedSheet({ ...activeLinkedSheet, lastSyncAt: now });
      }
      setConfirmAction(null);
      setNotice(
        lang === 'om'
          ? `Google Sheet irraa: miseensa haaraa ${stats.membersAdded}, haaromfame ${stats.membersUpdated}, buusii haaraa ${stats.contributionsAdded} galmaa'eera.`
          : `Imported from Sheet: ${stats.membersAdded} new members, ${stats.membersUpdated} updated members, ${stats.contributionsAdded} new contributions.`
      );
    } catch (err) {
      handleError(err);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1B3158] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/loog_6003b99d.jpg"
              alt="Al-Furqaan Logo"
              className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-[#1B3158] bg-white shrink-0"
            />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#1E3A8A] dark:text-blue-400 truncate">
                {t.appName}
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {t.labels.sheetsTitle}
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

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {t.labels.sheetsDesc}
          </p>

          {/* Connection Status Bar */}
          <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-[#F6F8FC] dark:bg-[#060E1F] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileSpreadsheet className="w-5 h-5 text-[#1D4ED8] dark:text-blue-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  {hasToken ? t.labels.sheetsConnected : t.labels.sheetsNeedAuth}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tabs: <span className="font-mono-tabular">{SHEET_TAB_MEMBERS}</span> ·{' '}
                  <span className="font-mono-tabular">{SHEET_TAB_CONTRIBUTIONS}</span> ·{' '}
                  <span className="font-mono-tabular">{SHEET_TAB_SUMMARY}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleConnect()}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-[#13294E] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
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
              <span>
                {busyAction === 'connect'
                  ? '...'
                  : hasToken
                  ? lang === 'om'
                    ? 'Token Haaromsi'
                    : 'Reconnect Google'
                  : t.labels.sheetsConnectBtn}
              </span>
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {notice && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-2.5 text-xs text-[#0B1F3A] dark:text-blue-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1D4ED8] dark:text-blue-400 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {/* Mandatory Explicit User Confirmation Panel */}
          {confirmAction && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-700/70 bg-amber-50/90 dark:bg-amber-950/30 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-slate-900 dark:text-white">
                    {confirmAction.type === 'push'
                      ? lang === 'om'
                        ? 'Google Sheet irratti barreessuu mirkaneessaa'
                        : 'Confirm overwriting Google Sheet data'
                      : lang === 'om'
                      ? 'Google Sheet irraa gara sirnaatti fiduu mirkaneessaa'
                      : 'Confirm importing records from Google Sheet'}
                  </div>
                  {confirmAction.type === 'push' ? (
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {lang === 'om'
                        ? `Sheet "${confirmAction.target.spreadsheetTitle}" keessatti gabatee "${SHEET_TAB_MEMBERS}" (${members.length} miseensa), "${SHEET_TAB_CONTRIBUTIONS}" (${contributions.length} buusii), fi "${SHEET_TAB_SUMMARY}" haaraa irra deebi'ee ni barreeffama.`
                        : `This will replace the contents of tabs "${SHEET_TAB_MEMBERS}" (${members.length} members), "${SHEET_TAB_CONTRIBUTIONS}" (${contributions.length} contributions), and "${SHEET_TAB_SUMMARY}" in "${confirmAction.target.spreadsheetTitle}".`}
                    </p>
                  ) : (
                    <div className="text-slate-700 dark:text-slate-300 space-y-1">
                      <p>
                        {lang === 'om'
                          ? `Madda: "${confirmAction.preview.spreadsheetTitle}"`
                          : `Source: "${confirmAction.preview.spreadsheetTitle}"`}
                      </p>
                      <ul className="list-disc list-inside font-mono-tabular">
                        <li>
                          {lang === 'om' ? 'Miseensa haaraa' : 'New members'}:{' '}
                          <strong>{confirmAction.preview.newMembers.length}</strong>
                        </li>
                        <li>
                          {lang === 'om' ? 'Miseensa haaromfamu' : 'Members to update'}:{' '}
                          <strong>{confirmAction.preview.updatedMembers.length}</strong>
                        </li>
                        <li>
                          {lang === 'om' ? 'Buusii haaraa' : 'New contributions'}:{' '}
                          <strong>{confirmAction.preview.newContributions.length}</strong>
                        </li>
                        {confirmAction.preview.skippedRows > 0 && (
                          <li>
                            {lang === 'om' ? 'Toora irra darbamu' : 'Skipped invalid rows'}:{' '}
                            {confirmAction.preview.skippedRows}
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => setConfirmAction(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#13294E]"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() =>
                    void (confirmAction.type === 'push'
                      ? handleConfirmPush()
                      : handleConfirmPull())
                  }
                  className="px-4 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {busyAction === 'push' || busyAction === 'pull'
                    ? '...'
                    : confirmAction.type === 'push'
                    ? lang === 'om'
                      ? 'Mirkaneessi & Ergi'
                      : 'Confirm & Sync'
                    : lang === 'om'
                    ? 'Mirkaneessi & Fidi'
                    : 'Confirm Import'}
                </button>
              </div>
            </div>
          )}

          {/* Linked Spreadsheet Box */}
          <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {lang === 'om' ? 'Google Sheet Hidhame' : 'Linked Spreadsheet'}
                </div>
                {activeLinkedSheet ? (
                  <>
                    <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white truncate">
                      {activeLinkedSheet.spreadsheetTitle}
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400 truncate">
                      ID: {activeLinkedSheet.spreadsheetId}
                    </div>
                    {activeLinkedSheet.lastSyncAt && (
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {t.labels.sheetsLastSynced}:{' '}
                        <span className="font-mono-tabular">
                          {new Date(activeLinkedSheet.lastSyncAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t.labels.sheetsNotLinked}
                  </div>
                )}
              </div>

              {activeLinkedSheet && (
                <a
                  href={activeLinkedSheet.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#1B3158] px-3 py-1.5 text-xs font-semibold text-[#1E3A8A] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-[#13294E] whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t.labels.sheetsOpenLink}</span>
                </a>
              )}
            </div>

            {activeLinkedSheet && (
              <div className="pt-2 border-t border-slate-100 dark:border-[#1B3158] flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={handlePreparePush}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowUpFromLine className="w-3.5 h-3.5" />
                  <span>{t.labels.sheetsPushBtn}</span>
                </button>

                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handlePreparePull()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#13294E] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {busyAction === 'previewPull' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                  )}
                  <span>{t.labels.sheetsPullBtn}</span>
                </button>
              </div>
            )}
          </div>

          {/* Create or Link Controls */}
          <div className="grid sm:grid-cols-12 gap-3 items-end">
            <form onSubmit={(e) => void handleLinkSpreadsheet(e)} className="sm:col-span-8 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.labels.sheetsLinkExisting}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Link2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={sheetInput}
                    onChange={(e) => setSheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full rounded-lg border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busyAction !== null || !sheetInput.trim()}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#13294E] disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {busyAction === 'link' ? '...' : t.labels.sheetsLinkBtn}
                </button>
              </div>
            </form>

            <div className="sm:col-span-4">
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleCreateSpreadsheet()}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#1E3A8A]/30 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-2 text-xs font-semibold text-[#0B1F3A] dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-60 whitespace-nowrap"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{busyAction === 'create' ? '...' : t.labels.sheetsCreateNew}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

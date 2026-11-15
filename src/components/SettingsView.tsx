import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ClipboardList,
  Image as ImageIcon,
  Printer,
  Search,
  Shield,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import {
  AdminRole,
  AdminRoleType,
  AuditAction,
  AuditLog,
  AuditTargetType,
  CenterSetting,
  SCHEMA_LIMITS,
} from '../types';
import { Language, TRANSLATIONS } from '../i18n';
import { PWAInstallButton } from './PWAInstallButton';
import { compressBankImageFile, downloadBankInfoImagePNG } from '../utils/bankImageUtils';
import { BankInfoPrintModal } from './BankInfoPrintModal';

interface SettingsViewProps {
  centerSettings: CenterSetting;
  admins: AdminRole[];
  auditLogs: AuditLog[];
  isAdmin: boolean;
  isOwner: boolean;
  currentUserEmail: string;
  lang: Language;
  onSaveSettings: (data: CenterSetting) => Promise<void>;
  onGrantAdmin: (email: string, role: AdminRoleType) => Promise<void>;
  onRevokeAdmin: (adminId: string) => Promise<void>;
}

const ACTION_BADGE_STYLES: Record<AuditAction, string> = {
  member_created: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  member_updated: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  member_deleted: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  contribution_created: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  contribution_updated: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  contribution_verified: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
  contribution_deleted: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  admin_granted: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  admin_revoked: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  settings_updated: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  centerSettings,
  admins,
  auditLogs,
  isAdmin,
  isOwner,
  currentUserEmail,
  lang,
  onSaveSettings,
  onGrantAdmin,
  onRevokeAdmin,
}) => {
  const t = TRANSLATIONS[lang];
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [centerName, setCenterName] = useState(centerSettings.centerName);
  const [phone, setPhone] = useState(centerSettings.phone || '');
  const [email, setEmail] = useState(centerSettings.email || '');
  const [bankAccountDetails, setBankAccountDetails] = useState(
    centerSettings.bankAccountDetails || ''
  );
  const [bankInfoImage, setBankInfoImage] = useState(centerSettings.bankInfoImage || '');
  const [monthlyTargetETB, setMonthlyTargetETB] = useState(
    String(centerSettings.monthlyTargetETB ?? 50000)
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [exportingImage, setExportingImage] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<AdminRoleType>('admin');
  const [granting, setGranting] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const [auditSearch, setAuditSearch] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState<'all' | AuditTargetType>('all');

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (auditTypeFilter !== 'all' && log.targetType !== auditTypeFilter) return false;
      if (!q) return true;
      const actionLabel = (t.auditLog.actions[log.action] || log.action).toLowerCase();
      return (
        actionLabel.includes(q) ||
        log.targetLabel.toLowerCase().includes(q) ||
        log.targetId.toLowerCase().includes(q) ||
        (log.details || '').toLowerCase().includes(q) ||
        log.actorEmail.toLowerCase().includes(q) ||
        (log.actorName || '').toLowerCase().includes(q)
      );
    });
  }, [auditLogs, auditSearch, auditTypeFilter, t.auditLog.actions]);

  useEffect(() => {
    setCenterName(centerSettings.centerName);
    setPhone(centerSettings.phone || '');
    setEmail(centerSettings.email || '');
    setBankAccountDetails(centerSettings.bankAccountDetails || '');
    setBankInfoImage(centerSettings.bankInfoImage || '');
    setMonthlyTargetETB(String(centerSettings.monthlyTargetETB ?? 50000));
  }, [centerSettings]);

  const buildCurrentSettingsPayload = (overrideImage?: string): CenterSetting => {
    const cleanName =
      centerName.trim().slice(0, SCHEMA_LIMITS.SETTING_CENTER_NAME) ||
      centerSettings.centerName ||
      t.centerDefaultName;
    const targetNum = Math.min(
      SCHEMA_LIMITS.MAX_TARGET_ETB,
      Math.max(0, Number(monthlyTargetETB) || 0)
    );
    return {
      centerName: cleanName,
      phone: phone.trim().slice(0, SCHEMA_LIMITS.SETTING_PHONE),
      email: email.trim().slice(0, SCHEMA_LIMITS.SETTING_EMAIL),
      bankAccountDetails: bankAccountDetails
        .trim()
        .slice(0, SCHEMA_LIMITS.SETTING_BANK_DETAILS),
      bankInfoImage: (overrideImage !== undefined ? overrideImage : bankInfoImage).slice(
        0,
        SCHEMA_LIMITS.SETTING_BANK_IMAGE
      ),
      monthlyTargetETB: targetNum,
    };
  };

  const handleSaveCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = centerName.trim().slice(0, SCHEMA_LIMITS.SETTING_CENTER_NAME);
    if (!cleanName) {
      setSettingsError('Center name is required.');
      return;
    }

    setSavingSettings(true);
    setSettingsError(null);
    try {
      await onSaveSettings(buildCurrentSettingsPayload());
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSelectBankImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSettingsError(null);
    setSavingSettings(true);
    try {
      const compressed = await compressBankImageFile(
        file,
        t.labels.invalidImageFile,
        t.labels.imageTooLarge
      );
      setBankInfoImage(compressed);
      if (isAdmin && centerName.trim()) {
        await onSaveSettings(buildCurrentSettingsPayload(compressed));
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 3000);
      }
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : t.labels.invalidImageFile);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRemoveBankImage = async () => {
    setSettingsError(null);
    setBankInfoImage('');
    if (isAdmin && centerName.trim()) {
      setSavingSettings(true);
      try {
        await onSaveSettings(buildCurrentSettingsPayload(''));
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 3000);
      } catch (err) {
        setSettingsError(err instanceof Error ? err.message : 'Failed to remove image');
      } finally {
        setSavingSettings(false);
      }
    }
  };

  const handleDownloadBankPNG = async () => {
    setExportingImage(true);
    setSettingsError(null);
    try {
      await downloadBankInfoImagePNG(buildCurrentSettingsPayload(), lang);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to export image');
    } finally {
      setExportingImage(false);
    }
  };

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newAdminEmail.trim().toLowerCase().slice(0, SCHEMA_LIMITS.ADMIN_EMAIL);
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAdminError(lang === 'om' ? 'Imeelii sirrii galchaa.' : 'Enter a valid email address.');
      return;
    }
    setGranting(true);
    setAdminError(null);
    try {
      await onGrantAdmin(cleanEmail, newAdminRole);
      setNewAdminEmail('');
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to grant role');
    } finally {
      setGranting(false);
    }
  };

  const livePreviewSettings = buildCurrentSettingsPayload();
  const hasBankContent = Boolean(bankAccountDetails.trim() || bankInfoImage);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Center Configuration */}
      <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/loog_6003b99d.jpg"
              alt="Al-Furqaan Logo"
              className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-[#1B3158] bg-white shrink-0"
            />
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {t.labels.centerSettings}
            </h3>
          </div>
          {savedNotice && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] dark:text-blue-400 shrink-0">
              <Check className="w-3.5 h-3.5" />
              <span>{t.labels.savedSuccess}</span>
            </span>
          )}
        </div>

        {settingsError && (
          <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300">
            {settingsError}
          </div>
        )}

        <form onSubmit={(e) => void handleSaveCenter(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {lang === 'om' ? 'Maqaa Giddu-galaa' : 'Center Name'} *
            </label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              maxLength={SCHEMA_LIMITS.SETTING_CENTER_NAME}
              value={centerName}
              onChange={(e) => setCenterName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm text-slate-900 dark:text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.phone}
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                maxLength={SCHEMA_LIMITS.SETTING_PHONE}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251 9..."
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm font-mono-tabular text-slate-900 dark:text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.monthlyTarget}
              </label>
              <input
                type="number"
                min={0}
                max={SCHEMA_LIMITS.MAX_TARGET_ETB}
                disabled={!isAdmin}
                value={monthlyTargetETB}
                onChange={(e) => setMonthlyTargetETB(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm font-mono-tabular text-slate-900 dark:text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Imeelii Giddu-galaa
            </label>
            <input
              type="email"
              disabled={!isAdmin}
              maxLength={SCHEMA_LIMITS.SETTING_EMAIL}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="markazalfurqan19@gmail.com"
              className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm text-slate-900 dark:text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            />
          </div>

          {/* Bank Information + Image Attachment / PNG Export / Print */}
          <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-slate-50/70 dark:bg-[#060E1F]/60 p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                {t.labels.bankDetails}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!hasBankContent || exportingImage}
                  onClick={() => void handleDownloadBankPNG()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] px-2.5 py-1.5 text-[11px] font-semibold text-[#0B1F3A] dark:text-blue-300 hover:bg-slate-100 dark:hover:bg-[#13294E] disabled:opacity-50 whitespace-nowrap"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{exportingImage ? '...' : t.labels.downloadBankImage}</span>
                </button>
                <button
                  type="button"
                  disabled={!hasBankContent}
                  onClick={() => setPrintModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50 whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.labels.printBankInfo}</span>
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              disabled={!isAdmin}
              maxLength={SCHEMA_LIMITS.SETTING_BANK_DETAILS}
              value={bankAccountDetails}
              onChange={(e) => setBankAccountDetails(e.target.value)}
              placeholder="CBE: 1000... | Telebirr: +251 9... | Awash: ..."
              className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm text-slate-900 dark:text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            />

            {/* Bank / QR Image Attachment */}
            <div className="pt-1 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.labels.bankImageLabel}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t.labels.bankImageHint}
                  </p>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleSelectBankImage(e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={savingSettings}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#13294E] disabled:opacity-60 whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {bankInfoImage ? t.labels.changeBankImage : t.labels.uploadBankImage}
                      </span>
                    </button>
                    {bankInfoImage && (
                      <button
                        type="button"
                        disabled={savingSettings}
                        onClick={() => void handleRemoveBankImage()}
                        title={t.labels.removeBankImage}
                        aria-label={t.labels.removeBankImage}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-[#0B1933] px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-60 whitespace-nowrap"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>{t.labels.removeBankImage}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {bankInfoImage && (
                <div className="rounded-lg border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-2.5 flex justify-center">
                  <img
                    src={bankInfoImage}
                    alt={t.labels.bankImageLabel}
                    className="max-h-56 w-auto rounded-md object-contain"
                  />
                </div>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-4 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 text-xs font-semibold text-white disabled:opacity-60"
              >
                {savingSettings ? '...' : t.actions.save}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* RBAC + App Install */}
      <div className="lg:col-span-5 space-y-6">
        <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-[#1E3A8A] dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t.labels.rbacTitle}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t.labels.rbacDesc}
              </p>
            </div>
          </div>

          {isOwner ? (
            <>
              {adminError && (
                <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                  {adminError}
                </div>
              )}

              <form onSubmit={(e) => void handleGrant(e)} className="space-y-3">
                <input
                  type="email"
                  required
                  maxLength={SCHEMA_LIMITS.ADMIN_EMAIL}
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin@gmail.com"
                  className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={newAdminRole}
                    onChange={(e) => setNewAdminRole(e.target.value as AdminRoleType)}
                    className="flex-1 rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  >
                    <option value="admin">{t.roles.admin}</option>
                    <option value="owner">{t.roles.owner}</option>
                  </select>
                  <button
                    type="submit"
                    disabled={granting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{t.labels.grantBtn}</span>
                  </button>
                </div>
              </form>

              <div className="divide-y divide-slate-100 dark:divide-[#1B3158] border-t border-slate-100 dark:border-[#1B3158] pt-2">
                {admins.length === 0 ? (
                  <div className="py-4 text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'om'
                      ? 'Bulchitoonni dabalataa hin galmoofne.'
                      : 'No additional admins assigned yet.'}
                  </div>
                ) : (
                  admins.map((a) => (
                    <div
                      key={a.id}
                      className="py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {a.email}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {a.role.toUpperCase()} · {a.grantedBy}
                        </div>
                      </div>
                      {a.email !== currentUserEmail && (
                        <button
                          type="button"
                          onClick={() => void onRevokeAdmin(a.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="rounded-lg bg-slate-50 dark:bg-[#060E1F] p-3 text-xs text-slate-600 dark:text-slate-400">
              {lang === 'om'
                ? `Sadarkaa keessan: ${isAdmin ? t.roles.admin : t.roles.recorder}`
                : `Your access level: ${isAdmin ? t.roles.admin : t.roles.recorder}`}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-6 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            PWA · {t.actions.installApp}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'om'
              ? 'Bilbila ykn kompiitara irratti akka appii dhaabbataatti fe’achuun saffisaan fayyadamaa.'
              : 'Install Al-Furqaan to your home screen for quick standalone access and offline resilience.'}
          </p>
          <PWAInstallButton label={t.actions.installApp} />
        </div>
      </div>
      </div>

      {/* Accountability Audit Log */}
      <section className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-[#1B3158] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3">
            <ClipboardList className="w-5 h-5 text-[#1E3A8A] dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t.auditLog.title}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t.auditLog.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label={t.auditLog.searchPlaceholder}
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder={t.auditLog.searchPlaceholder}
                className="w-full rounded-lg border border-slate-200 dark:border-[#1B3158] bg-slate-50 dark:bg-[#060E1F] pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
              {auditSearch && (
                <button
                  type="button"
                  onClick={() => setAuditSearch('')}
                  aria-label="Clear audit search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#060E1F]">
              {(['all', 'member', 'contribution', 'admin', 'settings'] as const).map((typeKey) => (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => setAuditTypeFilter(typeKey)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    auditTypeFilter === typeKey
                      ? 'bg-white dark:bg-[#13294E] text-[#0B1F3A] dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {typeKey === 'all' ? t.auditLog.allTypes : t.auditLog.targetTypes[typeKey]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredAuditLogs.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            {t.auditLog.empty}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#060E1F]">
                <tr className="border-b border-slate-200 dark:border-[#1B3158] text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4 whitespace-nowrap">{t.auditLog.time}</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">{t.auditLog.actionCol}</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">{t.auditLog.target}</th>
                  <th className="py-2.5 px-4">{t.auditLog.details}</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">{t.auditLog.actor}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1B3158]/80 text-xs">
                {filteredAuditLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#13294E]/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          ACTION_BADGE_STYLES[log.action] ||
                          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {t.auditLog.actions[log.action] || log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {log.targetLabel}
                      </div>
                      <div className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                        {log.targetId}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs">
                      {log.details || '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {log.actorName || log.actorEmail}
                      </div>
                      {log.actorName && log.actorName !== log.actorEmail && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {log.actorEmail}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <BankInfoPrintModal
        isOpen={printModalOpen}
        centerSettings={livePreviewSettings}
        lang={lang}
        onClose={() => setPrintModalOpen(false)}
      />
    </div>
  );
};

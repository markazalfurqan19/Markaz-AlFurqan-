import React, { useEffect, useState } from 'react';
import { Check, Shield, Trash2, UserPlus } from 'lucide-react';
import { AdminRole, AdminRoleType, CenterSetting, SCHEMA_LIMITS } from '../types';
import { Language, TRANSLATIONS } from '../i18n';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsViewProps {
  centerSettings: CenterSetting;
  admins: AdminRole[];
  isAdmin: boolean;
  isOwner: boolean;
  currentUserEmail: string;
  lang: Language;
  onSaveSettings: (data: CenterSetting) => Promise<void>;
  onGrantAdmin: (email: string, role: AdminRoleType) => Promise<void>;
  onRevokeAdmin: (adminId: string) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  centerSettings,
  admins,
  isAdmin,
  isOwner,
  currentUserEmail,
  lang,
  onSaveSettings,
  onGrantAdmin,
  onRevokeAdmin,
}) => {
  const t = TRANSLATIONS[lang];

  const [centerName, setCenterName] = useState(centerSettings.centerName);
  const [phone, setPhone] = useState(centerSettings.phone || '');
  const [email, setEmail] = useState(centerSettings.email || '');
  const [bankAccountDetails, setBankAccountDetails] = useState(
    centerSettings.bankAccountDetails || ''
  );
  const [monthlyTargetETB, setMonthlyTargetETB] = useState(
    String(centerSettings.monthlyTargetETB ?? 50000)
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<AdminRoleType>('admin');
  const [granting, setGranting] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    setCenterName(centerSettings.centerName);
    setPhone(centerSettings.phone || '');
    setEmail(centerSettings.email || '');
    setBankAccountDetails(centerSettings.bankAccountDetails || '');
    setMonthlyTargetETB(String(centerSettings.monthlyTargetETB ?? 50000));
  }, [centerSettings]);

  const handleSaveCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = centerName.trim().slice(0, SCHEMA_LIMITS.SETTING_CENTER_NAME);
    const targetNum = Math.min(
      SCHEMA_LIMITS.MAX_TARGET_ETB,
      Math.max(0, Number(monthlyTargetETB) || 0)
    );
    if (!cleanName) {
      setSettingsError('Center name is required.');
      return;
    }

    setSavingSettings(true);
    setSettingsError(null);
    try {
      await onSaveSettings({
        centerName: cleanName,
        phone: phone.trim().slice(0, SCHEMA_LIMITS.SETTING_PHONE),
        email: email.trim().slice(0, SCHEMA_LIMITS.SETTING_EMAIL),
        bankAccountDetails: bankAccountDetails
          .trim()
          .slice(0, SCHEMA_LIMITS.SETTING_BANK_DETAILS),
        monthlyTargetETB: targetNum,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingSettings(false);
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

  return (
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t.labels.bankDetails}
            </label>
            <textarea
              rows={3}
              disabled={!isAdmin}
              maxLength={SCHEMA_LIMITS.SETTING_BANK_DETAILS}
              value={bankAccountDetails}
              onChange={(e) => setBankAccountDetails(e.target.value)}
              placeholder="CBE: 1000... | Telebirr: +251 9... | Awash: ..."
              className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm text-slate-900 dark:text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            />
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
  );
};

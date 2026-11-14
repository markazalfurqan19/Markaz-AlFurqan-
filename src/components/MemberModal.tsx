import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Member, MemberStatus, SCHEMA_LIMITS } from '../types';
import { Language, TRANSLATIONS } from '../i18n';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: Omit<Member, 'id' | 'halqa' | 'createdBy' | 'createdByEmail' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  editingMember: Member | null;
  suggestedCode: string;
  lang: Language;
}

export const MemberModal: React.FC<MemberModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingMember,
  suggestedCode,
  lang,
}) => {
  const t = TRANSLATIONS[lang];
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [memberId, setMemberId] = useState('');
  const [monthlyPledgeETB, setMonthlyPledgeETB] = useState('500');
  const [status, setStatus] = useState<MemberStatus>('active');
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (editingMember) {
        setFullName(editingMember.fullName);
        setPhoneNumber(editingMember.phoneNumber);
        setEmail(editingMember.email || '');
        setMemberId(editingMember.memberId);
        setMonthlyPledgeETB(String(editingMember.monthlyPledgeETB));
        setStatus(editingMember.status);
        setCity(editingMember.city || '');
      } else {
        setFullName('');
        setPhoneNumber('');
        setEmail('');
        setMemberId(suggestedCode);
        setMonthlyPledgeETB('500');
        setStatus('active');
        setCity('');
      }
      setError(null);
    }
  }, [isOpen, editingMember, suggestedCode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim().slice(0, SCHEMA_LIMITS.MEMBER_FULL_NAME);
    const cleanPhone = phoneNumber.trim().slice(0, SCHEMA_LIMITS.MEMBER_PHONE);
    const cleanCode = memberId.trim().slice(0, SCHEMA_LIMITS.MEMBER_CODE);
    const pledge = Number(monthlyPledgeETB);

    if (!cleanName || !cleanPhone || !cleanCode) {
      setError(
        lang === 'om'
          ? 'Maqaa, bilbila fi koodiin miseensaa barbaachisaadha.'
          : 'Name, phone, and member code are required.'
      );
      return;
    }
    if (Number.isNaN(pledge) || pledge < 0) {
      setError(lang === 'om' ? 'Hangi waadaa sirrii miti.' : 'Invalid monthly pledge amount.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSave({
        fullName: cleanName,
        phoneNumber: cleanPhone,
        email: email.trim().slice(0, SCHEMA_LIMITS.MEMBER_EMAIL),
        memberId: cleanCode,
        monthlyPledgeETB: pledge,
        status,
        city: city.trim().slice(0, SCHEMA_LIMITS.MEMBER_CITY),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1B3158] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/loog_6003b99d.jpg"
              alt="Al-Furqaan Logo"
              className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-[#1B3158] bg-white shrink-0"
            />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                {t.appName}
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {editingMember ? t.actions.edit : t.actions.addMember}
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

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.fullName} *
              </label>
              <input
                type="text"
                required
                maxLength={SCHEMA_LIMITS.MEMBER_FULL_NAME}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Abdurahmaan Ahmad..."
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.memberCode} *
              </label>
              <input
                type="text"
                required
                disabled={Boolean(editingMember)}
                maxLength={SCHEMA_LIMITS.MEMBER_CODE}
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-slate-50 dark:bg-[#060E1F] px-3.5 py-2 text-sm font-mono-tabular text-slate-900 dark:text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.phone} *
              </label>
              <input
                type="tel"
                required
                maxLength={SCHEMA_LIMITS.MEMBER_PHONE}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+251 9..."
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.monthlyPledge} *
              </label>
              <input
                type="number"
                required
                min={0}
                step="any"
                value={monthlyPledgeETB}
                onChange={(e) => setMonthlyPledgeETB(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.statusLabel} *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MemberStatus)}
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              >
                <option value="active">{t.status.active}</option>
                <option value="inactive">{t.status.inactive}</option>
                <option value="suspended">{t.status.suspended}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.city}
              </label>
              <input
                type="text"
                maxLength={SCHEMA_LIMITS.MEMBER_CITY}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Finfinnee / Adaamaa..."
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.email}
              </label>
              <input
                type="email"
                maxLength={SCHEMA_LIMITS.MEMBER_EMAIL}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@example.com"
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-[#1B3158]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-[#1B3158] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13294E]"
            >
              {t.actions.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 text-xs font-semibold text-white disabled:opacity-60"
            >
              {submitting ? '...' : t.actions.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

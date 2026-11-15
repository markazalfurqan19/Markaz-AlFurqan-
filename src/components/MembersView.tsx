import React, { useMemo, useState } from 'react';
import { CreditCard, Download, History, Pencil, Search, Trash2, UserPlus, X } from 'lucide-react';
import {
  CenterSetting,
  Contribution,
  Member,
  MemberCategory,
  MemberStatus,
  formatETB,
} from '../types';
import { Language, TRANSLATIONS } from '../i18n';
import { downloadMembersCSV } from '../utils/pdfGenerator';
import { MemberPaymentHistory } from './MemberPaymentHistory';
import { PrintReceiptModal } from './PrintReceiptModal';

interface MembersViewProps {
  members: Member[];
  contributions: Contribution[];
  centerSettings: CenterSetting;
  loading: boolean;
  isAdmin: boolean;
  lang: Language;
  onAddMember: () => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (member: Member) => Promise<void>;
  onRecordForMember: (member: Member) => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  members,
  contributions,
  centerSettings,
  loading,
  isAdmin,
  lang,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onRecordForMember,
}) => {
  const t = TRANSLATIONS[lang];
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MemberStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | MemberCategory>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [printContribution, setPrintContribution] = useState<Contribution | null>(null);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) || null,
    [members, selectedMemberId]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/[\s\-()]/g, '');
    return members.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      const memberCat: MemberCategory = m.category || 'supporter';
      if (categoryFilter !== 'all' && memberCat !== categoryFilter) return false;
      if (!q) return true;
      const normalizedPhone = m.phoneNumber.toLowerCase().replace(/[\s\-()]/g, '');
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.memberId.toLowerCase().includes(q) ||
        m.phoneNumber.toLowerCase().includes(q) ||
        (qDigits.length > 0 && normalizedPhone.includes(qDigits)) ||
        (m.city || '').toLowerCase().includes(q)
      );
    });
  }, [members, search, statusFilter, categoryFilter]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-6 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 rounded bg-slate-100 dark:bg-[#13294E] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label={t.labels.searchMembers}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.labels.searchMembers}
            className="w-full rounded-lg border border-slate-200 dark:border-[#1B3158] bg-slate-50 dark:bg-[#060E1F] pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={lang === 'om' ? 'Barbaacha haqi' : 'Clear search'}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#060E1F]">
            {(['all', 'active', 'inactive', 'suspended'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-white dark:bg-[#13294E] text-[#0B1F3A] dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st === 'all' ? t.labels.allStatuses : t.status[st]}
              </button>
            ))}
          </div>

          <select
            aria-label={t.labels.category}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | MemberCategory)}
            className="rounded-lg border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
          >
            <option value="all">{t.labels.allCategories}</option>
            <option value="student">{t.memberCategories.student}</option>
            <option value="teacher">{t.memberCategories.teacher}</option>
            <option value="supporter">{t.memberCategories.supporter}</option>
          </select>

          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={() => downloadMembersCSV(filtered)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#1B3158] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#13294E] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.actions.exportCSV}</span>
          </button>

          <button
            type="button"
            onClick={onAddMember}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t.actions.addMember}</span>
          </button>
        </div>
      </div>

      {/* Selected Member Payment History Panel */}
      {selectedMember && (
        <MemberPaymentHistory
          member={selectedMember}
          contributions={contributions}
          centerSettings={centerSettings}
          lang={lang}
          onClose={() => setSelectedMemberId(null)}
          onRecordForMember={onRecordForMember}
          onPrintReceipt={(c) => setPrintContribution(c)}
        />
      )}

      {/* Members Table */}
      <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] overflow-hidden">
        {filtered.length === 0 ? (
          members.length > 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {lang === 'om'
                  ? 'Miseensi barbaacha kanaa wajjin walsimu hin argamne'
                  : 'No members match your search or filters'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#1B3158] px-3.5 py-1.5 text-xs font-semibold text-[#0B1F3A] dark:text-blue-300 hover:bg-slate-50 dark:hover:bg-[#13294E]"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t.labels.resetSelection}</span>
              </button>
            </div>
          ) : (
            <div className="p-12 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {t.labels.emptyMembers}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {t.labels.emptyMembersHint}
              </p>
              <button
                type="button"
                onClick={onAddMember}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-blue-700 px-4 py-2 text-xs font-semibold text-white"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t.actions.addMember}</span>
              </button>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1B3158] text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#060E1F]/60">
                  <th className="py-2.5 px-4">{t.labels.memberCode}</th>
                  <th className="py-2.5 px-4">{t.labels.fullName}</th>
                  <th className="py-2.5 px-4">{t.labels.category}</th>
                  <th className="py-2.5 px-4">{t.labels.phone}</th>
                  <th className="py-2.5 px-4">{t.labels.statusLabel}</th>
                  <th className="py-2.5 px-4 text-right">{t.labels.monthlyPledge}</th>
                  <th className="py-2.5 px-4 text-right">{t.labels.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1B3158]/80 text-xs">
                {filtered.map((member) => {
                  const isSelected = selectedMember?.id === member.id;
                  return (
                  <tr
                    key={member.id}
                    onClick={() =>
                      setSelectedMemberId((prev) => (prev === member.id ? null : member.id))
                    }
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-[#13294E]'
                        : 'hover:bg-slate-50 dark:hover:bg-[#13294E]/50'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono-tabular font-semibold text-slate-700 dark:text-slate-300">
                      {member.memberId}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {member.fullName}
                      </div>
                      {(member.city || member.email) && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {[member.city, member.email].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {t.memberCategories[member.category || 'supporter']}
                    </td>
                    <td className="py-2.5 px-4 font-mono-tabular text-slate-700 dark:text-slate-300">
                      {member.phoneNumber}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`font-semibold ${
                          member.status === 'active'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : member.status === 'inactive'
                            ? 'text-slate-500 dark:text-slate-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {t.status[member.status]}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-slate-900 dark:text-white">
                      {formatETB(member.monthlyPledgeETB)}
                    </td>
                    <td
                      className="py-2.5 px-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedMemberId((prev) => (prev === member.id ? null : member.id))
                          }
                          title={t.actions.viewHistory}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                            isSelected
                              ? 'border-[#0B1F3A] bg-[#0B1F3A] text-white dark:border-blue-600 dark:bg-blue-700'
                              : 'border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#13294E]'
                          }`}
                        >
                          <History className="w-3 h-3" />
                          <span>{t.actions.viewHistory}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRecordForMember(member)}
                          title={t.actions.recordPayment}
                          className="inline-flex items-center gap-1 rounded-md border border-[#1E3A8A]/30 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 text-[11px] font-semibold text-[#0B1F3A] dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 whitespace-nowrap shrink-0"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>{lang === 'om' ? 'Kaffali' : 'Pay'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditMember(member)}
                          title={t.actions.edit}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && (
                          confirmDeleteId === member.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  void onDeleteMember(member);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 rounded bg-rose-600 text-[11px] font-semibold text-white"
                              >
                                {t.actions.delete}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-1 rounded text-[11px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(member.id)}
                              title={t.actions.delete}
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PrintReceiptModal
        contribution={printContribution}
        centerSettings={centerSettings}
        lang={lang}
        onClose={() => setPrintContribution(null)}
      />
    </div>
  );
};

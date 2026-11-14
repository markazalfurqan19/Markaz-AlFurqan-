import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FileText, Plus, UserPlus } from 'lucide-react';
import {
  CenterSetting,
  Contribution,
  ETHIOPIAN_MONTHS,
  Member,
  PaymentMethod,
  formatETB,
  getCurrentEthiopianDate,
} from '../types';
import { Language, TRANSLATIONS } from '../i18n';
import { downloadReceiptPDF } from '../utils/pdfGenerator';

interface DashboardViewProps {
  members: Member[];
  contributions: Contribution[];
  centerSettings: CenterSetting;
  loading: boolean;
  lang: Language;
  onOpenNewContribution: () => void;
  onOpenNewMember: () => void;
  onNavigateTab: (tab: 'members' | 'contributions' | 'reports') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  members,
  contributions,
  centerSettings,
  loading,
  lang,
  onOpenNewContribution,
  onOpenNewMember,
  onNavigateTab,
}) => {
  const t = TRANSLATIONS[lang];
  const currentEth = getCurrentEthiopianDate();

  const stats = useMemo(() => {
    const valid = contributions.filter((c) => c.status !== 'voided');
    const totalCollected = valid.reduce((sum, c) => sum + c.amountETB, 0);
    const thisMonthCollected = valid
      .filter(
        (c) =>
          c.ethiopianMonth === currentEth.month && c.ethiopianYear === currentEth.year
      )
      .reduce((sum, c) => sum + c.amountETB, 0);
    const pendingCount = contributions.filter((c) => c.status === 'pending').length;
    const activeMembersList = members.filter((m) => m.status === 'active');
    const inactiveMembersCount = members.filter((m) => m.status === 'inactive').length;
    const totalPledged = activeMembersList.reduce((sum, m) => sum + m.monthlyPledgeETB, 0);
    const monthlyTarget = centerSettings.monthlyTargetETB || totalPledged || 50000;
    const progressPct = Math.min(100, Math.round((thisMonthCollected / monthlyTarget) * 100));

    return {
      totalCollected,
      thisMonthCollected,
      pendingCount,
      activeMembersCount: activeMembersList.length,
      inactiveMembersCount,
      totalPledged,
      monthlyTarget,
      progressPct,
    };
  }, [contributions, members, centerSettings.monthlyTargetETB, currentEth.month, currentEth.year]);

  const monthlyChartData = useMemo(() => {
    const yearTarget = currentEth.year;
    return ETHIOPIAN_MONTHS.map((month) => {
      const sum = contributions
        .filter(
          (c) =>
            c.status !== 'voided' &&
            c.ethiopianYear === yearTarget &&
            c.ethiopianMonth === month
        )
        .reduce((acc, c) => acc + c.amountETB, 0);
      return {
        month: month.slice(0, 5),
        fullMonth: month,
        amount: sum,
      };
    });
  }, [contributions, currentEth.year]);

  const channelBreakdown = useMemo(() => {
    const valid = contributions.filter((c) => c.status !== 'voided');
    const total = valid.reduce((s, c) => s + c.amountETB, 0) || 1;
    const map = new Map<PaymentMethod, number>();
    valid.forEach((c) => {
      map.set(c.paymentMethod, (map.get(c.paymentMethod) || 0) + c.amountETB);
    });
    return Array.from(map.entries())
      .map(([method, amount]) => ({
        method,
        label: t.paymentMethods[method] || method,
        amount,
        pct: Math.round((amount / total) * 100),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [contributions, t.paymentMethods]);

  const recentContributions = useMemo(
    () =>
      [...contributions]
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 6),
    [contributions]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-28 rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] animate-pulse"
            />
          ))}
        </div>
        <div className="h-80 rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t.kpi.activeMembers} vs {t.kpi.inactiveMembers}
          </div>
          <div className="mt-2 flex items-baseline gap-2.5 font-mono-tabular">
            <span className="text-2xl font-bold text-[#0B1F3A] dark:text-blue-300">
              {stats.activeMembersCount}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t.status.active}
            </span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-xl font-bold text-slate-600 dark:text-slate-300">
              {stats.inactiveMembersCount}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t.status.inactive}
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {t.kpi.totalPledged}: {formatETB(stats.totalPledged)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t.kpi.thisMonthCollected} · {currentEth.month} {currentEth.year}
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-[#1E3A8A] dark:text-blue-400">
            {formatETB(stats.thisMonthCollected)}
          </div>
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#13294E] overflow-hidden">
            <div
              className="h-full bg-[#0B1F3A] dark:bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${stats.progressPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span>{stats.progressPct}%</span>
            <span>{formatETB(stats.monthlyTarget)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t.kpi.totalCollected}
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-slate-900 dark:text-white">
            {formatETB(stats.totalCollected)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {contributions.filter((c) => c.status !== 'voided').length}{' '}
            {lang === 'om' ? 'nagaheewwan' : 'receipts'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t.kpi.pendingVerifications}
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-amber-600 dark:text-amber-400">
            {stats.pendingCount}
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('contributions')}
            className="mt-1.5 text-xs font-semibold text-[#1E3A8A] dark:text-blue-400 hover:underline"
          >
            {lang === 'om' ? 'Galmee ilaali →' : 'Review ledger →'}
          </button>
        </div>
      </div>

      {/* Charts + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t.labels.collectionTrend} ({currentEth.year} E.C.)
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              ETB
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  formatter={(value: unknown) => [formatETB(Number(value || 0)), t.kpi.totalCollected]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullMonth
                      ? `${payload[0].payload.fullMonth} ${currentEth.year}`
                      : ''
                  }
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="amount" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              {t.labels.paymentMix}
            </h3>
            {channelBreakdown.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                {t.labels.emptyContributions}
              </div>
            ) : (
              <div className="space-y-3.5">
                {channelBreakdown.map((item) => (
                  <div key={item.method} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {item.label}
                      </span>
                      <span className="font-mono-tabular text-slate-900 dark:text-white font-semibold">
                        {formatETB(item.amount)} ({item.pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#13294E] overflow-hidden">
                      <div
                        className="h-full bg-[#1E3A8A] dark:bg-blue-500 rounded-full"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-5 mt-5 border-t border-slate-200 dark:border-[#1B3158] flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenNewContribution}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 px-3 py-2 text-xs font-semibold text-white whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.actions.recordPayment}</span>
            </button>
            <button
              type="button"
              onClick={onOpenNewMember}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#1B3158] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#13294E] whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t.actions.addMember}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Contributions Table */}
      <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1B3158] flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {t.labels.recentContributions}
          </h3>
          <button
            type="button"
            onClick={() => onNavigateTab('contributions')}
            className="text-xs font-semibold text-[#1E3A8A] dark:text-blue-400 hover:underline"
          >
            {lang === 'om' ? 'Hunda ilaali →' : 'View all →'}
          </button>
        </div>

        {recentContributions.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t.labels.emptyContributions}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {t.labels.emptyContributionsHint}
            </p>
            <button
              type="button"
              onClick={onOpenNewContribution}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-blue-700 px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.actions.recordPayment}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/50">
                  <th className="py-2.5 px-4">{t.labels.receiptNo}</th>
                  <th className="py-2.5 px-4">{t.labels.fullName}</th>
                  <th className="py-2.5 px-4">{t.labels.ethiopianMonth}</th>
                  <th className="py-2.5 px-4">{t.labels.paymentMethod}</th>
                  <th className="py-2.5 px-4">{t.labels.statusLabel}</th>
                  <th className="py-2.5 px-4 text-right">{t.labels.amountETB}</th>
                  <th className="py-2.5 px-4 text-right">{t.labels.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {recentContributions.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono-tabular font-semibold text-slate-700 dark:text-slate-300">
                      {c.receiptNumber}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {c.memberName}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-slate-500">
                        {c.memberId}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                      {c.ethiopianMonth} {c.ethiopianYear}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                      {t.paymentMethods[c.paymentMethod] || c.paymentMethod}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`font-semibold ${
                          c.status === 'verified' || c.status === 'completed'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : c.status === 'pending'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {t.status[c.status] || c.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-slate-900 dark:text-white">
                      {formatETB(c.amountETB)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => void downloadReceiptPDF(c, centerSettings, lang)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] dark:text-blue-400 hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

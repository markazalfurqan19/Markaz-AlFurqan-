import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Contribution, ETHIOPIAN_MONTHS, formatETB } from '../types';
import { Language, TRANSLATIONS } from '../i18n';

interface MonthlyTrendChartProps {
  contributions: Contribution[];
  ethiopianYear: number;
  lang: Language;
}

export const MonthlyTrendChart: React.FC<MonthlyTrendChartProps> = ({
  contributions,
  ethiopianYear,
  lang,
}) => {
  const t = TRANSLATIONS[lang];

  const { chartData, yearTotal, peakPoint } = useMemo(() => {
    const monthlySums = new Map<string, number>();
    ETHIOPIAN_MONTHS.forEach((m) => monthlySums.set(m, 0));

    let total = 0;
    contributions.forEach((c) => {
      if (c.status === 'voided' || c.ethiopianYear !== ethiopianYear) return;
      monthlySums.set(c.ethiopianMonth, (monthlySums.get(c.ethiopianMonth) || 0) + c.amountETB);
      total += c.amountETB;
    });

    const data = ETHIOPIAN_MONTHS.map((month) => ({
      month: month.slice(0, 4),
      fullMonth: month,
      amount: monthlySums.get(month) || 0,
    }));

    const peak = data.reduce<{ fullMonth: string; amount: number } | null>((best, item) => {
      if (item.amount <= 0) return best;
      if (!best || item.amount > best.amount) {
        return { fullMonth: item.fullMonth, amount: item.amount };
      }
      return best;
    }, null);

    return {
      chartData: data,
      yearTotal: total,
      peakPoint: peak,
    };
  }, [contributions, ethiopianYear]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#0B1933] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {t.labels.monthlyTrendLine} · {ethiopianYear} E.C.
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {lang === 'om'
              ? "Ida'ama buusii mirkanaa'ee ji'oota Itoophiyaa 13n keessatti"
              : 'Total non-voided contributions across all 13 Ethiopian months'}
          </p>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
          <span className="font-semibold text-slate-900 dark:text-white">
            {formatETB(yearTotal)}
          </span>
          {peakPoint && (
            <>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>
                {lang === 'om' ? 'Olka’aa' : 'Peak'}: {peakPoint.fullMonth} ({formatETB(peakPoint.amount)})
              </span>
            </>
          )}
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
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
                  ? `${payload[0].payload.fullMonth} ${ethiopianYear} E.C.`
                  : ''
              }
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="#1D4ED8"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#1D4ED8', strokeWidth: 2, stroke: '#ffffff' }}
              activeDot={{ r: 5.5, fill: '#0B1F3A', stroke: '#3B82F6', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

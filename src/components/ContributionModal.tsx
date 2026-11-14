import React, { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Printer, Send, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  CenterSetting,
  Contribution,
  ContributionStatus,
  ETHIOPIAN_MONTHS,
  Member,
  PaymentMethod,
  SCHEMA_LIMITS,
  getCurrentEthiopianDate,
} from '../types';
import { Language, TRANSLATIONS } from '../i18n';
import {
  PrintableReceiptData,
  downloadReceiptPDF,
  formatPrintableReceipt,
} from '../utils/pdfGenerator';

interface ContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: Omit<Contribution, 'id' | 'recordedBy' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  members: Member[];
  centerSettings: CenterSetting;
  editingContribution: Contribution | null;
  preselectedMember: Member | null;
  suggestedReceiptNo: string;
  lang: Language;
}

export const ContributionModal: React.FC<ContributionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  members,
  centerSettings,
  editingContribution,
  preselectedMember,
  suggestedReceiptNo,
  lang,
}) => {
  const t = TRANSLATIONS[lang];
  const currentEth = getCurrentEthiopianDate();

  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [amountETB, setAmountETB] = useState('500');
  const [ethiopianMonth, setEthiopianMonth] = useState(currentEth.month);
  const [ethiopianYear, setEthiopianYear] = useState(String(currentEth.year));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cbe');
  const [transactionReference, setTransactionReference] = useState('');
  const [status, setStatus] = useState<ContributionStatus>('completed');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printableReceipt, setPrintableReceipt] = useState<PrintableReceiptData | null>(null);
  const [receiptSnapshot, setReceiptSnapshot] = useState<Contribution | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (editingContribution) {
        setSelectedMemberId(editingContribution.memberId);
        setReceiptNumber(editingContribution.receiptNumber);
        setAmountETB(String(editingContribution.amountETB));
        setEthiopianMonth(editingContribution.ethiopianMonth);
        setEthiopianYear(String(editingContribution.ethiopianYear));
        setPaymentMethod(editingContribution.paymentMethod);
        setTransactionReference(editingContribution.transactionReference || '');
        setStatus(editingContribution.status);
        setNotes(editingContribution.notes || '');
      } else {
        const targetMember = preselectedMember || members[0] || null;
        setSelectedMemberId(targetMember ? targetMember.memberId : '');
        setReceiptNumber(suggestedReceiptNo);
        setAmountETB(targetMember ? String(targetMember.monthlyPledgeETB || 500) : '500');
        setEthiopianMonth(currentEth.month);
        setEthiopianYear(String(currentEth.year));
        setPaymentMethod('cbe');
        setTransactionReference('');
        setStatus('completed');
        setNotes('');
      }
      setError(null);
      setPrintableReceipt(null);
      setReceiptSnapshot(null);
    }
  }, [isOpen, editingContribution, preselectedMember, members, suggestedReceiptNo]);

  if (!isOpen) return null;

  const handleMemberChange = (code: string) => {
    setSelectedMemberId(code);
    const found = members.find((m) => m.memberId === code);
    if (found && !editingContribution) {
      setAmountETB(String(found.monthlyPledgeETB || 500));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchedMember = members.find((m) => m.memberId === selectedMemberId);
    const cleanMemberName = (
      matchedMember?.fullName ||
      editingContribution?.memberName ||
      ''
    )
      .trim()
      .slice(0, SCHEMA_LIMITS.CONTRIBUTION_MEMBER_NAME);
    const cleanMemberId = selectedMemberId.trim().slice(0, SCHEMA_LIMITS.CONTRIBUTION_MEMBER_ID);
    const cleanReceipt = receiptNumber.trim().slice(0, SCHEMA_LIMITS.CONTRIBUTION_RECEIPT);
    const amount = Number(amountETB);
    const year = Number(ethiopianYear);

    if (!cleanMemberId || !cleanMemberName || !cleanReceipt) {
      setError(
        lang === 'om'
          ? 'Maaloo miseensa fi lakkoofsa nagahee filadhaa.'
          : 'Please select a member and valid receipt number.'
      );
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      setError(
        lang === 'om'
          ? 'Hangi maallaqaa 0 ol ta’uu qaba.'
          : 'Contribution amount must be greater than 0.'
      );
      return;
    }
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      setError(lang === 'om' ? 'Bara Itoophiyaa sirrii galchaa.' : 'Enter a valid Ethiopian year.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSave({
        memberId: cleanMemberId,
        memberName: cleanMemberName,
        receiptNumber: cleanReceipt,
        amountETB: amount,
        ethiopianMonth: ethiopianMonth.slice(0, SCHEMA_LIMITS.CONTRIBUTION_MONTH),
        ethiopianYear: year,
        paymentMethod,
        transactionReference: transactionReference.trim().slice(0, SCHEMA_LIMITS.CONTRIBUTION_TX_REF),
        notes: notes.trim().slice(0, SCHEMA_LIMITS.CONTRIBUTION_NOTES),
        status,
      });

      if (!editingContribution && (status === 'completed' || status === 'verified')) {
        void confetti({
          particleCount: 55,
          spread: 60,
          origin: { y: 0.7 },
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReceipt = () => {
    const matchedMember = members.find((m) => m.memberId === selectedMemberId);
    const recipientEmail = matchedMember?.email?.trim() || '';
    if (!recipientEmail) {
      setError(t.labels.noMemberEmail);
      return;
    }

    const amount = Number(amountETB);
    const year = Number(ethiopianYear);
    if (!selectedMemberId || !receiptNumber.trim() || Number.isNaN(amount) || amount <= 0) {
      setError(
        lang === 'om'
          ? 'Maaloo odeeffannoo nagahee sirrii guutaa.'
          : 'Please ensure member, receipt number, and valid amount are filled.'
      );
      return;
    }

    setError(null);
    const snapshot: Contribution = {
      id: editingContribution?.id || 'preview',
      memberId: selectedMemberId.trim(),
      memberName:
        matchedMember?.fullName || editingContribution?.memberName || selectedMemberId.trim(),
      receiptNumber: receiptNumber.trim(),
      amountETB: amount,
      ethiopianMonth,
      ethiopianYear: Number.isNaN(year) ? currentEth.year : year,
      paymentMethod,
      transactionReference: transactionReference.trim(),
      notes: notes.trim(),
      recordedBy: editingContribution?.recordedBy || '',
      status,
      createdAt: editingContribution?.createdAt || new Date().toISOString(),
    };

    const formatted = formatPrintableReceipt(snapshot, recipientEmail, centerSettings, lang);
    setReceiptSnapshot(snapshot);
    setPrintableReceipt(formatted);
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
                {editingContribution ? t.actions.edit : t.actions.recordPayment}
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

        {printableReceipt && receiptSnapshot ? (
          <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
            <div className="no-print rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-2.5 text-xs text-[#0B1F3A] dark:text-blue-200 flex flex-wrap items-center justify-between gap-2">
              <span>
                {t.labels.receiptPreparedFor}{' '}
                <strong className="font-semibold">{printableReceipt.recipientEmail}</strong>
              </span>
              <span className="font-mono-tabular text-[11px] opacity-80">
                {new Date(printableReceipt.loggedAt).toLocaleTimeString()}
              </span>
            </div>

            {/* Clean Printable PDF-like Receipt Layout */}
            <div className="print-receipt-sheet rounded-xl border border-slate-200 dark:border-slate-700 bg-white text-slate-900 overflow-hidden shadow-xs">
              {/* Deep Navy Receipt Header */}
              <div className="bg-[#0B1F3A] px-5 py-4 flex items-center gap-3.5 text-white">
                <img
                  src={printableReceipt.logoUrl}
                  alt="Al-Furqaan Logo"
                  className="w-12 h-12 rounded-full object-cover border border-amber-300/40 bg-white shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#D4AF37] truncate">
                    {printableReceipt.centerName}
                  </div>
                  <div className="text-[11px] text-slate-200 tracking-wide">
                    NAGAHEE KAFFALTII DIJITAALAA / OFFICIAL RECEIPT
                  </div>
                  {printableReceipt.centerContact && (
                    <div className="text-[10px] text-slate-300 mt-0.5 font-mono-tabular">
                      {printableReceipt.centerContact}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div>
                    <div className="text-[11px] text-slate-500">{t.labels.receiptNo}</div>
                    <div className="text-sm font-bold font-mono-tabular text-slate-900">
                      {printableReceipt.receiptNumber}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">
                      {t.labels.date}: <span className="font-mono-tabular">{printableReceipt.formattedDate}</span>
                    </div>
                    <div className="font-semibold text-emerald-700">
                      {printableReceipt.statusLabel}
                    </div>
                  </div>
                </div>

                <table className="w-full text-left border-collapse border border-slate-200">
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <th className="py-2 px-3 bg-slate-50 font-semibold text-slate-700 w-40">
                        {t.labels.fullName}
                      </th>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {printableReceipt.memberName}
                      </td>
                    </tr>
                    <tr>
                      <th className="py-2 px-3 bg-slate-50 font-semibold text-slate-700">
                        {t.labels.memberCode}
                      </th>
                      <td className="py-2 px-3 font-mono-tabular text-slate-800">
                        {printableReceipt.memberId}
                      </td>
                    </tr>
                    <tr>
                      <th className="py-2 px-3 bg-slate-50 font-semibold text-slate-700">
                        {t.labels.ethiopianMonth}
                      </th>
                      <td className="py-2 px-3 text-slate-800">
                        {printableReceipt.ethiopianPeriod}
                      </td>
                    </tr>
                    <tr>
                      <th className="py-2 px-3 bg-slate-50 font-semibold text-slate-700">
                        {t.labels.paymentMethod}
                      </th>
                      <td className="py-2 px-3 text-slate-800">
                        {printableReceipt.paymentMethodLabel}
                      </td>
                    </tr>
                    <tr>
                      <th className="py-2 px-3 bg-slate-50 font-semibold text-slate-700">
                        {t.labels.txReference}
                      </th>
                      <td className="py-2 px-3 font-mono-tabular text-slate-800">
                        {printableReceipt.transactionReference}
                      </td>
                    </tr>
                    <tr>
                      <th className="py-2 px-3 bg-slate-50 font-semibold text-slate-700">
                        {t.labels.notes}
                      </th>
                      <td className="py-2 px-3 text-slate-700">{printableReceipt.notes}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="rounded-lg border border-[#1E3A8A]/30 bg-blue-50 px-4 py-3 flex items-center justify-between">
                  <span className="font-bold text-[#0B1F3A]">
                    {lang === 'om' ? 'Waliigala Kaffalame' : 'Total Paid'}
                  </span>
                  <span className="text-base font-bold font-mono-tabular text-[#0B1F3A]">
                    {printableReceipt.formattedAmount}
                  </span>
                </div>

                {printableReceipt.bankAccountDetails && (
                  <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                    {printableReceipt.bankAccountDetails}
                  </div>
                )}

                <div className="text-[10px] text-slate-400 pt-1">
                  Jazaakumullaahu Khayran — {printableReceipt.centerName} · {printableReceipt.recipientEmail}
                </div>
              </div>
            </div>

            <div className="no-print pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-[#1B3158]">
              <button
                type="button"
                onClick={() => setPrintableReceipt(null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-[#1B3158] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13294E] whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{lang === 'om' ? 'Deebi’i' : 'Back'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-[#1B3158] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#13294E] whitespace-nowrap shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.actions.printReceipt}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void downloadReceiptPDF(receiptSnapshot, centerSettings, lang)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 text-xs font-semibold text-white whitespace-nowrap shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{t.actions.downloadReceipt}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
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
              {members.length > 0 && !editingContribution ? (
                <select
                  required
                  value={selectedMemberId}
                  onChange={(e) => handleMemberChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.memberId}>
                      {m.fullName} ({m.memberId}) — {m.monthlyPledgeETB} ETB
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  disabled
                  value={
                    editingContribution
                      ? `${editingContribution.memberName} (${editingContribution.memberId})`
                      : lang === 'om'
                      ? 'Dursa miseensa galmeessaa'
                      : 'Register a member first'
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-slate-50 dark:bg-[#060E1F] px-3.5 py-2 text-sm text-slate-600 dark:text-slate-400"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.receiptNo} *
              </label>
              <input
                type="text"
                required
                disabled={Boolean(editingContribution)}
                maxLength={SCHEMA_LIMITS.CONTRIBUTION_RECEIPT}
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-slate-50 dark:bg-[#060E1F] px-3.5 py-2 text-sm font-mono-tabular text-slate-900 dark:text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.amountETB} *
              </label>
              <input
                type="number"
                required
                min={1}
                step="any"
                value={amountETB}
                onChange={(e) => setAmountETB(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.ethiopianMonth} *
              </label>
              <select
                value={ethiopianMonth}
                onChange={(e) => setEthiopianMonth(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              >
                {ETHIOPIAN_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.ethiopianYear} *
              </label>
              <input
                type="number"
                required
                min={2010}
                max={2050}
                value={ethiopianYear}
                onChange={(e) => setEthiopianYear(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.paymentMethod} *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              >
                {(['cbe', 'telebirr', 'awash', 'cbe_birr', 'cash', 'bank_transfer', 'other'] as PaymentMethod[]).map(
                  (method) => (
                    <option key={method} value={method}>
                      {t.paymentMethods[method]}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.statusLabel} *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ContributionStatus)}
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              >
                <option value="completed">{t.status.completed}</option>
                <option value="verified">{t.status.verified}</option>
                <option value="pending">{t.status.pending}</option>
                <option value="voided">{t.status.voided}</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.txReference}
              </label>
              <input
                type="text"
                maxLength={SCHEMA_LIMITS.CONTRIBUTION_TX_REF}
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                placeholder="FT26318..."
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.labels.notes}
              </label>
              <textarea
                rows={2}
                maxLength={SCHEMA_LIMITS.CONTRIBUTION_NOTES}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>
          </div>

          <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-[#1B3158]">
            <button
              type="button"
              onClick={handleSendReceipt}
              disabled={!selectedMemberId}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1E3A8A]/30 bg-blue-50 dark:bg-blue-950/40 text-xs font-semibold text-[#0B1F3A] dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t.actions.sendReceipt}</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-[#1B3158] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13294E] whitespace-nowrap shrink-0"
              >
                {t.actions.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting || (!editingContribution && members.length === 0)}
                className="px-4 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 text-xs font-semibold text-white disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {submitting ? '...' : t.actions.save}
              </button>
            </div>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

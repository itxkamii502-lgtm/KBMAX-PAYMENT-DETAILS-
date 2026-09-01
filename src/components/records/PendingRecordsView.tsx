import React, { useState, useEffect, useMemo } from 'react';
import { BillingRecord, Client } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { SlipModal } from '../slips/SlipModal';
import { SlipEditPinModal } from '../common/SlipEditPinModal';
import { DeleteRecordPinModal } from '../common/DeleteRecordPinModal';
import { PaymentConfirmationModal } from '../common/PaymentConfirmationModal';
import { ActiveTab } from '../layout/Sidebar';
import {
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Search,
  RefreshCw,
  PlusCircle,
  Eye,
  FileText,
  DollarSign,
  TrendingUp,
  MessageSquare,
  Sparkles,
  Layers,
  ChevronRight,
  ShieldCheck,
  Filter,
  ArrowUpDown,
  Phone,
  Calendar,
  CheckSquare,
  Square,
  Play,
  Trash2,
  Lock,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PendingRecordsViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  onAddRecordForClient?: (client: Client) => void;
}

export const PendingRecordsView: React.FC<PendingRecordsViewProps> = ({
  setActiveTab,
  onAddRecordForClient,
}) => {
  const { showToast } = useToast();
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'unsent' | 'payment_pending'>('all');
  const [selectedRecordForSlip, setSelectedRecordForSlip] = useState<BillingRecord | null>(null);
  const [selectedRecordForPaymentSMS, setSelectedRecordForPaymentSMS] = useState<BillingRecord | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);

  // WhatsApp Resend Security PIN Protection (PIN: 0214)
  const [resendTargetRecord, setResendTargetRecord] = useState<BillingRecord | null>(null);
  const [isBatchResendPrompt, setIsBatchResendPrompt] = useState(false);
  const [showResendPinModal, setShowResendPinModal] = useState(false);

  // Multi-select for batch dispatch
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(new Set());
  const [isBatchSending, setIsBatchSending] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [deleteTarget, setDeleteTarget] = useState<{
    recordId?: number;
    recordIds?: number[];
    recordTitle?: string;
    clientName?: string;
  } | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      // Fetch all billing records
      const allRecords = await api.getBillingRecords();
      setRecords(allRecords);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch pending records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Filter records that are Pending (not fully completed or unsent)
  const pendingRecords = useMemo(() => {
    return records.filter((r) => {
      // Pending criteria: payment_status is not 'Payment Completed' OR specifically in Draft/Pending/Unsent
      const isPaymentPending = r.payment_status !== 'Payment Completed';
      const isUnsent = !r.whatsapp_status || r.whatsapp_status === 'Not Sent' || r.whatsapp_status === 'Sending';

      if (filterType === 'all') {
        return isPaymentPending || isUnsent;
      }
      if (filterType === 'payment_pending') {
        return isPaymentPending;
      }
      if (filterType === 'unsent') {
        return isUnsent;
      }
      return isPaymentPending;
    });
  }, [records, filterType]);

  // Apply search query
  const filteredRecords = useMemo(() => {
    if (!search.trim()) return pendingRecords;
    const q = search.toLowerCase().trim();
    return pendingRecords.filter(
      (r) =>
        r.client_name_snapshot?.toLowerCase().includes(q) ||
        r.panel_name_snapshot?.toLowerCase().includes(q) ||
        r.payment_method_name_snapshot?.toLowerCase().includes(q) ||
        r.payment_details_snapshot?.toLowerCase().includes(q) ||
        (r.whatsapp_number_snapshot && r.whatsapp_number_snapshot.includes(q)) ||
        ((r as any).client_whatsapp && (r as any).client_whatsapp.includes(q)) ||
        String(r.id) === q
    );
  }, [pendingRecords, search]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalPendingCount = pendingRecords.length;
    const totalPendingAmount = pendingRecords.reduce((acc, r) => acc + (Number(r.net_payable) || 0), 0);
    const totalPendingSms = pendingRecords.reduce((acc, r) => acc + (Number(r.total_sms) || 0), 0);
    const unsentWhatsAppCount = pendingRecords.filter(
      (r) => !r.whatsapp_status || r.whatsapp_status === 'Not Sent'
    ).length;

    return {
      totalPendingCount,
      totalPendingAmount,
      totalPendingSms,
      unsentWhatsAppCount,
    };
  }, [pendingRecords]);

  const isRecordAlreadySent = (rec: BillingRecord) => {
    return Boolean(
      (rec.whatsapp_send_count && Number(rec.whatsapp_send_count) > 0) ||
      rec.whatsapp_status === 'Sent' ||
      rec.whatsapp_status === 'Direct Link Generated'
    );
  };

  // 1-Click WhatsApp Direct Dispatch (Gated by PIN 0214 if already sent)
  const handleDirectWhatsAppSend = (record: BillingRecord) => {
    if (isRecordAlreadySent(record)) {
      setResendTargetRecord(record);
      setIsBatchResendPrompt(false);
      setShowResendPinModal(true);
    } else {
      executeDirectWhatsAppSend(record);
    }
  };

  const executeDirectWhatsAppSend = async (record: BillingRecord) => {
    const rawNumber =
      record.whatsapp_number_snapshot ||
      (record as any).client_whatsapp ||
      '';

    if (!rawNumber) {
      showToast('Client WhatsApp number is not configured.', 'error');
      return;
    }

    const slipText = record.professional_slip || record.simple_slip || 'No slip text generated.';

    setSendingId(record.id);
    try {
      const res = await api.sendWhatsAppMessage({
        client_id: record.client_id,
        billing_record_id: record.id,
        message_type: 'Billing Slip',
        recipient_number: rawNumber,
        message_body: slipText,
      });

      showToast(`WhatsApp slip generated for ${record.client_name_snapshot}!`, 'success');

      if (res.directUrl) {
        window.open(res.directUrl, '_blank', 'noopener,noreferrer');
      }

      fetchRecords();
    } catch (err: any) {
      showToast(err.message || 'Failed to dispatch WhatsApp slip.', 'error');
    } finally {
      setSendingId(null);
    }
  };

  // 1-Click Copy Slip
  const handleCopySlip = (record: BillingRecord) => {
    const slipText = record.professional_slip || record.simple_slip || '';
    if (!slipText) {
      showToast('No slip text found for this record.', 'error');
      return;
    }
    navigator.clipboard.writeText(slipText);
    setCopiedId(record.id);
    showToast(`Slip for ${record.client_name_snapshot} copied to clipboard!`, 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Toggle or Update Payment Status
  const handleTogglePaymentStatus = async (record: BillingRecord, newStatus: string) => {
    try {
      await api.updateBillingRecordStatus(record.id, {
        payment_status: newStatus,
        payment_date: newStatus === 'Payment Completed' ? new Date().toISOString().split('T')[0] : null,
      });

      if (newStatus === 'Payment Completed') {
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.7 },
        });
        showToast(`Record #${record.id} marked as Payment Completed!`, 'success');
        // Automatically prompt the customizable WhatsApp Payment Confirmation SMS
        setSelectedRecordForPaymentSMS({ ...record, payment_status: 'Payment Completed' });
      } else {
        showToast(`Record #${record.id} status updated to "${newStatus}"!`, 'success');
      }

      fetchRecords();
    } catch (err: any) {
      showToast(err.message || 'Failed to update payment status.', 'error');
    }
  };

  // Selection toggle
  const toggleSelectRecord = (id: number) => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRecordIds.size === filteredRecords.length && filteredRecords.length > 0) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(filteredRecords.map((r) => r.id)));
    }
  };

  // Batch Mark as Payment Completed
  const handleBatchMarkCompleted = async () => {
    if (selectedRecordIds.size === 0) return;
    if (!confirm(`Mark ${selectedRecordIds.size} records as Payment Completed?`)) return;

    setLoading(true);
    try {
      const ids: number[] = Array.from(selectedRecordIds);
      for (const id of ids) {
        await api.updateBillingRecordStatus(id, {
          payment_status: 'Payment Completed',
          payment_date: new Date().toISOString().split('T')[0],
        });
      }
      showToast(`${ids.length} records marked as Payment Completed!`, 'success');
      setSelectedRecordIds(new Set());
      fetchRecords();
    } catch (err: any) {
      showToast(err.message || 'Batch update failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Batch WhatsApp Dispatch (Sequential / Paced)
  const handleBatchWhatsAppSend = async () => {
    const selectedList = filteredRecords.filter((r) => selectedRecordIds.has(r.id));
    if (selectedList.length === 0) return;

    // Check if any selected record was already sent
    const alreadySentCount = selectedList.filter(isRecordAlreadySent).length;
    if (alreadySentCount > 0) {
      setIsBatchResendPrompt(true);
      setResendTargetRecord(null);
      setShowResendPinModal(true);
      return;
    }

    await executeBatchWhatsAppSend(selectedList);
  };

  const executeBatchWhatsAppSend = async (selectedList: BillingRecord[]) => {
    setIsBatchSending(true);
    setBatchProgress({ current: 0, total: selectedList.length });

    for (let i = 0; i < selectedList.length; i++) {
      const rec = selectedList[i];
      setBatchProgress({ current: i + 1, total: selectedList.length });

      const rawNumber = rec.whatsapp_number_snapshot || (rec as any).client_whatsapp || '';
      const slipText = rec.professional_slip || rec.simple_slip || '';

      if (rawNumber && slipText) {
        try {
          const res = await api.sendWhatsAppMessage({
            client_id: rec.client_id,
            billing_record_id: rec.id,
            message_type: 'Billing Slip',
            recipient_number: rawNumber,
            message_body: slipText,
          });
          if (res.directUrl) {
            window.open(res.directUrl, '_blank', 'noopener,noreferrer');
          }
        } catch (e) {
          console.error('Failed to send for record', rec.id, e);
        }
      }

      // 1.2s delay between tabs to prevent browser popup block
      if (i < selectedList.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }

    setIsBatchSending(false);
    showToast(`Batch WhatsApp dispatch completed for ${selectedList.length} clients!`, 'success');
    setSelectedRecordIds(new Set());
    fetchRecords();
  };

  // PIN 0214 verification callback for WhatsApp Resend
  const handleResendPinVerified = async () => {
    setShowResendPinModal(false);
    if (isBatchResendPrompt) {
      const selectedList = filteredRecords.filter((r) => selectedRecordIds.has(r.id));
      showToast('Batch WhatsApp resend authorized with PIN 0214!', 'success');
      await executeBatchWhatsAppSend(selectedList);
    } else if (resendTargetRecord) {
      showToast(`WhatsApp resend authorized for ${resendTargetRecord.client_name_snapshot} with PIN 0214!`, 'success');
      const target = resendTargetRecord;
      setResendTargetRecord(null);
      await executeDirectWhatsAppSend(target);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
              <Clock className="w-3.5 h-3.5" />
              <span>Pending Billing & Dispatch Queue</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>Pending Records</span>
              <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {metrics.totalPendingCount} Active
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Tamam pending haftawar bills, unsent WhatsApp slips aur awaiting payment records yahan manage aur 1-click dispatch karein.
            </p>
          </div>

          {/* Quick Action CTAs */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setActiveTab('add_record')}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/60 flex items-center gap-2 transition-all cursor-pointer min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add New Record</span>
            </button>

            <button
              onClick={fetchRecords}
              disabled={loading}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center gap-2 cursor-pointer min-h-[44px]"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Pending Bills */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Pending</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-amber-400 mt-2.5 font-mono">
            {metrics.totalPendingCount} <span className="text-xs text-slate-400 font-sans">Records</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Awaiting clearance or sending</p>
        </div>

        {/* Unsent WhatsApp Slips */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Unsent Slips</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-emerald-400 mt-2.5 font-mono">
            {metrics.unsentWhatsAppCount} <span className="text-xs text-slate-400 font-sans">Slips</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Ready for WhatsApp dispatch</p>
        </div>

        {/* Total Pending Amount */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pending Amount</span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-sky-400 mt-2.5 font-mono">
            Rs. {metrics.totalPendingAmount.toLocaleString()}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Total payable PKR balance</p>
        </div>

        {/* Total Pending SMS Volume */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pending SMS</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-purple-300 mt-2.5 font-mono">
            {metrics.totalPendingSms.toLocaleString()} <span className="text-xs text-slate-400 font-sans">SMS</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Cumulative messages billed</p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by client name, panel, WhatsApp number, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-emerald-500 transition min-h-[44px]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap min-h-[40px] ${
              filterType === 'all'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Pending ({pendingRecords.length})
          </button>

          <button
            onClick={() => setFilterType('unsent')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap min-h-[40px] flex items-center gap-1.5 ${
              filterType === 'unsent'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Unsent WhatsApp</span>
          </button>

          <button
            onClick={() => setFilterType('payment_pending')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap min-h-[40px] flex items-center gap-1.5 ${
              filterType === 'payment_pending'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Awaiting Payment</span>
          </button>
        </div>
      </div>

      {/* Batch Operations Bar (if items selected) */}
      {selectedRecordIds.size > 0 && (
        <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
              {selectedRecordIds.size}
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                {selectedRecordIds.size} Pending Records Selected
              </p>
              <p className="text-[11px] text-emerald-300">
                Execute batch dispatch or update payment statuses in 1-click.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchWhatsAppSend}
              disabled={isBatchSending}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer min-h-[40px]"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isBatchSending
                  ? `Sending (${batchProgress.current}/${batchProgress.total})...`
                  : 'Send WhatsApp (Batch)'}
              </span>
            </button>

            <button
              onClick={handleBatchMarkCompleted}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer min-h-[40px]"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark as Paid</span>
            </button>

            <button
              onClick={() =>
                setDeleteTarget({
                  recordIds: Array.from(selectedRecordIds),
                  recordTitle: `Batch Delete ${selectedRecordIds.size} Records`,
                })
              }
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer min-h-[40px]"
              title="Delete selected records using PIN 41200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete (PIN)</span>
            </button>

            <button
              onClick={() => setSelectedRecordIds(new Set())}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition cursor-pointer min-h-[40px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Records Container: Responsive Table (Desktop) + Touch Cards (Mobile) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {/* Table Header Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
            >
              {selectedRecordIds.size === filteredRecords.length && filteredRecords.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-emerald-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>Select All ({filteredRecords.length})</span>
            </button>
          </div>

          <span className="text-xs text-slate-400">
            Showing <strong>{filteredRecords.length}</strong> pending records
          </span>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Loading pending records...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredRecords.length === 0 && (
          <div className="py-20 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">No Pending Records Found!</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Tamam haftawar billing records clear hain ya search criteria se match nahi hue. Naya record add karne ke liye niche button dabayein.
            </p>
            <button
              onClick={() => setActiveTab('add_record')}
              className="mt-4 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 shadow-lg shadow-emerald-950/60 cursor-pointer min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Weekly Record</span>
            </button>
          </div>
        )}

        {/* DESKTOP VIEW: High-Density Table (hidden on mobile) */}
        {!loading && filteredRecords.length > 0 && (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 w-10">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="py-3.5 px-4">Client & Contact</th>
                  <th className="py-3.5 px-4">Panel & Billing Week</th>
                  <th className="py-3.5 px-4 text-center">SMS Volume</th>
                  <th className="py-3.5 px-4 text-right">Net Payable</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions & Send</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredRecords.map((rec) => {
                  const isSelected = selectedRecordIds.has(rec.id);
                  const isPaid = rec.payment_status === 'Payment Completed';
                  const isSendingThis = sendingId === rec.id;
                  const isCopiedThis = copiedId === rec.id;
                  const phoneNum =
                    rec.whatsapp_number_snapshot ||
                    (rec as any).client_whatsapp ||
                    '';

                  return (
                    <tr
                      key={rec.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-emerald-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-4">
                        <button
                          type="button"
                          onClick={() => toggleSelectRecord(rec.id)}
                          className="text-slate-400 hover:text-white cursor-pointer p-1"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                      </td>

                      {/* Client info */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-sm">
                            {rec.client_name_snapshot}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-emerald-400" />
                            <span>{phoneNum || 'No phone'}</span>
                          </span>
                          {rec.payment_method_name_snapshot && (
                            <span className="text-[10px] text-slate-500 mt-0.5">
                              💳 {rec.payment_method_name_snapshot} ({rec.payment_details_snapshot || 'Standard'})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Panel & Week */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-emerald-400 text-xs">
                            {rec.panel_name_snapshot || 'KB MAX - LAMIX SMS PANAL'}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>
                              {rec.billing_period_start} ➔ {rec.billing_period_end}
                            </span>
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Cycle: {rec.billing_cycle || 'Haftawar (Weekly)'}
                          </span>
                        </div>
                      </td>

                      {/* SMS Volume */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-mono font-bold text-slate-200 text-sm">
                          {(rec.total_sms || 0).toLocaleString()}
                        </span>
                        <span className="block text-[10px] text-slate-500">Total SMS</span>
                      </td>

                      {/* Net Payable */}
                      <td className="py-4 px-4 text-right">
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          Rs. {(rec.net_payable || 0).toLocaleString()}
                        </span>
                        <span className="block text-[10px] text-slate-500">PKR Total</span>
                      </td>

                      {/* Payment & WhatsApp Status */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {/* Payment status badge */}
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isPaid
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : rec.payment_status === 'Payment Sent'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {rec.payment_status}
                          </span>

                          {/* WhatsApp dispatch status */}
                          <span
                            className={`text-[9px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                              isRecordAlreadySent(rec)
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isRecordAlreadySent(rec) && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />}
                            <span>
                              {isRecordAlreadySent(rec)
                                ? `WA: Sent ${rec.whatsapp_send_count && rec.whatsapp_send_count > 1 ? `(${rec.whatsapp_send_count}x)` : ''}`
                                : 'WA: Unsent'}
                            </span>
                          </span>
                        </div>
                      </td>

                      {/* Actions: Send WhatsApp, View Slip, Copy Slip, Mark Paid */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* WhatsApp 1-Click Send / Resend (PIN 0214 if already sent) */}
                          <button
                            onClick={() => handleDirectWhatsAppSend(rec)}
                            disabled={isSendingThis}
                            className={`px-2.5 py-1.5 rounded-xl text-white font-bold text-xs flex items-center gap-1 shadow-md transition cursor-pointer min-h-[36px] ${
                              isRecordAlreadySent(rec)
                                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/60'
                                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950'
                            }`}
                            title={
                              isRecordAlreadySent(rec)
                                ? 'Slip pehle hi WhatsApp par bheji ja chuki hai. Dobara bhejne ke liye PIN 0214 darkaar hai.'
                                : 'Send WhatsApp Slip'
                            }
                          >
                            {isRecordAlreadySent(rec) ? (
                              <Lock className="w-3 h-3 text-amber-200" />
                            ) : (
                              <Send className={`w-3.5 h-3.5 ${isSendingThis ? 'animate-pulse' : ''}`} />
                            )}
                            <span>{isRecordAlreadySent(rec) ? 'Resend' : 'Send'}</span>
                            {isRecordAlreadySent(rec) && (
                              <span className="text-[9px] bg-amber-700/80 px-1 py-0.2 rounded font-mono">
                                0214
                              </span>
                            )}
                          </button>

                          {/* View Full Slip Modal */}
                          <button
                            onClick={() => setSelectedRecordForSlip(rec)}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="View / Print Slip"
                          >
                            <Eye className="w-4 h-4 text-sky-400" />
                          </button>

                          {/* Copy Slip Text */}
                          <button
                            onClick={() => handleCopySlip(rec)}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="Copy Slip Text"
                          >
                            {isCopiedThis ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-slate-400" />
                            )}
                          </button>

                          {/* Quick Toggle Payment Complete */}
                          <button
                            onClick={() =>
                              handleTogglePaymentStatus(
                                rec,
                                isPaid ? 'Payment Pending' : 'Payment Completed'
                              )
                            }
                            className={`p-1.5 rounded-xl border transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center ${
                              isPaid
                                ? 'bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700'
                                : 'bg-amber-600/20 text-amber-300 border-amber-500/30 hover:bg-amber-600/30'
                            }`}
                            title={isPaid ? 'Mark Pending' : 'Mark Payment Completed'}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>

                          {/* Send WhatsApp Payment Confirmation SMS */}
                          <button
                            onClick={() => setSelectedRecordForPaymentSMS(rec)}
                            className="p-1.5 rounded-xl bg-blue-950/50 hover:bg-blue-900/60 text-blue-300 border border-blue-500/30 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="Send WhatsApp Payment Sent SMS (KBMAX Template)"
                          >
                            <Sparkles className="w-4 h-4 text-blue-400" />
                          </button>

                          {/* Delete Record with PIN */}
                          <button
                            onClick={() =>
                              setDeleteTarget({
                                recordId: rec.id,
                                recordTitle: `Record #${rec.id} (${rec.billing_period_start} to ${rec.billing_period_end})`,
                                clientName: rec.client_name_snapshot,
                              })
                            }
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="Delete Record (PIN 41200)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* MOBILE VIEW: Touch-Optimized Cards (visible on mobile / tablets < 768px) */}
        {!loading && filteredRecords.length > 0 && (
          <div className="block md:hidden divide-y divide-slate-800/80">
            {filteredRecords.map((rec) => {
              const isSelected = selectedRecordIds.has(rec.id);
              const isPaid = rec.payment_status === 'Payment Completed';
              const isSendingThis = sendingId === rec.id;
              const isCopiedThis = copiedId === rec.id;
              const phoneNum =
                rec.whatsapp_number_snapshot ||
                (rec as any).client_whatsapp ||
                '';

              return (
                <div
                  key={rec.id}
                  className={`p-4 space-y-3 transition-colors ${
                    isSelected ? 'bg-emerald-950/20' : 'hover:bg-slate-800/30'
                  }`}
                >
                  {/* Top row: Checkbox, Client Name, Status Badge & Quick Delete */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelectRecord(rec.id)}
                        className="text-slate-400 hover:text-white p-1 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-600" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <h4 className="font-bold text-white text-base truncate">
                          {rec.client_name_snapshot}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="font-mono">{phoneNum || 'No phone'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isPaid
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {rec.payment_status}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            recordId: rec.id,
                            recordTitle: `Record #${rec.id} (${rec.billing_period_start} to ${rec.billing_period_end})`,
                            clientName: rec.client_name_snapshot,
                          })
                        }
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                        title="Delete Record (PIN 41200)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Middle row: Panel, Week, SMS, Amount */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                        Panel
                      </span>
                      <span className="font-bold text-emerald-400 truncate block">
                        {rec.panel_name_snapshot || 'KB MAX'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                        Billing Period
                      </span>
                      <span className="font-mono text-slate-300 block text-[11px]">
                        {rec.billing_period_start} ➔ {rec.billing_period_end}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                        Total SMS
                      </span>
                      <span className="font-mono font-bold text-white text-sm">
                        {(rec.total_sms || 0).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                        Net Payable
                      </span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        Rs. {(rec.net_payable || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action Buttons: Full touch targets (>= 44px) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {/* Send WhatsApp (1-Click) / Resend (PIN 0214) */}
                    <button
                      type="button"
                      onClick={() => handleDirectWhatsAppSend(rec)}
                      disabled={isSendingThis}
                      className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer ${
                        isRecordAlreadySent(rec)
                          ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/60'
                          : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950'
                      }`}
                      title={
                        isRecordAlreadySent(rec)
                          ? 'Slip pehle hi WhatsApp par bheji ja chuki hai. Dobara bhejne ke liye PIN 0214 darkaar hai.'
                          : 'Send WhatsApp'
                      }
                    >
                      {isRecordAlreadySent(rec) ? (
                        <Lock className="w-3.5 h-3.5 text-amber-200" />
                      ) : (
                        <Send className={`w-4 h-4 ${isSendingThis ? 'animate-pulse' : ''}`} />
                      )}
                      <span>{isRecordAlreadySent(rec) ? 'Resend WhatsApp' : 'Send WhatsApp'}</span>
                      {isRecordAlreadySent(rec) && (
                        <span className="text-[10px] bg-amber-700/80 px-1.5 py-0.5 rounded font-mono">
                          PIN 0214
                        </span>
                      )}
                    </button>

                    {/* View Slip */}
                    <button
                      type="button"
                      onClick={() => setSelectedRecordForSlip(rec)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-sky-400" />
                      <span>View Slip</span>
                    </button>

                    {/* Copy Text */}
                    <button
                      type="button"
                      onClick={() => handleCopySlip(rec)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer"
                    >
                      {isCopiedThis ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-slate-400" />
                          <span>Copy Slip</span>
                        </>
                      )}
                    </button>

                    {/* Toggle Done / Paid */}
                    <button
                      type="button"
                      onClick={() =>
                        handleTogglePaymentStatus(
                          rec,
                          isPaid ? 'Payment Pending' : 'Payment Completed'
                        )
                      }
                      className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                        isPaid
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : 'bg-amber-600/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isPaid ? 'Mark Pending' : 'Mark as Paid'}</span>
                    </button>

                    {/* Send Payment Confirmation SMS */}
                    <button
                      type="button"
                      onClick={() => setSelectedRecordForPaymentSMS(rec)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-blue-500/40 transition cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <span>Payment SMS</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PIN-Protected Deletion Modal */}
      {deleteTarget && (
        <DeleteRecordPinModal
          isOpen={!!deleteTarget}
          recordId={deleteTarget.recordId}
          recordIds={deleteTarget.recordIds}
          recordTitle={deleteTarget.recordTitle}
          clientName={deleteTarget.clientName}
          onClose={() => setDeleteTarget(null)}
          onSuccess={() => {
            setDeleteTarget(null);
            setSelectedRecordIds(new Set());
            fetchRecords();
          }}
        />
      )}

      {/* Payment Confirmation WhatsApp Modal */}
      {selectedRecordForPaymentSMS && (
        <PaymentConfirmationModal
          isOpen={!!selectedRecordForPaymentSMS}
          record={selectedRecordForPaymentSMS}
          onClose={() => setSelectedRecordForPaymentSMS(null)}
          onSuccess={() => {
            setSelectedRecordForPaymentSMS(null);
            fetchRecords();
          }}
        />
      )}

      {/* WhatsApp Resend PIN Modal (PIN: 0214) */}
      {showResendPinModal && (
        <SlipEditPinModal
          isOpen={showResendPinModal}
          onClose={() => {
            setShowResendPinModal(false);
            setResendTargetRecord(null);
          }}
          onVerified={handleResendPinVerified}
          title={
            isBatchResendPrompt
              ? 'Batch WhatsApp Resend Security (PIN 0214)'
              : 'WhatsApp Resend Security (PIN 0214)'
          }
          description={
            isBatchResendPrompt
              ? 'Selected records mein pehle se sent slips shamil hain. Dobara (Resend) dispatch karne ke liye Security PIN 0214 darj karein.'
              : `Yeh slip pehle hi WhatsApp par bheji ja chuki hai (${resendTargetRecord?.client_name_snapshot || 'Client'}). Dobara bhejne ke liye Security PIN 0214 darj karein.`
          }
        />
      )}

      {/* Slip Modal Popup */}
      {selectedRecordForSlip && (
        <SlipModal
          record={selectedRecordForSlip}
          onClose={() => setSelectedRecordForSlip(null)}
          onStatusUpdated={() => {
            fetchRecords();
            setSelectedRecordForSlip(null);
          }}
        />
      )}
    </div>
  );
};

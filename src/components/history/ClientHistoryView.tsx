import React, { useState, useEffect, useMemo } from 'react';
import { Client, BillingRecord } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { SlipModal } from '../slips/SlipModal';
import { DeleteRecordPinModal } from '../common/DeleteRecordPinModal';
import {
  History,
  Search,
  Users,
  Phone,
  CreditCard,
  ChevronRight,
  PlusCircle,
  FileText,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Send,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Filter,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface ClientHistoryViewProps {
  initialClient?: Client | null;
  onAddRecordForClient: (client: Client) => void;
}

export const ClientHistoryView: React.FC<ClientHistoryViewProps> = ({
  initialClient,
  onAddRecordForClient,
}) => {
  const { showToast } = useToast();
  const { theme } = useTheme();

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(
    initialClient?.id || null
  );
  const [clientSearch, setClientSearch] = useState('');
  const [loadingClients, setLoadingClients] = useState(true);

  // Selected client records & details
  const [clientRecords, setClientRecords] = useState<BillingRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordSearch, setRecordSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals
  const [selectedRecordForSlip, setSelectedRecordForSlip] = useState<BillingRecord | null>(null);
  const [recordToDeleteForPin, setRecordToDeleteForPin] = useState<BillingRecord | null>(null);

  // Fetch all clients
  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const data = await api.getClients({});
      // Consistent sort by registration / ID
      const sorted = [...data].sort((a, b) => a.id - b.id);
      setClients(sorted);

      // If no client selected or previously selected client was deleted, select first
      if (sorted.length > 0) {
        if (!selectedClientId || !sorted.some((c) => c.id === selectedClientId)) {
          setSelectedClientId(initialClient?.id || sorted[0].id);
        }
      } else {
        setSelectedClientId(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load client list.', 'error');
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Whenever initialClient prop changes from outside
  useEffect(() => {
    if (initialClient) {
      setSelectedClientId(initialClient.id);
    }
  }, [initialClient]);

  // Clients with dynamic sequential numbering (Client 1, Client 2, Client 3... No gaps!)
  const numberedClients = useMemo(() => {
    return clients.map((client, index) => ({
      ...client,
      clientNumber: index + 1,
      clientLabel: `Client ${index + 1}`,
    }));
  }, [clients]);

  // Filtered clients for the selector
  const filteredNumberedClients = useMemo(() => {
    if (!clientSearch.trim()) return numberedClients;
    const q = clientSearch.toLowerCase();
    return numberedClients.filter(
      (c) =>
        c.client_name.toLowerCase().includes(q) ||
        c.clientLabel.toLowerCase().includes(q) ||
        c.whatsapp_number.includes(q) ||
        `client ${c.clientNumber}`.includes(q) ||
        `#${c.id}`.includes(q)
    );
  }, [numberedClients, clientSearch]);

  // Currently active selected client object
  const activeClient = useMemo(() => {
    return numberedClients.find((c) => c.id === selectedClientId) || null;
  }, [numberedClients, selectedClientId]);

  // Load history records for the selected client
  const loadClientHistory = async (clientId: number) => {
    setLoadingRecords(true);
    try {
      const data = await api.getClientHistory(clientId);
      // Sort records by billing_period_start descending (most recent first)
      const sortedRecords = (data.records || []).sort((a: BillingRecord, b: BillingRecord) => {
        const dateA = new Date(a.billing_period_start).getTime() || 0;
        const dateB = new Date(b.billing_period_start).getTime() || 0;
        return dateB - dateA || b.id - a.id;
      });
      setClientRecords(sortedRecords);
    } catch (err: any) {
      showToast(err.message || 'Failed to load client history records.', 'error');
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    if (selectedClientId) {
      loadClientHistory(selectedClientId);
    } else {
      setClientRecords([]);
    }
  }, [selectedClientId]);

  // Filtered records for selected client
  const filteredRecords = useMemo(() => {
    return clientRecords.filter((rec) => {
      const matchSearch =
        !recordSearch.trim() ||
        rec.billing_period_start.includes(recordSearch) ||
        rec.billing_period_end.includes(recordSearch) ||
        (rec.panel_name_snapshot || '').toLowerCase().includes(recordSearch.toLowerCase()) ||
        (rec.notes || '').toLowerCase().includes(recordSearch.toLowerCase());

      const matchStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Pending' && rec.payment_status !== 'Payment Completed') ||
        (statusFilter === 'Completed' && rec.payment_status === 'Payment Completed') ||
        rec.payment_status.toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchStatus;
    });
  }, [clientRecords, recordSearch, statusFilter]);

  // Categorize records into Week Buckets (Current/New Week, Previous Week, Older Weeks)
  const categorizedRecords = useMemo(() => {
    if (filteredRecords.length === 0) {
      return { currentWeek: null, previousWeek: null, olderWeeks: [] };
    }
    const [current, prev, ...older] = filteredRecords;
    return {
      currentWeek: current || null,
      previousWeek: prev || null,
      olderWeeks: older || [],
    };
  }, [filteredRecords]);

  // Client Stats Calculations
  const stats = useMemo(() => {
    const totalWeeks = clientRecords.length;
    const totalSms = clientRecords.reduce(
      (s, r) => s + (r.total_sms || 0),
      0
    );
    const totalAmount = clientRecords.reduce(
      (s, r) => s + (r.net_payable || r.calculated_total || 0),
      0
    );
    const pendingAmount = clientRecords
      .filter((r) => r.payment_status !== 'Payment Completed')
      .reduce((s, r) => s + (r.net_payable || r.calculated_total || 0), 0);
    const completedAmount = totalAmount - pendingAmount;

    return { totalWeeks, totalSms, totalAmount, pendingAmount, completedAmount };
  }, [clientRecords]);

  // Status Updater
  const handleUpdateStatus = async (record: BillingRecord, newStatus: string) => {
    try {
      await api.updateBillingRecordStatus(record.id, {
        payment_status: newStatus,
        payment_date: newStatus === 'Payment Completed' ? new Date().toISOString().split('T')[0] : null,
      });
      showToast(`Record #${record.id} status updated to "${newStatus}".`, 'success');
      if (selectedClientId) {
        loadClientHistory(selectedClientId);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update record status.', 'error');
    }
  };

  const cardBg =
    theme === 'light'
      ? 'bg-white border-slate-200 text-slate-800 shadow-xs'
      : theme === 'midnight'
      ? 'bg-black border-slate-800/80 text-slate-100 shadow-xl'
      : 'bg-slate-900 border-slate-800 text-slate-100 shadow-md';

  const subCardBg =
    theme === 'light'
      ? 'bg-slate-50 border-slate-200 text-slate-800'
      : theme === 'midnight'
      ? 'bg-zinc-950 border-slate-800/80 text-slate-100'
      : 'bg-slate-950/60 border-slate-800/80 text-slate-100';

  // Render a Single Weekly Record Card
  const renderWeeklyCard = (record: BillingRecord, weekLabel: string, badgeColor: string) => {
    const isCompleted = record.payment_status === 'Payment Completed';
    const isSent = record.payment_status === 'Payment Sent';

    return (
      <div
        key={record.id}
        className={`${subCardBg} border rounded-2xl p-4 sm:p-5 transition-all hover:border-emerald-500/40 relative group`}
      >
        {/* Top Header of the Week Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-inherit">
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-black px-3 py-1 rounded-xl uppercase tracking-wider border shadow-xs ${badgeColor}`}
            >
              {weekLabel}
            </span>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="font-mono text-xs sm:text-sm font-bold">
                {record.billing_period_start} <span className="opacity-50">➔</span> {record.billing_period_end}
              </span>
            </div>
          </div>

          {/* Payment Status Dropdown Selector */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] opacity-60 font-medium">Status:</span>
            <select
              value={record.payment_status}
              onChange={(e) => handleUpdateStatus(record, e.target.value)}
              className={`text-xs font-bold px-3 py-1 rounded-full border outline-none cursor-pointer transition-all ${
                isCompleted
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                  : isSent
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
              }`}
            >
              <option value="Payment Pending">Payment Pending</option>
              <option value="Payment Sent">Payment Sent</option>
              <option value="Payment Completed">Payment Completed</option>
            </select>
          </div>
        </div>

        {/* Card Body Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-4 border-b border-inherit">
          {/* SMS Volume */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block">
              SMS Volume
            </span>
            <div className="flex items-baseline gap-1 mt-1 font-mono">
              <span className="text-xl font-black">
                {(record.total_sms || 0).toLocaleString()}
              </span>
              <span className="text-xs opacity-60 font-sans">SMS</span>
            </div>
            <span className="text-[10px] opacity-60">Weekly processed</span>
          </div>

          {/* Net Payable */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block">
              Net Amount (PKR)
            </span>
            <div className="flex items-baseline gap-1 mt-1 font-mono">
              <span className="text-xl font-black text-emerald-500">
                Rs. {(record.net_payable || record.calculated_total || 0).toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] opacity-60">
              Clearance: {record.clearance_date || 'Standard'}
            </span>
          </div>

          {/* Panel Used */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block">
              Panel Route
            </span>
            <span
              className={`inline-block mt-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                theme === 'light'
                  ? 'bg-white border-slate-200 text-slate-800'
                  : 'bg-slate-900 border-slate-800 text-slate-200'
              }`}
            >
              {record.panel_name_snapshot || 'SMS Panel'}
            </span>
            {record.notes && (
              <p className="text-[10px] opacity-60 mt-1 truncate max-w-[180px]" title={record.notes}>
                Note: {record.notes}
              </p>
            )}
          </div>

          {/* Payment Account */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block">
              Payout Snapshot
            </span>
            <span className="text-xs font-medium block mt-1 truncate max-w-[200px]" title={record.payment_details_snapshot || ''}>
              {record.payment_method_name_snapshot || 'Bank Transfer'}:{' '}
              {record.payment_details_snapshot || 'Default Account'}
            </span>
            <span className="text-[10px] opacity-60">
              {record.payment_date ? `Paid on ${record.payment_date}` : 'Awaiting payout'}
            </span>
          </div>
        </div>

        {/* Country Breakdown Pills & Action Bar */}
        <div className="pt-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Countries */}
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            <span className="text-[11px] font-semibold opacity-70 mr-1">Countries:</span>
            {record.countries && record.countries.length > 0 ? (
              record.countries.map((c, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs border font-mono ${
                    theme === 'light'
                      ? 'bg-white border-slate-200 text-slate-700'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <span>{c.flag_snapshot || '🌐'}</span>
                  <span className="font-semibold font-sans">{c.country_name_snapshot}</span>
                  <span className="opacity-70">({(c.sms_count || 0).toLocaleString()})</span>
                </span>
              ))
            ) : (
              <span className="text-xs opacity-50 italic">No country breakdown available</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSelectedRecordForSlip(record)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Open / Send WhatsApp Slip"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Generate Slip / WhatsApp</span>
            </button>

            <button
              onClick={() => setRecordToDeleteForPin(record)}
              className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border-slate-200'
                  : 'bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border-slate-800'
              }`}
              title="Delete Record (PIN 41200)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2
            className={`text-xl font-black flex items-center gap-2.5 ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}
          >
            <History className="w-6 h-6 text-emerald-500" />
            <span>Client Billing & History Reports</span>
          </h2>
          <p className={`text-xs mt-0.5 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
            Sequential client reports with clean weekly breakdown (Current Week, Previous Week, Older Weeks).
          </p>
        </div>

        {activeClient && (
          <button
            onClick={() => onAddRecordForClient(activeClient)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-950/30 flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Add Record for {activeClient.clientLabel}</span>
          </button>
        )}
      </div>

      {/* 1. CLEAN CLIENT SELECTOR BAR */}
      <div className={`${cardBg} rounded-2xl p-4 border`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">
              Select Client ({numberedClients.length} Registered)
            </span>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 opacity-50" />
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Search Client 1, Client 2, Name..."
              className={`w-full text-xs rounded-xl py-1.5 pl-8 pr-3 outline-none border transition-colors ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                  : 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500'
              }`}
            />
          </div>
        </div>

        {/* Clean Client Pill / Badge Selector List */}
        {loadingClients ? (
          <div className="py-6 text-center text-xs opacity-70">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500 mb-1" />
            <p>Loading client list...</p>
          </div>
        ) : filteredNumberedClients.length === 0 ? (
          <div className="py-6 text-center text-xs opacity-60">
            No clients match "{clientSearch}".
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {filteredNumberedClients.map((client) => {
              const isSelected = client.id === selectedClientId;
              return (
                <button
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/30 scale-[1.02]'
                      : theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                      : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  <span
                    className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-500/15 text-emerald-500'
                    }`}
                  >
                    {client.clientLabel}
                  </span>
                  <span>{client.client_name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. SELECTED CLIENT REPORT VIEW */}
      {activeClient ? (
        <div className="space-y-6">
          {/* Active Client Executive Profile Card */}
          <div className={`${cardBg} rounded-2xl p-5 border`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-inherit">
              {/* Left Profile Info */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center justify-center font-black text-base shrink-0">
                  {activeClient.clientNumber}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                      {activeClient.clientLabel}
                    </span>
                    <h3
                      className={`text-lg sm:text-xl font-bold ${
                        theme === 'light' ? 'text-slate-900' : 'text-white'
                      }`}
                    >
                      {activeClient.client_name}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs opacity-75 mt-1 font-mono">
                    <a
                      href={`https://wa.me/${activeClient.whatsapp_number.replace(/[^\d]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-500 hover:underline"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{activeClient.whatsapp_number}</span>
                    </a>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-sky-500" />
                      <span>
                        {activeClient.payment_method_name || 'Standard'}:{' '}
                        {activeClient.payment_details || 'Account details'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Action Buttons for this Client */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onAddRecordForClient(activeClient)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add Weekly Entry</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics of the Selected Client */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
              <div className={`${subCardBg} p-3.5 rounded-xl border text-center`}>
                <span className="text-[10px] font-bold uppercase opacity-60 block">
                  Total Weeks Billed
                </span>
                <span className="text-xl font-black font-mono mt-0.5 block">
                  {stats.totalWeeks}
                </span>
              </div>

              <div className={`${subCardBg} p-3.5 rounded-xl border text-center`}>
                <span className="text-[10px] font-bold uppercase opacity-60 block">
                  Cumulative SMS
                </span>
                <span className="text-xl font-black font-mono mt-0.5 block text-emerald-500">
                  {stats.totalSms.toLocaleString()}
                </span>
              </div>

              <div className={`${subCardBg} p-3.5 rounded-xl border text-center`}>
                <span className="text-[10px] font-bold uppercase opacity-60 block">
                  Total Billed (PKR)
                </span>
                <span className="text-xl font-black font-mono mt-0.5 block text-sky-500">
                  Rs. {stats.totalAmount.toLocaleString()}
                </span>
              </div>

              <div className={`${subCardBg} p-3.5 rounded-xl border text-center`}>
                <span className="text-[10px] font-bold uppercase opacity-60 block">
                  Pending Payout
                </span>
                <span
                  className={`text-xl font-black font-mono mt-0.5 block ${
                    stats.pendingAmount > 0 ? 'text-amber-500' : 'text-emerald-500'
                  }`}
                >
                  Rs. {stats.pendingAmount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* 3. WEEKLY REPORT SECTIONS */}
          <div className="space-y-4">
            {/* Filter / Search within this Client's records */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                <h4
                  className={`text-sm font-bold uppercase tracking-wider ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  Weekly Billing History for {activeClient.clientLabel}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 opacity-50" />
                  <input
                    type="text"
                    value={recordSearch}
                    onChange={(e) => setRecordSearch(e.target.value)}
                    placeholder="Search by date, notes..."
                    className={`text-xs rounded-xl py-1.5 pl-8 pr-3 outline-none border transition-colors w-40 sm:w-48 ${
                      theme === 'light'
                        ? 'bg-white border-slate-200 text-slate-900'
                        : 'bg-slate-900 border-slate-800 text-white'
                    }`}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`text-xs rounded-xl px-2.5 py-1.5 outline-none border cursor-pointer ${
                    theme === 'light'
                      ? 'bg-white border-slate-200 text-slate-800'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            {loadingRecords ? (
              <div className={`${cardBg} rounded-2xl p-12 text-center text-xs opacity-70 border`}>
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mb-2" />
                <p>Loading {activeClient.clientLabel}'s weekly records...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className={`${cardBg} rounded-2xl p-12 text-center border`}>
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <h4
                  className={`text-sm font-bold ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  No billing records found for {activeClient.clientLabel}
                </h4>
                <p className="text-xs opacity-60 mt-1 max-w-sm mx-auto">
                  {recordSearch
                    ? 'No records match your filter criteria.'
                    : `Click the button below to generate the first weekly SMS entry for ${activeClient.client_name}.`}
                </p>
                <button
                  onClick={() => onAddRecordForClient(activeClient)}
                  className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  + Add First Weekly Record
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* SECTION 1: CURRENT / NEW WEEK */}
                {categorizedRecords.currentWeek && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <h5
                        className={`text-xs font-black uppercase tracking-wider ${
                          theme === 'light' ? 'text-slate-800' : 'text-emerald-400'
                        }`}
                      >
                        Current / New Week
                      </h5>
                    </div>
                    {renderWeeklyCard(
                      categorizedRecords.currentWeek,
                      'Current / New Week',
                      'bg-emerald-500/20 text-emerald-500 border-emerald-500/40'
                    )}
                  </div>
                )}

                {/* SECTION 2: PREVIOUS WEEK */}
                {categorizedRecords.previousWeek && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-sky-500" />
                      <h5
                        className={`text-xs font-black uppercase tracking-wider ${
                          theme === 'light' ? 'text-slate-800' : 'text-sky-400'
                        }`}
                      >
                        Previous Week
                      </h5>
                    </div>
                    {renderWeeklyCard(
                      categorizedRecords.previousWeek,
                      'Previous Week',
                      'bg-sky-500/20 text-sky-500 border-sky-500/40'
                    )}
                  </div>
                )}

                {/* SECTION 3: OLDER WEEKS */}
                {categorizedRecords.olderWeeks.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      <h5
                        className={`text-xs font-black uppercase tracking-wider ${
                          theme === 'light' ? 'text-slate-800' : 'text-slate-400'
                        }`}
                      >
                        Older Weeks History ({categorizedRecords.olderWeeks.length})
                      </h5>
                    </div>

                    <div className="space-y-3">
                      {categorizedRecords.olderWeeks.map((record, index) =>
                        renderWeeklyCard(
                          record,
                          `Older Week #${record.id}`,
                          'bg-slate-500/15 text-slate-400 border-slate-500/30'
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={`${cardBg} rounded-2xl p-12 text-center border`}>
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <h4
            className={`text-sm font-bold ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}
          >
            No Clients Registered Yet
          </h4>
          <p className="text-xs opacity-60 mt-1">
            Register clients in the Clients section to view their weekly reports.
          </p>
        </div>
      )}

      {/* Slip Modal */}
      {selectedRecordForSlip && (
        <SlipModal
          record={selectedRecordForSlip}
          onClose={() => setSelectedRecordForSlip(null)}
          onStatusUpdated={() => {
            if (selectedClientId) loadClientHistory(selectedClientId);
            setSelectedRecordForSlip(null);
          }}
        />
      )}

      {/* PIN Protected Deletion Modal */}
      {recordToDeleteForPin && activeClient && (
        <DeleteRecordPinModal
          isOpen={!!recordToDeleteForPin}
          recordId={recordToDeleteForPin.id}
          recordTitle={`Record #${recordToDeleteForPin.id} (${recordToDeleteForPin.billing_period_start} to ${recordToDeleteForPin.billing_period_end})`}
          clientName={activeClient.client_name}
          onClose={() => setRecordToDeleteForPin(null)}
          onSuccess={() => {
            setRecordToDeleteForPin(null);
            if (selectedClientId) loadClientHistory(selectedClientId);
          }}
        />
      )}
    </div>
  );
};

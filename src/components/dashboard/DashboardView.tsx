import React, { useState, useEffect } from 'react';
import { DashboardStats, BillingRecord, Client } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { SlipModal } from '../slips/SlipModal';
import { DeleteRecordPinModal } from '../common/DeleteRecordPinModal';
import {
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle2,
  PlusCircle,
  MessageSquare,
  Sliders,
  FileText,
  Search,
  ExternalLink,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Send,
  Trash2,
} from 'lucide-react';
import { ActiveTab } from '../layout/Sidebar';

interface DashboardViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  onSelectClientForRecord?: (client: Client) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  setActiveTab,
}) => {
  const { showToast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRecords, setRecentRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedRecordForSlip, setSelectedRecordForSlip] = useState<BillingRecord | null>(null);
  const [recordToDeleteForPin, setRecordToDeleteForPin] = useState<BillingRecord | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, recordsData] = await Promise.all([
        api.getDashboardStats(),
        api.getBillingRecords({ search, status: statusFilter }),
      ]);
      setStats(statsData);
      setRecentRecords(recordsData);
    } catch (err: any) {
      showToast(err.message || 'Failed to load dashboard data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [search, statusFilter]);

  const handleUpdateStatus = async (record: BillingRecord, newStatus: string) => {
    try {
      await api.updateBillingRecordStatus(record.id, {
        payment_status: newStatus,
        payment_date: newStatus === 'Payment Completed' ? new Date().toISOString().split('T')[0] : null,
      });
      showToast(`Record #${record.id} status updated to ${newStatus}.`, 'success');
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update payment status.', 'error');
    }
  };

  const handleDeleteRecord = (record: BillingRecord) => {
    setRecordToDeleteForPin(record);
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>KB MAX Telemetry & Control Center</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              SMS Client, Panel & Billing Hub
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Real-time weekly billing calculations, automated WhatsApp slips, and multi-country routing records.
            </p>
          </div>

          {/* Quick Action CTAs */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="dash-btn-add-record"
              onClick={() => setActiveTab('add_record')}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/60 flex items-center gap-2 transition-all cursor-pointer min-h-[40px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Weekly Record</span>
            </button>

            <button
              onClick={() => setActiveTab('pending_records')}
              className="px-3.5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold rounded-xl border border-amber-500/40 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[40px]"
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Pending Records</span>
            </button>

            <button
              onClick={() => setActiveTab('clients')}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[40px]"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Clients</span>
            </button>

            <button
              onClick={() => setActiveTab('panel_rates')}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-sky-400" />
              <span>Rates</span>
            </button>

            <button
              onClick={() => setActiveTab('whatsapp')}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total SMS Volume */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total SMS Volume</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mt-3 font-mono">
            {(stats?.total_sms || 0).toLocaleString()} <span className="text-xs text-slate-400 font-sans">SMS</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Across all clients & panels</p>
        </div>

        {/* Total Revenue PKR */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Net Billed</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-sky-400 mt-3 font-mono">
            Rs. {(stats?.total_amount || 0).toLocaleString()}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">PKR grand total calculations</p>
        </div>

        {/* Pending Payments */}
        <div
          onClick={() => setActiveTab('pending_records')}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-amber-500/50 hover:bg-slate-850 transition-all cursor-pointer group"
          title="Click to view all Pending Records & WhatsApp Dispatch"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 group-hover:text-amber-300 transition-colors">
              Pending Payments
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-amber-400 mt-3 font-mono">
            Rs. {(stats?.pending_amount || 0).toLocaleString()}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>{stats?.pending_count ?? 0} records awaiting clearance</span>
            <ArrowUpRight className="w-3 h-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
        </div>

        {/* Total Registered Clients */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Clients</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-purple-300 mt-3 font-mono">
            {stats?.active_clients ?? 0} <span className="text-xs text-slate-400 font-sans">/ {stats?.total_clients ?? 0}</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Total registered payout profiles</p>
        </div>
      </div>

      {/* Recent Records Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Table Header Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Weekly SMS Records & Slips</span>
            </h3>
            <p className="text-xs text-slate-400">
              Live database records with one-click WhatsApp dispatch & status tracking
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search records..."
                className="bg-slate-950 border border-slate-800 text-xs text-white rounded-xl py-1.5 pl-8 pr-3 outline-none focus:border-emerald-500 placeholder-slate-500 w-44"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-1.5 outline-none cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Payment Sent">Payment Sent</option>
              <option value="Payment Completed">Payment Completed</option>
            </select>
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mb-3" />
            <p className="text-xs">Loading billing records...</p>
          </div>
        ) : recentRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <h4 className="text-sm font-semibold text-white">No records found</h4>
            <p className="text-xs text-slate-500 mt-1">
              Click "+ Add Weekly Record" to create your first billing entry.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Client Name & ID</th>
                  <th className="py-3.5 px-4">Billing Week</th>
                  <th className="py-3.5 px-4">Panel & Countries</th>
                  <th className="py-3.5 px-4">Total SMS</th>
                  <th className="py-3.5 px-4">Net Payable (PKR)</th>
                  <th className="py-3.5 px-4">Payment Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {recentRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Client Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs">
                          {rec.client_name_snapshot?.substring(0, 2).toUpperCase() || 'CL'}
                        </div>
                        <div>
                          <span className="font-semibold text-white block">
                            {rec.client_name_snapshot}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Record #{rec.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Billing Week */}
                    <td className="py-3.5 px-4 font-mono">
                      <span className="text-slate-200 block">{rec.billing_period_start}</span>
                      <span className="text-[10px] text-slate-500">➔ {rec.billing_period_end}</span>
                    </td>

                    {/* Panel & Countries Breakdown */}
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-medium border border-slate-700 block w-fit mb-1">
                        {rec.panel_name_snapshot || 'SMS Panel'}
                      </span>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {rec.countries?.map((c, i) => (
                          <span key={i} className="text-[10px] text-slate-400 bg-slate-950 px-1.5 py-0.2 rounded border border-slate-800">
                            {c.country_flag} {c.country_name} ({(c.sms_count || 0).toLocaleString()})
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Total SMS */}
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      <span className="font-semibold">{(rec.total_sms_count || 0).toLocaleString()}</span>
                      <span className="text-[10px] text-slate-500 block">SMS processed</span>
                    </td>

                    {/* Net Payable */}
                    <td className="py-3.5 px-4 font-mono">
                      <strong className="text-emerald-400 text-sm">
                        Rs. {(rec.net_payable || 0).toLocaleString()}
                      </strong>
                      <span className="text-[10px] text-slate-500 block">Grand Total</span>
                    </td>

                    {/* Status Dropdown */}
                    <td className="py-3.5 px-4">
                      <select
                        value={rec.payment_status}
                        onChange={(e) => handleUpdateStatus(rec, e.target.value)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-full border outline-none cursor-pointer ${
                          rec.payment_status === 'Payment Completed'
                            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                            : rec.payment_status === 'Payment Sent'
                            ? 'bg-blue-950/80 border-blue-500/40 text-blue-300'
                            : 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Payment Sent">Payment Sent</option>
                        <option value="Payment Completed">Payment Completed</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedRecordForSlip(rec)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                          title="Generate / Dispatch Slip"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Slip</span>
                        </button>

                        <button
                          onClick={() => handleDeleteRecord(rec)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors cursor-pointer"
                          title="Delete Record (PIN 41200)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PIN-Protected Deletion Modal */}
      {recordToDeleteForPin && (
        <DeleteRecordPinModal
          isOpen={!!recordToDeleteForPin}
          recordId={recordToDeleteForPin.id}
          recordTitle={`Record #${recordToDeleteForPin.id} (${recordToDeleteForPin.billing_period_start} to ${recordToDeleteForPin.billing_period_end})`}
          clientName={recordToDeleteForPin.client_name_snapshot}
          onClose={() => setRecordToDeleteForPin(null)}
          onSuccess={() => {
            setRecordToDeleteForPin(null);
            fetchDashboardData();
          }}
        />
      )}

      {/* Slip Modal View */}
      {selectedRecordForSlip && (
        <SlipModal
          record={selectedRecordForSlip}
          onClose={() => setSelectedRecordForSlip(null)}
          onStatusUpdated={() => {
            fetchDashboardData();
            setSelectedRecordForSlip(null);
          }}
        />
      )}
    </div>
  );
};

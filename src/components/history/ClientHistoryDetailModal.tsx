import React, { useState, useEffect } from 'react';
import { Client, BillingRecord } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { SlipModal } from '../slips/SlipModal';
import { DeleteRecordPinModal } from '../common/DeleteRecordPinModal';
import {
  X,
  History,
  Calendar,
  DollarSign,
  FileText,
  Send,
  CheckCircle2,
  Trash2,
  Phone,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react';

interface ClientHistoryDetailModalProps {
  client: Client;
  onClose: () => void;
}

export const ClientHistoryDetailModal: React.FC<ClientHistoryDetailModalProps> = ({
  client,
  onClose,
}) => {
  const { showToast } = useToast();
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecordForSlip, setSelectedRecordForSlip] = useState<BillingRecord | null>(null);
  const [recordToDeleteForPin, setRecordToDeleteForPin] = useState<BillingRecord | null>(null);
  const [search, setSearch] = useState('');

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getClientHistory(client.id);
      setRecords(data.records);
    } catch (err: any) {
      showToast(err.message || 'Failed to load client billing history.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [client.id]);

  const handleUpdateStatus = async (record: BillingRecord, newStatus: string) => {
    try {
      await api.updateBillingRecordStatus(record.id, {
        payment_status: newStatus,
        payment_date: newStatus === 'Payment Completed' ? new Date().toISOString().split('T')[0] : null,
      });
      showToast(`Record #${record.id} status updated to ${newStatus}.`, 'success');
      loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Failed to update record status.', 'error');
    }
  };

  const handleDeleteRecord = (rec: BillingRecord) => {
    setRecordToDeleteForPin(rec);
  };

  // Cumulative calculations
  const totalWeeks = records.length;
  const totalSms = records.reduce((s, r) => s + (r.total_sms || (r as any).total_sms_count || 0), 0);
  const totalAmount = records.reduce((s, r) => s + (r.net_payable || (r as any).calculated_total || 0), 0);
  const pendingAmount = records
    .filter((r) => r.payment_status !== 'Payment Completed')
    .reduce((s, r) => s + (r.net_payable || (r as any).calculated_total || 0), 0);

  const filteredRecords = records.filter(
    (r) =>
      r.billing_period_start.includes(search) ||
      r.billing_period_end.includes(search) ||
      (r.panel_name_snapshot || '').toLowerCase().includes(search.toLowerCase()) ||
      r.payment_status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{client.client_name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  ID: #{client.id}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Registered on {client.registration_date} • WhatsApp: {client.whatsapp_number}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metrics Banner */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Weeks</span>
            <span className="text-lg font-bold text-white font-mono">{totalWeeks}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total SMS</span>
            <span className="text-lg font-bold text-white font-mono">{(totalSms || 0).toLocaleString()}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Billed</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">Rs. {(totalAmount || 0).toLocaleString()}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pending Payout</span>
            <span className="text-lg font-bold text-amber-400 font-mono">Rs. {(pendingAmount || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by week, panel, status..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white outline-none focus:border-emerald-500"
            />
          </div>
          <span className="text-xs text-slate-400">{filteredRecords.length} records</span>
        </div>

        {/* Records Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mb-2" />
              <p className="text-xs">Loading billing archives...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
              <FileText className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="text-xs font-semibold text-slate-300">No records found for this client</p>
              <p className="text-[11px] text-slate-500 mt-1">Create a weekly SMS record to start billing history.</p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Week / Dates</th>
                    <th className="py-3 px-3">Panel</th>
                    <th className="py-3 px-3">Country Breakdown</th>
                    <th className="py-3 px-3">Total SMS & PKR</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-900">
                  {filteredRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Week & Dates */}
                      <td className="py-3 px-3">
                        <span className="font-semibold text-white block">
                          #{rec.id} • {rec.billing_period_start}
                        </span>
                        <span className="text-[10px] text-slate-400">➔ {rec.billing_period_end}</span>
                      </td>

                      {/* Panel */}
                      <td className="py-3 px-3 text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-medium border border-slate-700">
                          {rec.panel_name_snapshot || 'Standard Panel'}
                        </span>
                      </td>

                      {/* Country breakdown pills */}
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {rec.countries && rec.countries.length > 0 ? (
                            rec.countries.map((c, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px]"
                              >
                                <span>{c.country_flag || '🌐'}</span>
                                <span className="font-medium text-slate-200">{c.country_name}</span>
                                <span className="text-slate-400 font-mono">({(c.sms_count || 0).toLocaleString()})</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 italic">No breakdown</span>
                          )}
                        </div>
                      </td>

                      {/* Total SMS & Net Payable */}
                      <td className="py-3 px-3 font-mono">
                        <span className="text-slate-300 block">
                          {(rec.total_sms_count || 0).toLocaleString()} SMS
                        </span>
                        <strong className="text-emerald-400">
                          Rs. {(rec.net_payable || 0).toLocaleString()}
                        </strong>
                      </td>

                      {/* Status Selector */}
                      <td className="py-3 px-3">
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
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedRecordForSlip(rec)}
                            className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                            title="View Slip / WhatsApp"
                          >
                            <FileText className="w-3.5 h-3.5" />
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

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* PIN Protected Deletion Modal */}
      {recordToDeleteForPin && (
        <DeleteRecordPinModal
          isOpen={!!recordToDeleteForPin}
          recordId={recordToDeleteForPin.id}
          recordTitle={`Record #${recordToDeleteForPin.id} (${recordToDeleteForPin.billing_period_start} to ${recordToDeleteForPin.billing_period_end})`}
          clientName={client.client_name}
          onClose={() => setRecordToDeleteForPin(null)}
          onSuccess={() => {
            setRecordToDeleteForPin(null);
            loadHistory();
          }}
        />
      )}

      {/* Slip Viewer Modal */}
      {selectedRecordForSlip && (
        <SlipModal
          record={selectedRecordForSlip}
          onClose={() => setSelectedRecordForSlip(null)}
          onStatusUpdated={() => {
            loadHistory();
            setSelectedRecordForSlip(null);
          }}
        />
      )}
    </div>
  );
};

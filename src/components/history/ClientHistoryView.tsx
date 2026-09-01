import React, { useState, useEffect } from 'react';
import { Client } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { ClientHistoryDetailModal } from './ClientHistoryDetailModal';
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
} from 'lucide-react';

interface ClientHistoryViewProps {
  onAddRecordForClient: (client: Client) => void;
}

export const ClientHistoryView: React.FC<ClientHistoryViewProps> = ({
  onAddRecordForClient,
}) => {
  const { showToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClientForDetail, setSelectedClientForDetail] = useState<Client | null>(null);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await api.getClients({ search });
      const sortedClients = [...data].sort((a, b) =>
        a.client_name.localeCompare(b.client_name, undefined, { sensitivity: 'base' })
      );
      setClients(sortedClients);
    } catch (err: any) {
      showToast(err.message || 'Failed to load client history directory.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [search]);

  // Overall totals across all clients
  const totalSMSAll = clients.reduce((s, c) => s + (c.total_sms || 0), 0);
  const totalAmountAll = clients.reduce((s, c) => s + (c.total_amount || 0), 0);
  const totalWeeksAll = clients.reduce((s, c) => s + (c.total_weeks || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <History className="w-6 h-6 text-emerald-400" />
            <span>Client History & Billing Archive</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Browse full chronological records, country breakdowns, and payment audit slips per client
          </p>
        </div>
      </div>

      {/* Aggregate Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Total Billed Weeks</p>
            <h3 className="text-2xl font-bold text-white mt-1">{totalWeeksAll}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Cumulative SMS Volume</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{(totalSMSAll || 0).toLocaleString()}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Cumulative Net Revenue</p>
            <h3 className="text-2xl font-bold text-sky-400 mt-1">Rs. {(totalAmountAll || 0).toLocaleString()}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            id="history-search-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client by name, WhatsApp, or ID..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 outline-none"
          />
        </div>
      </div>

      {/* Client List Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mb-3" />
          <p className="text-xs">Loading client history summaries...</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-white">No clients found</h4>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((client) => (
            <div
              key={client.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-sm group"
            >
              {/* Top Row: Client Info */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-sm">
                      {client.client_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {client.client_name}
                      </h3>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Client ID: #{client.id} • Registered {client.registration_date}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      client.status === 'Active'
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {client.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-400 mb-4">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-slate-300">{client.whatsapp_number}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-sky-400" />
                    <span className="truncate text-slate-300">
                      {client.payment_details || client.payment_method_name || 'Standard Account'}
                    </span>
                  </div>
                </div>

                {/* Metrics Pill Box */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Weeks</span>
                    <span className="text-xs font-bold text-white font-mono">{client.total_weeks || 0}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Total SMS</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      {(client.total_sms || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Total PKR</span>
                    <span className="text-xs font-bold text-sky-400 font-mono">
                      Rs. {(client.total_amount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  id={`btn-view-client-history-${client.id}`}
                  onClick={() => setSelectedClientForDetail(client)}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 border border-emerald-500/30 transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Full History ({client.total_weeks || 0})</span>
                </button>

                <button
                  onClick={() => onAddRecordForClient(client)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                  title="Add Weekly SMS Record for this Client"
                >
                  <PlusCircle className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedClientForDetail && (
        <ClientHistoryDetailModal
          client={selectedClientForDetail}
          onClose={() => {
            setSelectedClientForDetail(null);
            fetchClients();
          }}
        />
      )}
    </div>
  );
};

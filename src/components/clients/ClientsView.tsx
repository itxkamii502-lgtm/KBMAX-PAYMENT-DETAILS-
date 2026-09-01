import React, { useState, useEffect } from 'react';
import { Client, PaymentMethod } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { ClientModal } from './ClientModal';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  CreditCard,
  History,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  Calendar,
} from 'lucide-react';

interface ClientsViewProps {
  onViewHistory: (client: Client) => void;
  onAddRecordForClient?: (client: Client) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  onViewHistory,
  onAddRecordForClient,
}) => {
  const { showToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteClientTarget, setDeleteClientTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [clientsData, methodsData] = await Promise.all([
        api.getClients({ search, status: statusFilter }),
        api.getPaymentMethods(),
      ]);
      const sortedClients = [...clientsData].sort((a, b) =>
        a.client_name.localeCompare(b.client_name, undefined, { sensitivity: 'base' })
      );
      setClients(sortedClients);
      setPaymentMethods(methodsData);
    } catch (err: any) {
      showToast(err.message || 'Failed to load clients.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [search, statusFilter]);

  const handleToggleStatus = async (client: Client) => {
    const newStatus = client.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const updated = await api.updateClient(client.id, { status: newStatus });
      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, status: newStatus } : c)));
      showToast(`Client ${client.client_name} marked as ${newStatus}.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update status.', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteClientTarget) return;
    setDeleting(true);
    try {
      await api.deleteClient(deleteClientTarget.id);
      setClients((prev) => prev.filter((c) => c.id !== deleteClientTarget.id));
      showToast(`Client ${deleteClientTarget.client_name} deleted.`, 'success');
      setDeleteClientTarget(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete client.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaved = (savedClient: Client) => {
    fetchInitialData();
  };

  const activeCount = clients.filter((c) => c.status === 'Active').length;
  const inactiveCount = clients.filter((c) => c.status === 'Inactive').length;

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-emerald-400" />
            <span>Client Registry</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage SMS client profiles, payout accounts, and WhatsApp contact details
          </p>
        </div>

        <button
          id="btn-add-new-client"
          onClick={() => {
            setEditingClient(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Client</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Total Clients</p>
            <h3 className="text-2xl font-bold text-white mt-1">{clients.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Active Clients</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{activeCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Inactive / Paused</p>
            <h3 className="text-2xl font-bold text-slate-400 mt-1">{inactiveCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-500 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            id="client-search-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client name, WhatsApp, or ID..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            id="client-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2.5 outline-none cursor-pointer w-full sm:w-auto"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Client Table / Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mb-3" />
          <p className="text-xs">Loading registered clients...</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-white">No clients found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search ? 'Try adjusting your search criteria.' : 'Click "+ Add New Client" to register your first SMS client.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Client ID & Name</th>
                  <th className="py-3.5 px-4">WhatsApp Contact</th>
                  <th className="py-3.5 px-4">Payment Method & Account</th>
                  <th className="py-3.5 px-4">Billing History</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {clients.map((client) => {
                  const cleanWA = client.whatsapp_number.replace(/[^\d]/g, '');
                  return (
                    <tr key={client.id} className="hover:bg-slate-800/40 transition-colors group">
                      {/* Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                            {client.client_name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-white text-sm block">
                              {client.client_name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ID: #{client.id} • Registered {client.registration_date}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* WhatsApp */}
                      <td className="py-3.5 px-4">
                        <a
                          href={`https://wa.me/${cleanWA}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40 transition-colors font-mono"
                          title="Open WhatsApp Chat"
                        >
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span>{client.whatsapp_number}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-emerald-500" />
                        </a>
                      </td>

                      {/* Payment Account */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-1.5 mb-1">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-200">
                            {client.payment_method_name || 'Direct'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate" title={client.payment_details}>
                          {client.payment_details || 'N/A'}
                        </p>
                      </td>

                      {/* History Summary */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col text-[11px]">
                          <span className="font-semibold text-slate-200">
                            {client.total_weeks || 0} Weeks Billed
                          </span>
                          <span className="text-slate-400">
                            {(client.total_sms || 0).toLocaleString()} SMS • Rs. {(client.total_amount || 0).toLocaleString()}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleStatus(client)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                            client.status === 'Active'
                              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                          }`}
                          title="Click to toggle status"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              client.status === 'Active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                            }`}
                          />
                          <span>{client.status}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onViewHistory(client)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950/60 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/30 transition-colors cursor-pointer"
                            title="View Client History"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setEditingClient(client);
                              setModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                            title="Edit Client"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setDeleteClientTarget(client)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 transition-colors cursor-pointer"
                            title="Delete Client"
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
        </div>
      )}

      {/* Add / Edit Client Modal */}
      {modalOpen && (
        <ClientModal
          client={editingClient}
          paymentMethods={paymentMethods}
          onClose={() => {
            setModalOpen(false);
            setEditingClient(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {/* Delete Client Confirmation Modal */}
      {deleteClientTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Client Profile?</h3>
                <p className="text-xs text-slate-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6 bg-slate-950 p-3 rounded-xl border border-slate-800">
              Are you sure you want to delete <strong className="text-white">{deleteClientTarget.client_name}</strong> (ID: #{deleteClientTarget.id})? All linked billing history will also be permanently deleted.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteClientTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-client"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/50 flex items-center gap-2 cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Panel } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PanelRatesModal } from './PanelRatesModal';
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Globe,
  PlusCircle,
  X,
  AlertTriangle,
  Layers,
} from 'lucide-react';

export const PanelsView: React.FC = () => {
  const { showToast } = useToast();
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [addPanelModalOpen, setAddPanelModalOpen] = useState(false);
  const [panelNameInput, setPanelNameInput] = useState('');
  const [editingPanel, setEditingPanel] = useState<Panel | null>(null);
  const [activeRatesPanel, setActiveRatesPanel] = useState<Panel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Panel | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchPanels = async () => {
    setLoading(true);
    try {
      const data = await api.getPanels();
      setPanels(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load panels.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPanels();
  }, []);

  const handleSavePanel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!panelNameInput.trim()) {
      showToast('Panel name is required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (editingPanel) {
        await api.updatePanel(editingPanel.id, { name: panelNameInput.trim() });
        showToast('Panel name updated!', 'success');
      } else {
        await api.createPanel({ name: panelNameInput.trim(), status: 'Active' });
        showToast('New SMS panel added!', 'success');
      }
      setAddPanelModalOpen(false);
      setEditingPanel(null);
      setPanelNameInput('');
      fetchPanels();
    } catch (err: any) {
      showToast(err.message || 'Failed to save panel.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (panel: Panel) => {
    const newStatus = panel.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.updatePanel(panel.id, { status: newStatus });
      setPanels((prev) =>
        prev.map((p) => (p.id === panel.id ? { ...p, status: newStatus } : p))
      );
      showToast(`Panel status changed to ${newStatus}.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update panel status.', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.deletePanel(deleteTarget.id);
      setPanels((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      showToast(`Panel "${deleteTarget.name}" deleted.`, 'success');
      setDeleteTarget(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete panel.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-emerald-400" />
            <span>SMS Panels & Rate Configurations</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Create routing panels and define fixed country-wise SMS rates for automatic billing
          </p>
        </div>

        <button
          id="btn-add-panel"
          onClick={() => {
            setEditingPanel(null);
            setPanelNameInput('');
            setAddPanelModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Panel</span>
        </button>
      </div>

      {/* Panels Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mb-3" />
          <p className="text-xs">Loading SMS panels...</p>
        </div>
      ) : panels.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-white">No panels configured</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Click "+ Add Panel" to create your first SMS panel (e.g. KB MAX - LAMIX SMS PANEL).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {panels.map((panel) => (
            <div
              key={panel.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm group"
            >
              {/* Card Top */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {panel.name}
                      </h3>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Panel ID: #{panel.id} • Created {panel.created_at?.split(' ')[0]}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(panel)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                      panel.status === 'Active'
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {panel.status}
                  </button>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-slate-300">Configured Country Rates:</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30">
                    {panel.country_rates_count || 0} Countries
                  </span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-5 mt-5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  id={`btn-manage-rates-${panel.id}`}
                  onClick={() => setActiveRatesPanel(panel)}
                  className="flex-1 px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Manage Country Rates</span>
                </button>

                <button
                  onClick={() => {
                    setEditingPanel(panel);
                    setPanelNameInput(panel.name);
                    setAddPanelModalOpen(true);
                  }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                  title="Rename Panel"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setDeleteTarget(panel)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 transition-colors cursor-pointer"
                  title="Delete Panel"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Panel Modal */}
      {addPanelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <span>{editingPanel ? 'Edit Panel Name' : 'Create New SMS Panel'}</span>
              </h3>
              <button
                onClick={() => setAddPanelModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePanel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Panel Name <span className="text-rose-400">*</span>
                </label>
                <input
                  id="panel-name-input"
                  type="text"
                  value={panelNameInput}
                  onChange={(e) => setPanelNameInput(e.target.value)}
                  placeholder="e.g. KB MAX - LAMIX SMS PANEL"
                  required
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddPanelModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-panel-submit"
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/50 flex items-center gap-2"
                >
                  {submitting ? 'Saving...' : editingPanel ? 'Update Panel' : 'Save Panel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Country Rates Modal for Selected Panel */}
      {activeRatesPanel && (
        <PanelRatesModal
          panel={activeRatesPanel}
          onClose={() => setActiveRatesPanel(null)}
          onRatesUpdated={fetchPanels}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Panel?</h3>
                <p className="text-xs text-slate-400">All country rate mappings will be deleted</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6 bg-slate-950 p-3 rounded-xl border border-slate-800">
              Are you sure you want to delete <strong className="text-white">{deleteTarget.name}</strong>? Existing historical billing records will retain their rate snapshots.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/50"
              >
                Yes, Delete Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

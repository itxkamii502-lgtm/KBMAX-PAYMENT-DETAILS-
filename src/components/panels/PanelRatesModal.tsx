import React, { useState, useEffect } from 'react';
import { Panel, PanelCountryRate, Country } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import {
  X,
  Sliders,
  Plus,
  Trash2,
  Edit2,
  Check,
  Search,
  Globe,
  DollarSign,
  AlertCircle,
} from 'lucide-react';

interface PanelRatesModalProps {
  panel: Panel;
  onClose: () => void;
  onRatesUpdated: () => void;
}

export const PanelRatesModal: React.FC<PanelRatesModalProps> = ({
  panel,
  onClose,
  onRatesUpdated,
}) => {
  const { showToast } = useToast();
  const [rates, setRates] = useState<PanelCountryRate[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add country rate form state
  const [selectedCountryId, setSelectedCountryId] = useState<number | ''>('');
  const [rateInput, setRateInput] = useState<string>('');
  const [addingRate, setAddingRate] = useState(false);

  // Inline editing rate state
  const [editingRateId, setEditingRateId] = useState<number | null>(null);
  const [editRateValue, setEditRateValue] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [ratesData, countriesData] = await Promise.all([
        api.getPanelRates(panel.id),
        api.getCountries(),
      ]);
      setRates(ratesData);
      setCountries(countriesData);

      // Default selected country to first unassigned country if available
      const assignedIds = new Set(ratesData.map((r) => r.country_id));
      const firstAvailable = countriesData.find((c) => !assignedIds.has(c.id));
      if (firstAvailable) {
        setSelectedCountryId(firstAvailable.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load panel rates.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [panel.id]);

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCountryId || !rateInput) {
      showToast('Please select a country and enter a valid SMS rate.', 'error');
      return;
    }

    const numRate不易 = parseFloat(rateInput);
    if (isNaN(numRate不易) || numRate不易 <= 0) {
      showToast('SMS rate must be a positive number.', 'error');
      return;
    }

    setAddingRate(true);
    try {
      await api.createPanelRate(panel.id, {
        country_id: Number(selectedCountryId),
        rate: numRate不易,
        status: 'Active',
      });

      showToast('Country SMS rate added successfully!', 'success');
      setRateInput('');
      loadData();
      onRatesUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to add country rate.', 'error');
    } finally {
      setAddingRate(false);
    }
  };

  const handleUpdateRate = async (rateId: number) => {
    const numRate = parseFloat(editRateValue);
    if (isNaN(numRate) || numRate <= 0) {
      showToast('SMS rate must be a positive number.', 'error');
      return;
    }

    try {
      await api.updatePanelRate(panel.id, rateId, { rate: numRate });
      showToast('Rate updated!', 'success');
      setEditingRateId(null);
      loadData();
      onRatesUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to update rate.', 'error');
    }
  };

  const handleToggleRateStatus迷 = async (rate: PanelCountryRate) => {
    const newStatus = rate.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.updatePanelRate(panel.id, rate.id, { status: newStatus });
      setRates((prev) =>
        prev.map((r) => (r.id === rate.id ? { ...r, status: newStatus } : r))
      );
      showToast(`Rate status changed to ${newStatus}.`, 'success');
      onRatesUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle status.', 'error');
    }
  };

  const handleDeleteRate = async (rateId: number) => {
    try {
      await api.deletePanelRate(panel.id, rateId);
      setRates((prev) => prev.filter((r) => r.id !== rateId));
      showToast('Country rate removed from this panel.', 'success');
      onRatesUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove rate.', 'error');
    }
  };

  const filteredRates = rates.filter((r) =>
    (r.country_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.iso_code || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Manage Country Rates</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                  {panel.name}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Define fixed SMS rates for countries associated with this specific panel
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add New Rate Form Banner */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 space-y-3">
          {/* Quick Helper for Other all country if not yet configured */}
          {(() => {
            const otherCountry = countries.find(
              (c) => c.iso_code === 'OTHER' || c.name.toLowerCase() === 'other all country'
            );
            const isOtherConfigured = otherCountry && rates.some((r) => r.country_id === otherCountry.id);
            if (otherCountry && !isOtherConfigured) {
              return (
                <div className="flex items-center justify-between bg-emerald-950/30 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <span className="text-sm">🌐</span>
                    <span className="font-semibold">Baqi Tamam Mumalik ka Rate:</span>
                    <span className="text-slate-300">"Other all country" select kr k baqi tamam countries ka aik hi rate fix kr skte hain.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCountryId(otherCountry.id);
                      const rateInputEl = document.getElementById('panel-rate-amount-input');
                      if (rateInputEl) rateInputEl.focus();
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] transition shrink-0 cursor-pointer shadow"
                  >
                    Select "Other all country"
                  </button>
                </div>
              );
            }
            return null;
          })()}

          <form onSubmit={handleAddRate} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Country Picker */}
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Select Country ({countries.filter((c) => !rates.some((r) => r.country_id === c.id)).length} Available)
              </label>
              <select
                id="panel-rate-country-select"
                value={selectedCountryId}
                onChange={(e) => setSelectedCountryId(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 outline-none focus:border-emerald-500 cursor-pointer"
                required
              >
                <option value="" disabled>-- Select Country (Dunya ki Har Country / Other all country) --</option>
                {countries
                  .filter((c) => !rates.some((r) => r.country_id === c.id))
                  .map((c) => {
                    const isOther = c.iso_code === 'OTHER' || c.name.toLowerCase() === 'other all country';
                    return (
                      <option key={c.id} value={c.id} className={isOther ? 'font-bold text-emerald-400' : ''}>
                        {isOther ? '🌐 Other all country (Baqi Tamam Mumalik ka Rate)' : `${c.flag || '🌐'} ${c.name} (${c.iso_code})`}
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* Rate Input */}
            <div className="w-full sm:w-44">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Fixed Rate (Rs. / SMS)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-slate-500 font-semibold">Rs.</span>
                <input
                  id="panel-rate-amount-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  placeholder="4.00"
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl py-2 pl-9 pr-3 outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>
            </div>

            {/* Add Button */}
            <div className="sm:self-end">
              <button
                id="btn-add-panel-country-rate"
                type="submit"
                disabled={addingRate}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-950/50 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{addingRate ? 'Adding...' : 'Add / Set Rate'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Search Bar for Configured Rates */}
        <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-slate-900/50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search configured countries by name or ISO..."
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl py-2 pl-9 pr-3 outline-none focus:border-emerald-500 placeholder-slate-500"
            />
          </div>

          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
            {filteredRates.length} configured rates
          </span>
        </div>

        {/* Rates Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mb-2" />
              <p className="text-xs">Loading panel rates...</p>
            </div>
          ) : filteredRates.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
              <Globe className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-xs font-semibold text-slate-300">No country rates found</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {search ? 'No matches for search.' : 'Use the form above to add your first country SMS rate.'}
              </p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Country & Flag</th>
                    <th className="py-3 px-4">ISO & Code</th>
                    <th className="py-3 px-4">Fixed SMS Rate</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-900">
                  {filteredRates.map((rate) => {
                    const isEditing = editingRateId === rate.id;
                    return (
                      <tr key={rate.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="text-lg leading-none">{rate.flag || '🌐'}</span>
                            <div>
                              <div className="font-semibold text-white flex items-center gap-1.5">
                                <span>{rate.country_name}</span>
                                {(rate.iso_code === 'OTHER' || rate.country_name.toLowerCase().includes('other all country')) && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-[9px] font-bold text-emerald-300">
                                    Baqi Mumalik Default
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] text-slate-300 font-bold mr-1.5">
                            {rate.iso_code}
                          </span>
                          <span>{rate.phone_code}</span>
                        </td>

                        <td className="py-3 px-4">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 max-w-[140px]">
                              <span className="text-xs text-slate-400">Rs.</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={editRateValue}
                                onChange={(e) => setEditRateValue(e.target.value)}
                                className="w-full bg-slate-950 border border-emerald-500 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() => handleUpdateRate(rate.id)}
                                className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                                title="Save Rate"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingRateId(null)}
                                className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                              Rs. {rate.rate.toFixed(2)} / SMS
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggleRateStatus迷(rate)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer ${
                              rate.status === 'Active'
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            {rate.status}
                          </button>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isEditing && (
                              <button
                                onClick={() => {
                                  setEditingRateId(rate.id);
                                  setEditRateValue(String(rate.rate));
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                                title="Edit Rate"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteRate(rate.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 transition-colors"
                              title="Delete Rate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

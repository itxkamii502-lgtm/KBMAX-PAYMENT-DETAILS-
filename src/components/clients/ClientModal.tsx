import React, { useState, useEffect } from 'react';
import { Client, PaymentMethod } from '../../types';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { X, User, Phone, CreditCard, Calendar, Info, ShieldAlert } from 'lucide-react';

interface ClientModalProps {
  client: Client | null;
  onClose: () => void;
  onSaved: (client: Client) => void;
  paymentMethods: PaymentMethod[];
}

export const ClientModal: React.FC<ClientModalProps> = ({
  client,
  onClose,
  onSaved,
  paymentMethods,
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [clientName, setClientName] = useState(client?.client_name || '');
  const [registrationDate, setRegistrationDate] = useState(
    client?.registration_date || new Date().toISOString().split('T')[0]
  );
  const [paymentMethodId, setPaymentMethodId] = useState<number>(
    client?.payment_method_id || (paymentMethods[0]?.id ?? 1)
  );
  const [paymentDetails, setPaymentDetails] = useState(client?.payment_details || '');
  const [whatsappNumber, setWhatsappNumber] = useState(client?.whatsapp_number || '');
  const [additionalInfo, setAdditionalInfo] = useState(client?.additional_info || '');
  const [status, setStatus] = useState<'Active' | 'Inactive'>(client?.status || 'Active');

  useEffect(() => {
    if (client) {
      setClientName(client.client_name);
      setRegistrationDate(client.registration_date);
      setPaymentMethodId(client.payment_method_id);
      setPaymentDetails(client.payment_details);
      setWhatsappNumber(client.whatsapp_number);
      setAdditionalInfo(client.additional_info || '');
      setStatus(client.status);
    }
  }, [client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setError('Client name is required.');
      return;
    }
    if (!whatsappNumber.trim()) {
      setError('WhatsApp number is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (client) {
        // Edit
        const updated = await api.updateClient(client.id, {
          client_name: clientName.trim(),
          registration_date: registrationDate,
          payment_method_id: Number(paymentMethodId),
          payment_details: paymentDetails.trim(),
          whatsapp_number: whatsappNumber.trim(),
          additional_info: additionalInfo.trim(),
          status,
        });
        showToast('Client updated successfully!', 'success');
        onSaved(updated);
      } else {
        // Create
        const created = await api.createClient({
          client_name: clientName.trim(),
          registration_date: registrationDate,
          payment_method_id: Number(paymentMethodId),
          payment_details: paymentDetails.trim(),
          whatsapp_number: whatsappNumber.trim(),
          additional_info: additionalInfo.trim(),
          status,
        });
        showToast('Client created successfully!', 'success');
        onSaved(created);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save client profile.');
      showToast(err.message || 'Failed to save client.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {client ? 'Edit Client Profile' : 'Register New Client'}
              </h2>
              <p className="text-xs text-slate-400">
                {client ? `Client ID: #${client.id}` : 'Fill in client contact & payout account details'}
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

        {/* Error notice */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-950/60 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Client Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Client Name <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                id="client-name-input"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Aatskamii / Muhammad Ali"
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>
          </div>

          {/* Registration Date */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Registration Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                id="client-registration-date-input"
                type="date"
                value={registrationDate}
                onChange={(e) => setRegistrationDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white outline-none"
              />
            </div>
          </div>

          {/* WhatsApp Number */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              WhatsApp Number <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                id="client-whatsapp-input"
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="923001234567 or +923001234567"
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Used automatically for WhatsApp slip dispatches (country code included).
            </p>
          </div>

          {/* Payment Method & Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Payment Method
              </label>
              <select
                id="client-payment-method-select"
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-2.5 px-3 text-sm text-white outline-none cursor-pointer"
              >
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Client Status
              </label>
              <select
                id="client-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-2.5 px-3 text-sm text-white outline-none cursor-pointer"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Payment Account / Details
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                id="client-payment-details-input"
                type="text"
                value={paymentDetails}
                onChange={(e) => setPaymentDetails(e.target.value)}
                placeholder="e.g. JazzCash: 80049388 (Title: Kamik)"
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Included on professional and simple billing slips automatically.
            </p>
          </div>

          {/* Additional Information */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Additional Notes / Remarks
            </label>
            <textarea
              id="client-additional-info-input"
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              rows={2}
              placeholder="VIP Client, specific billing instructions, routing notes..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-sm text-white placeholder-slate-500 outline-none resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="client-modal-submit-btn"
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Saving...' : client ? 'Update Client' : 'Register Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

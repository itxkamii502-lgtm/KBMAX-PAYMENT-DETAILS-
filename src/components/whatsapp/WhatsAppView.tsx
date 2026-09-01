import React, { useState, useEffect } from 'react';
import { Client, WhatsAppMessage } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import {
  compilePaymentConfirmationMessage,
  DEFAULT_PAYMENT_CONFIRMATION_TEMPLATE,
  formatPeriodDateRange,
} from '../../utils/messageFormatter';
import {
  MessageSquare,
  Send,
  Phone,
  User,
  Clock,
  CheckCircle,
  ExternalLink,
  Sparkles,
  Search,
  RefreshCw,
  Layers,
  Copy,
  Check,
  RotateCcw,
  Save,
} from 'lucide-react';

export const WhatsAppView: React.FC = () => {
  const { showToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer Form state
  const [selectedClientId, setSelectedClientId] = useState<number | ''>('');
  const [customNumber, setCustomNumber] = useState('');
  const [messageType, setMessageType] = useState('Payment Completed');
  const [messageBody, setMessageBody] = useState('');
  const [customTemplate, setCustomTemplate] = useState('');
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Search in logs
  const [searchLogs, setSearchLogs] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientsData, messagesData, settingsData] = await Promise.all([
        api.getClients(),
        api.getWhatsAppMessages(),
        api.getSettings(),
      ]);
      const sortedClients = [...clientsData].sort((a, b) =>
        a.client_name.localeCompare(b.client_name, undefined, { sensitivity: 'base' })
      );
      setClients(sortedClients);
      setMessages(messagesData);
      const savedTmpl = settingsData.payment_confirmation_message || DEFAULT_PAYMENT_CONFIRMATION_TEMPLATE;
      setCustomTemplate(savedTmpl);

      if (sortedClients.length > 0 && !selectedClientId) {
        setSelectedClientId(sortedClients[0].id);
        setCustomNumber(sortedClients[0].whatsapp_number);
        const initialMsg = compilePaymentConfirmationMessage({
          template: savedTmpl,
          clientName: sortedClients[0].client_name,
        });
        setMessageBody(initialMsg);
      } else if (!messageBody) {
        setMessageBody(savedTmpl);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load WhatsApp data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClientChange = (clientId: number) => {
    setSelectedClientId(clientId);
    const found = clients.find((c) => c.id === clientId);
    if (found) {
      setCustomNumber(found.whatsapp_number);
      if (messageType === 'Payment Completed') {
        const msg = compilePaymentConfirmationMessage({
          template: customTemplate || DEFAULT_PAYMENT_CONFIRMATION_TEMPLATE,
          clientName: found.client_name,
        });
        setMessageBody(msg);
      }
    }
  };

  const handlePresetSelect = (preset: string) => {
    setMessageType(preset);
    const client = clients.find((c) => c.id === selectedClientId);
    const clientName = client?.client_name || 'Client';

    switch (preset) {
      case 'Payment Completed':
        setMessageBody(
          compilePaymentConfirmationMessage({
            template: customTemplate || DEFAULT_PAYMENT_CONFIRMATION_TEMPLATE,
            clientName: clientName,
          })
        );
        break;
      case 'Billing Reminder':
        setMessageBody(
          `Assalam-o-Alaikum ${clientName},\nApka haftawar SMS billing slip tayar hai. Baraye meharbani check kar lein.\nShukriya. - KB MAX`
        );
        break;
      case 'Rate Update':
        setMessageBody(
          `Important Notice:\nPanel country SMS rates have been updated. Please verify updated rates on your KB MAX portal.\nShukriya. - KB MAX`
        );
        break;
      case 'Custom Message':
        setMessageBody('');
        break;
    }
  };

  const handleResetTemplate = () => {
    const client = clients.find((c) => c.id === selectedClientId);
    const clientName = client?.client_name || 'Client';
    const msg = compilePaymentConfirmationMessage({
      template: DEFAULT_PAYMENT_CONFIRMATION_TEMPLATE,
      clientName: clientName,
    });
    setMessageBody(msg);
    showToast('Reset to official KBMAX Payment template!', 'info');
  };

  const handleSaveAsDefault = async () => {
    try {
      await api.updateSettings({
        payment_confirmation_message: messageBody,
      });
      setCustomTemplate(messageBody);
      showToast('Custom template saved as system default!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save template.', 'error');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNumber.trim() || !messageBody.trim()) {
      showToast('Please enter a recipient number and message text.', 'error');
      return;
    }

    setSending(true);
    try {
      const res = await api.sendWhatsAppMessage({
        client_id: selectedClientId ? Number(selectedClientId) : undefined,
        message_type: messageType,
        recipient_number: customNumber.trim(),
        message_body: messageBody.trim(),
      });

      showToast('WhatsApp dispatch prepared!', 'success');

      if (res.directUrl) {
        window.open(res.directUrl, '_blank', 'noopener,noreferrer');
      }

      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to dispatch WhatsApp message.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleCopyLogMessage = (msg: WhatsAppMessage) => {
    navigator.clipboard.writeText(msg.message_body);
    setCopiedId(msg.id);
    showToast('Message text copied!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLogs = messages.filter(
    (m) =>
      (m.recipient_number || '').includes(searchLogs) ||
      (m.client_name || '').toLowerCase().includes(searchLogs.toLowerCase()) ||
      (m.message_type || '').toLowerCase().includes(searchLogs.toLowerCase()) ||
      (m.message_body || '').toLowerCase().includes(searchLogs.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-emerald-400" />
            <span>WhatsApp Dispatch Hub & Audit Logs</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Compose notifications, trigger payment confirmations, and audit all outbound WhatsApp slips
          </p>
        </div>

        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          <span>Refresh Logs</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Quick Message Composer (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Compose WhatsApp Notification</span>
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
              Direct WA Dispatch
            </span>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Select Message Template / Preset
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                'Payment Completed',
                'Billing Reminder',
                'Rate Update',
                'Custom Message',
              ].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePresetSelect(p)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold text-left border transition-all cursor-pointer truncate ${
                    messageType === p
                      ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSendMessage} className="space-y-4">
            {/* Select Client */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Recipient Client
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientChange(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-2.5 px-3 text-xs text-white outline-none cursor-pointer"
              >
                <option value="">-- Or enter custom number below --</option>
                {clients
                  .slice()
                  .sort((a, b) => a.client_name.localeCompare(b.client_name, undefined, { sensitivity: 'base' }))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.client_name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Target WhatsApp Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                WhatsApp Phone Number <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={customNumber}
                  onChange={(e) => setCustomNumber(e.target.value)}
                  placeholder="923001234567"
                  required
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 font-mono outline-none"
                />
              </div>
            </div>

            {/* Message Body */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Message Content (Editable / کسٹم لکھیں)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetTemplate}
                    className="text-[10px] text-slate-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition"
                    title="Reset to official template"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAsDefault}
                    className="text-[10px] text-slate-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition"
                    title="Save current wording as system default"
                  >
                    <Save className="w-3 h-3" />
                    <span>Save Template</span>
                  </button>
                </div>
              </div>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={10}
                required
                placeholder="Type your WhatsApp message..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl p-3 text-xs text-white font-mono placeholder-slate-500 outline-none resize-y leading-relaxed shadow-inner"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 font-mono">
                <span>{messageBody.split('\n').length} lines</span>
                <span>{messageBody.length} characters</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Preparing...' : 'Dispatch to WhatsApp'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Outbound Messages Audit Log (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Outbound Message Logs</span>
              </h3>
              <p className="text-[11px] text-slate-400">History of all payment slips and WhatsApp messages</p>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={searchLogs}
                onChange={(e) => setSearchLogs(e.target.value)}
                placeholder="Filter logs..."
                className="bg-slate-950 border border-slate-800 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white outline-none focus:border-emerald-500 placeholder-slate-500 w-full sm:w-48"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[560px] p-4 divide-y divide-slate-800/80 space-y-3">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mb-2" />
                <p className="text-xs">Loading message logs...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-xs font-semibold text-slate-300">No message logs recorded yet</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Sent billing slips and notifications will appear here.
                </p>
              </div>
            ) : (
              filteredLogs.map((msg) => (
                <div key={msg.id} className="pt-3 first:pt-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {msg.client_name || 'Direct Recipient'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                        {msg.recipient_number}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          msg.message_type === 'Billing Slip'
                            ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                            : 'bg-blue-950/60 border-blue-500/30 text-blue-300'
                        }`}
                      >
                        {msg.message_type}
                      </span>
                      <span className="text-[10px] text-slate-500">{msg.created_at}</span>
                    </div>
                  </div>

                  <div className="relative bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <button
                      onClick={() => handleCopyLogMessage(msg)}
                      className="absolute top-2 right-2 p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 transition-colors"
                      title="Copy Message Text"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    <p className="text-[11px] font-mono text-emerald-300/80 whitespace-pre-wrap line-clamp-3 pr-8 leading-relaxed">
                      {msg.message_body}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

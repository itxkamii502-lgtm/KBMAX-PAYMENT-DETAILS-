import React, { useState, useEffect } from 'react';
import { BillingRecord } from '../../types';
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
  Copy,
  Check,
  X,
  Sparkles,
  Phone,
  User,
  Calendar,
  RotateCcw,
  Save,
  CheckCircle2,
  ExternalLink,
  Edit3,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PaymentConfirmationModalProps {
  isOpen: boolean;
  record?: BillingRecord | null;
  clientName?: string;
  whatsappNumber?: string;
  startDate?: string;
  endDate?: string;
  amount?: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PaymentConfirmationModal: React.FC<PaymentConfirmationModalProps> = ({
  isOpen,
  record,
  clientName,
  whatsappNumber,
  startDate,
  endDate,
  amount,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const cName夺 = record?.client_name_snapshot || clientName || 'Client';
  const rawNumber =
    record?.whatsapp_number_snapshot ||
    (record as any)?.client_whatsapp ||
    whatsappNumber ||
    '';
  const sDate = record?.billing_period_start || startDate || '';
  const eDate = record?.billing_period_end || endDate || '';
  const netAmount = record?.net_payable ?? amount ?? 0;

  const [message, setMessage] = useState<string>('');
  const [recipientNumber, setRecipientNumber] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    if (isOpen) {
      setRecipientNumber(rawNumber);
      // Fetch system settings if available to use customized template, otherwise compile default
      api.getSettings()
        .then((settings) => {
          const tmpl = settings.payment_confirmation_message || DEFAULT_PAYMENT_CONFIRMATION_TEMPLATE;
          const compiled = compilePaymentConfirmationMessage({
            template: tmpl,
            startDate: sDate,
            endDate: eDate,
            clientName: cName夺,
            amount: netAmount,
            currencySymbol: settings.currency_symbol || 'Rs.',
            currency: settings.currency || 'PKR',
            paymentMethod: record?.payment_method_name || 'JazzCash / Bank',
            paymentDetails: record?.payment_details_snapshot || '',
          });
          setMessage(compiled);
        })
        .catch(() => {
          const compiled = compilePaymentConfirmationMessage({
            template: DEFAULT_PAYMENT_CONFIRMATION_TEMPLATE,
            startDate: sDate,
            endDate: eDate,
            clientName: cName夺,
            amount: netAmount,
          });
          setMessage(compiled);
        });
    }
  }, [isOpen, record, clientName, whatsappNumber, sDate, eDate, netAmount]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    showToast('Payment confirmation text copied!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetToDefault = () => {
    const compiled = compilePaymentConfirmationMessage({
      template: DEFAULT_PAYMENT_CONFIRMATION_TEMPLATE,
      startDate: sDate,
      endDate: eDate,
      clientName: cName夺,
      amount: netAmount,
    });
    setMessage(compiled);
    showToast('Reset to official KBMAX template!', 'info');
  };

  const handleSaveAsDefaultTemplate = async () => {
    setSavingTemplate(true);
    try {
      // Create a template string with placeholders
      let tmpl = message;
      const range = formatPeriodDateRange(sDate, eDate);
      if (range && tmpl.includes(range)) {
        tmpl = tmpl.replace(range, '{{date_range}}');
      }
      await api.updateSettings({
        payment_confirmation_message: tmpl,
      });
      showToast('Custom template saved as default for future confirmations!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save template.', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSendWhatsApp = async () => {
    const cleanNumber = recipientNumber.replace(/[^\d]/g, '');
    if (!cleanNumber) {
      showToast('Please specify a valid WhatsApp number.', 'error');
      return;
    }
    if (!message.trim()) {
      showToast('Message text cannot be empty.', 'error');
      return;
    }

    setSending(true);
    try {
      const res进 = await api.sendWhatsAppMessage({
        client_id: record?.client_id,
        billing_record_id: record?.id,
        message_type: 'Payment Completed',
        recipient_number: cleanNumber,
        message_body: message.trim(),
      });

      // If record is not paid yet, optionally mark as paid
      if (record && record.payment_status !== 'Payment Completed') {
        try {
          await api.updateBillingRecordStatus(record.id, {
            payment_status: 'Payment Completed',
            payment_date: new Date().toISOString().split('T')[0],
          });
        } catch (e) {
          // ignore silent
        }
      }

      confetti({
        particleCount: 60,
        spread: 50,
        origin: { y: 0.6 },
      });

      showToast('WhatsApp dispatch prepared! Opening chat...', 'success');

      if (res进.directUrl) {
        window.open(res进.directUrl, '_blank', 'noopener,noreferrer');
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to dispatch WhatsApp message.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      id="payment-confirmation-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-900 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>WhatsApp Payment Confirmation</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  KBMAX Template
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                پیمنٹ سینڈ کرنے کے بعد واٹس ایپ ایس ایم ایس — آپ میسج خود ایڈٹ یا تبدیل بھی کر سکتے ہیں
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Subheader Details */}
        <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-slate-300">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Client:</span>
              <strong className="text-white font-semibold">{cName夺}</strong>
            </div>

            <div className="flex items-center gap-1.5 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Period:</span>
              <span className="text-amber-300 font-mono font-medium">
                {formatPeriodDateRange(sDate, eDate)}
              </span>
            </div>
          </div>

          {/* Recipient phone input */}
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">WhatsApp:</span>
            <input
              type="text"
              value={recipientNumber}
              onChange={(e) => setRecipientNumber(e.target.value)}
              placeholder="923001234567"
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-emerald-300 font-mono outline-none focus:border-emerald-500 w-36"
            />
          </div>
        </div>

        {/* Modal Body: Editor & Toolbar */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Quick Edit vs Live WhatsApp Preview toggle & Quick Helpers */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveView('edit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeView === 'edit'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Write / Edit Custom</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeView === 'preview'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>WhatsApp Bubble Preview</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-[11px] text-slate-400 hover:text-emerald-300 px-2.5 py-1 rounded-lg hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer border border-transparent hover:border-slate-700"
              title="Reset message to standard KBMAX template"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Reset Template</span>
            </button>
          </div>

          {activeView === 'edit' ? (
            <div className="space-y-2">
              <div className="relative">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={14}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-2xl p-4 text-xs font-mono text-slate-100 leading-relaxed outline-none shadow-inner resize-y transition-colors"
                  placeholder="Type or customize your WhatsApp SMS here..."
                />
              </div>

              {/* Quick Template Chips Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 mr-1">Insert Data:</span>
                <button
                  type="button"
                  onClick={() =>
                    setMessage(
                      (prev) => prev + `\n💰 Amount: Rs. ${netAmount.toLocaleString()} PKR`
                    )
                  }
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition cursor-pointer"
                >
                  + Amount (Rs. {netAmount.toLocaleString()})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMessage((prev) => prev + `\n👤 Client: ${cName夺}`)
                  }
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition cursor-pointer"
                >
                  + Client Name
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMessage(
                      (prev) =>
                        prev +
                        `\n📅 Period: ${formatPeriodDateRange(sDate, eDate)}`
                    )
                  }
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition cursor-pointer"
                >
                  + Date Range
                </button>
              </div>
            </div>
          ) : (
            /* WhatsApp Style Preview Bubble */
            <div className="bg-[#0b141a] rounded-2xl p-4 sm:p-6 border border-slate-800/80 shadow-inner">
              <div className="max-w-md mx-auto bg-[#005c4b] text-white p-4 rounded-2xl rounded-tr-none shadow-lg relative font-sans text-xs leading-relaxed whitespace-pre-wrap selection:bg-emerald-300 selection:text-black">
                {message}
                <div className="text-[10px] text-emerald-200/80 text-right mt-2 flex items-center justify-end gap-1">
                  <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <CheckCircle2 className="w-3 h-3 text-sky-300 inline" />
                </div>
              </div>
            </div>
          )}

          {/* Bottom helper info */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span>
              Lines: <strong className="text-slate-300">{message.split('\n').length}</strong> • Characters: <strong className="text-slate-300">{message.length}</strong>
            </span>

            <button
              type="button"
              onClick={handleSaveAsDefaultTemplate}
              disabled={savingTemplate}
              className="text-slate-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer"
              title="Save current wording as system default"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingTemplate ? 'Saving...' : 'Save as Default Template'}</span>
            </button>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer min-h-[42px]"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Message</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer min-h-[42px]"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={sending}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/60 flex items-center gap-2 cursor-pointer min-h-[42px]"
            >
              {sending ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                  <span>Preparing Dispatch...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send on WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

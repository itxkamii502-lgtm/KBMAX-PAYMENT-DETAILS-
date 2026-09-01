import React, { useState, useEffect } from 'react';
import { BillingRecord } from '../../types';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { DeleteRecordPinModal } from '../common/DeleteRecordPinModal';
import { PaymentConfirmationModal } from '../common/PaymentConfirmationModal';
import { SlipEditPinModal } from '../common/SlipEditPinModal';
import {
  X,
  Copy,
  Check,
  Send,
  MessageSquare,
  FileText,
  Printer,
  CheckCircle2,
  Share2,
  Sparkles,
  Trash2,
  Edit3,
  Save,
  Lock,
  RotateCcw,
  CheckCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SlipModalProps {
  record: BillingRecord | null;
  onClose: () => void;
  onStatusUpdated?: () => void;
}

export const SlipModal: React.FC<SlipModalProps> = ({
  record,
  onClose,
  onStatusUpdated,
}) => {
  const { showToast } = useToast();
  const [currentRecord, setCurrentRecord] = useState<BillingRecord | null>(record);
  const [slipType, setSlipType] = useState<'professional' | 'simple'>('professional');
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [savingSlip, setSavingSlip] = useState(false);

  // Edit Mode & PIN Security
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [showEditPinModal, setShowEditPinModal] = useState(false);
  const [pinAction, setPinAction] = useState<'start_edit' | 'save_done' | 'resend_whatsapp'>('start_edit');

  const [showDeletePinModal, setShowDeletePinModal] = useState(false);
  const [showPaymentConfModal, setShowPaymentConfModal] = useState(false);

  const isAlreadySent = Boolean(
    (currentRecord && Number(currentRecord.whatsapp_send_count) > 0) ||
      (currentRecord && (currentRecord.whatsapp_status === 'Sent' || currentRecord.whatsapp_status === 'Direct Link Generated'))
  );

  useEffect(() => {
    setCurrentRecord(record);
    setIsEditing(false);
  }, [record]);

  if (!currentRecord) return null;

  const getSlipContent = () => {
    return slipType === 'professional'
      ? currentRecord.professional_slip || 'No professional slip generated.'
      : currentRecord.simple_slip || 'No simple slip generated.';
  };

  const handleCopy = () => {
    const textToCopy = isEditing ? editedText : getSlipContent();
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    showToast('Slip copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const executeSendWhatsApp = async () => {
    const rawNumber =
      currentRecord.whatsapp_number_snapshot ||
      (currentRecord as any).client_whatsapp ||
      '';

    if (!rawNumber) {
      showToast('Client WhatsApp number is not configured.', 'error');
      return;
    }

    const slipToSend = isEditing ? editedText : getSlipContent();

    setSending(true);
    try {
      const res = await api.sendWhatsAppMessage({
        client_id: currentRecord.client_id,
        billing_record_id: currentRecord.id,
        message_type: 'Billing Slip',
        recipient_number: rawNumber,
        message_body: slipToSend,
      });

      showToast('WhatsApp dispatch prepared!', 'success');

      // Update currentRecord local status
      setCurrentRecord((prev) =>
        prev
          ? {
              ...prev,
              whatsapp_status: 'Sent',
              whatsapp_send_count: (prev.whatsapp_send_count || 0) + 1,
            }
          : null
      );
      if (onStatusUpdated) onStatusUpdated();

      if (res.directUrl) {
        window.open(res.directUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to dispatch WhatsApp message.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (isAlreadySent) {
      setPinAction('resend_whatsapp');
      setShowEditPinModal(true);
    } else {
      await executeSendWhatsApp();
    }
  };

  const handleSendPaymentConfirmation = () => {
    setShowPaymentConfModal(true);
  };

  const handleMarkPaymentCompleted = async () => {
    setUpdatingStatus(true);
    try {
      await api.updateBillingRecordStatus(currentRecord.id, {
        payment_status: 'Payment Completed',
        payment_date: new Date().toISOString().split('T')[0],
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });

      showToast(`Record #${currentRecord.id} marked as Payment Completed!`, 'success');
      setCurrentRecord((prev) =>
        prev
          ? {
              ...prev,
              payment_status: 'Payment Completed',
              payment_date: new Date().toISOString().split('T')[0],
            }
          : null
      );
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to update payment status.', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Trigger PIN modal when clicking Edit Slip
  const handleRequestEdit = () => {
    if (isEditing) {
      // Prompt PIN to save/done
      setPinAction('save_done');
      setShowEditPinModal(true);
    } else {
      // Prompt PIN to start editing
      setEditedText(getSlipContent());
      setPinAction('start_edit');
      setShowEditPinModal(true);
    }
  };

  const handlePinVerified = async () => {
    setShowEditPinModal(false);

    if (pinAction === 'start_edit') {
      setIsEditing(true);
      setEditedText(getSlipContent());
      showToast('Slip edit mode unlocked with PIN 0214!', 'success');
    } else if (pinAction === 'resend_whatsapp') {
      showToast('WhatsApp resend authorized with PIN 0214!', 'success');
      await executeSendWhatsApp();
    } else if (pinAction === 'save_done') {
      // Save the edited slip to database
      setSavingSlip(true);
      try {
        const updatePayload: any = {};
        if (slipType === 'professional') {
          updatePayload.professional_slip = editedText;
        } else {
          updatePayload.simple_slip = editedText;
        }

        const updated = await api.updateBillingRecord(currentRecord.id, updatePayload);
        setCurrentRecord(updated);
        setIsEditing(false);
        showToast('Edited slip saved successfully with PIN 0214!', 'success');
        if (onStatusUpdated) onStatusUpdated();
      } catch (err: any) {
        showToast(err.message || 'Failed to save edited slip.', 'error');
      } finally {
        setSavingSlip(false);
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedText('');
  };

  const handlePrint = () => {
    const textToPrint = isEditing ? editedText : getSlipContent();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Payment Slip - ${currentRecord.client_name_snapshot} (${currentRecord.billing_period_start})</title>
          <style>
            body { font-family: monospace; padding: 24px; white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
          </style>
        </head>
        <body>${textToPrint}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Payment Slip Generator</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  #{currentRecord.id}
                </span>
                {isEditing && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
                    <Edit3 className="w-3 h-3" />
                    Edit Mode Active
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                {currentRecord.client_name_snapshot} • {currentRecord.billing_period_start} ➔ {currentRecord.billing_period_end}
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

        {/* Tab Selection: Professional vs Simple */}
        <div className="px-4 sm:px-6 pt-4 pb-2 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 bg-slate-950/40">
          <div className="flex rounded-xl p-1 bg-slate-950 border border-slate-800">
            <button
              onClick={() => {
                if (isEditing) {
                  if (confirm('Switching tabs will discard unsaved edits. Continue?')) {
                    setIsEditing(false);
                    setSlipType('professional');
                  }
                } else {
                  setSlipType('professional');
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                slipType === 'professional'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📋 Professional Slip
            </button>
            <button
              onClick={() => {
                if (isEditing) {
                  if (confirm('Switching tabs will discard unsaved edits. Continue?')) {
                    setIsEditing(false);
                    setSlipType('simple');
                  }
                } else {
                  setSlipType('simple');
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                slipType === 'simple'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ⚡ Simple Slip
            </button>
          </div>

          {/* Admin Edit Trigger & Payment Status Pill */}
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={handleRequestEdit}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Edit Slip (Requires PIN 0214)"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Slip</span>
                <span className="text-[10px] opacity-75 font-mono">(PIN 0214)</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCancelEdit}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestEdit}
                  disabled={savingSlip}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Done & Save</span>
                  <span className="text-[10px] opacity-80 font-mono">(PIN 0214)</span>
                </button>
              </div>
            )}

            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                currentRecord.payment_status === 'Payment Completed'
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                  : currentRecord.payment_status === 'Payment Sent'
                  ? 'bg-blue-950/80 border-blue-500/40 text-blue-300'
                  : 'bg-amber-950/80 border-amber-500/40 text-amber-300'
              }`}
            >
              {currentRecord.payment_status}
            </span>
          </div>
        </div>

        {/* Slip Display / Text Editor Box */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/80">
          <div className="relative bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-inner">
            <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
              <button
                onClick={handleCopy}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
                title="Copy Slip Text"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={handlePrint}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer"
                title="Print Slip"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>

            {isEditing ? (
              <div className="space-y-2 pt-6">
                <div className="flex items-center justify-between text-xs text-amber-300/90 font-medium">
                  <span>✏️ Editing Slip Text in Real-Time:</span>
                  <span className="text-[11px] text-slate-400">Click Done & Save with PIN 0214 when finished</span>
                </div>
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  rows={14}
                  className="w-full bg-slate-950 border border-amber-500/50 focus:border-amber-400 rounded-xl p-3.5 font-mono text-xs sm:text-sm text-emerald-200 leading-relaxed outline-none shadow-inner"
                  placeholder="Enter custom slip content here..."
                />
              </div>
            ) : (
              <pre className="font-mono text-xs sm:text-sm text-emerald-200/90 whitespace-pre-wrap leading-relaxed select-all overflow-x-auto pr-16">
                {getSlipContent()}
              </pre>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {currentRecord.payment_status !== 'Payment Completed' && (
              <button
                onClick={handleMarkPaymentCompleted}
                disabled={updatingStatus}
                className="px-3.5 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Mark Paid</span>
              </button>
            )}

            <button
              onClick={handleSendPaymentConfirmation}
              disabled={sending}
              className="px-3.5 py-2 rounded-xl bg-blue-950/60 hover:bg-blue-900/60 border border-blue-500/40 text-blue-300 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>Send Paid Confirmation</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeletePinModal(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors cursor-pointer"
              title="Delete Record (PIN 41200)"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              onClick={handleSendWhatsApp}
              disabled={sending}
              className={`px-4 py-2 rounded-xl active:scale-95 text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all cursor-pointer ${
                isAlreadySent
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/60'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/60'
              }`}
              title={
                isAlreadySent
                  ? 'Yeh slip pehle hi bheji ja chuki hai. Dobara bhejne ke liye PIN 0214 darkaar hai.'
                  : 'Send WhatsApp Slip'
              }
            >
              {isAlreadySent ? <Lock className="w-3.5 h-3.5" /> : <Send className="w-4 h-4" />}
              <span>{isAlreadySent ? 'Resend WhatsApp' : 'Send via WhatsApp'}</span>
              {isAlreadySent && (
                <span className="text-[10px] bg-amber-700/80 px-1.5 py-0.5 rounded font-mono">PIN 0214</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Slip Edit / Resend Authorization PIN Modal (PIN: 0214) */}
      {showEditPinModal && (
        <SlipEditPinModal
          isOpen={showEditPinModal}
          onClose={() => setShowEditPinModal(false)}
          onVerified={handlePinVerified}
          title={
            pinAction === 'start_edit'
              ? 'Unlock Slip Edit (PIN 0214)'
              : pinAction === 'resend_whatsapp'
              ? 'WhatsApp Resend Authorization (PIN 0214)'
              : 'Save Edited Slip (PIN 0214)'
          }
          description={
            pinAction === 'start_edit'
              ? 'Slip edit karne ke liye admin PIN 0214 darj karein.'
              : pinAction === 'resend_whatsapp'
              ? `Yeh slip pehle hi WhatsApp par bheji ja chuki hai (${currentRecord.client_name_snapshot}). Dobara (Resend) bhejne ke liye Security PIN 0214 darj karein.`
              : 'Edited slip ko save karne ke liye PIN 0214 tasdeeq karein.'
          }
        />
      )}

      {/* Delete Record PIN Modal (PIN: 41200) */}
      {showDeletePinModal && (
        <DeleteRecordPinModal
          isOpen={showDeletePinModal}
          recordId={currentRecord.id}
          recordTitle={`Record #${currentRecord.id} (${currentRecord.billing_period_start} to ${currentRecord.billing_period_end})`}
          clientName={currentRecord.client_name_snapshot}
          onClose={() => setShowDeletePinModal(false)}
          onSuccess={() => {
            setShowDeletePinModal(false);
            if (onStatusUpdated) onStatusUpdated();
            onClose();
          }}
        />
      )}

      {/* Payment Confirmation WhatsApp Modal */}
      {showPaymentConfModal && (
        <PaymentConfirmationModal
          isOpen={showPaymentConfModal}
          record={currentRecord}
          onClose={() => setShowPaymentConfModal(false)}
          onSuccess={() => {
            setShowPaymentConfModal(false);
            if (onStatusUpdated) onStatusUpdated();
          }}
        />
      )}
    </div>
  );
};

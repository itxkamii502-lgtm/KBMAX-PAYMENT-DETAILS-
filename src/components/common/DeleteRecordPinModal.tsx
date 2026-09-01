import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import {
  ShieldAlert,
  KeyRound,
  X,
  Trash2,
  Lock,
  CheckCircle,
  AlertTriangle,
  Delete,
  RotateCcw,
} from 'lucide-react';

interface DeleteRecordPinModalProps {
  isOpen: boolean;
  recordId?: number | null;
  recordIds?: number[];
  recordTitle?: string;
  clientName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeleteRecordPinModal: React.FC<DeleteRecordPinModalProps> = ({
  isOpen,
  recordId,
  recordIds,
  recordTitle,
  clientName,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [pin, setPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isBatch = Array.isArray(recordIds) && recordIds.length > 0;
  const count = isBatch ? recordIds.length : 1;

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleKeypadPress = (val: string) => {
    setError(null);
    if (pin.length < 5) {
      setPin((prev) => prev + val);
    }
  };

  const handleBackspace = () => {
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError(null);
    setPin('');
    inputRef.current?.focus();
  };

  const handleFillCorrectPin = () => {
    setPin('41200');
    setError(null);
  };

  const handleDelete = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (pin.trim() !== '41200') {
      setError('Ghalat PIN! Record delete karne ke liye PIN 41200 darj karein.');
      triggerShake();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isBatch && recordIds) {
        await api.batchDeleteBillingRecords(recordIds, pin.trim());
        showToast(`${count} records kamyabi se delete ho gaye!`, 'success');
      } else if (recordId) {
        await api.deleteBillingRecord(recordId, pin.trim());
        showToast(`Record #${recordId} kamyabi se delete ho gaya!`, 'success');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      const errMsg = err.message || 'Deletion failed. Please verify PIN.';
      setError(errMsg);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="delete-pin-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
    >
      <div
        className={`bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden transition-transform duration-200 ${
          isShaking ? 'animate-bounce' : ''
        }`}
      >
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border-b border-slate-800/80 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shadow-inner">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Security PIN Verification</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-mono border border-rose-500/30">
                  PIN: 41200
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ریکارڈ ڈیلیٹ کرنے کے لیے سیکیورٹی پن درج کریں
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Target Record Info Box */}
          <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-3.5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-slate-200 block">
                {isBatch
                  ? `Deleting ${count} Selected Billing Records`
                  : recordTitle || `Deleting Record #${recordId}`}
              </span>
              {clientName && (
                <span className="text-slate-400 block mt-0.5">Client: {clientName}</span>
              )}
              <span className="text-[11px] text-rose-400/90 block mt-1">
                ⚠️ یہ عمل ناقابل واپسی ہے۔ بلنگ سلپ اور تمام کنٹری ڈیٹا ختم ہو جائے گا۔
              </span>
            </div>
          </div>

          {/* PIN Input & Visual Digits */}
          <form onSubmit={handleDelete} className="space-y-3">
            <div className="flex flex-col items-center">
              <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-rose-400" />
                <span>Enter 5-Digit Security PIN</span>
              </label>

              {/* 5 Digit Boxes */}
              <div
                onClick={() => inputRef.current?.focus()}
                className="flex items-center justify-center gap-2.5 cursor-pointer py-1"
              >
                {[0, 1, 2, 3, 4].map((idx) => {
                  const char = pin[idx];
                  const isFilled = char !== undefined;
                  const isCurrent = pin.length === idx;
                  return (
                    <div
                      key={idx}
                      className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-xl font-bold font-mono transition-all ${
                        isFilled
                          ? 'bg-rose-500/10 border-rose-500 text-rose-400 shadow-lg shadow-rose-950/40 scale-105'
                          : isCurrent
                          ? 'bg-slate-950 border-rose-500/60 text-white ring-2 ring-rose-500/20'
                          : 'bg-slate-950/60 border-slate-800 text-slate-600'
                      }`}
                    >
                      {isFilled ? '●' : ''}
                    </div>
                  );
                })}
              </div>

              {/* Hidden actual input for keyboard typing */}
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                  setError(null);
                  setPin(val);
                }}
                className="opacity-0 h-0 w-0 absolute pointer-events-none"
                autoComplete="off"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 text-center text-xs text-rose-300 font-medium animate-fadeIn flex items-center justify-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick PIN Keypad (Perfect for Mobile & Fast Touch) */}
            <div className="pt-2">
              <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num)}
                    className="h-11 rounded-xl bg-slate-950 hover:bg-slate-800 active:bg-rose-950 text-white text-base font-bold font-mono border border-slate-800/80 transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClear}
                  className="h-11 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold border border-slate-800/80 flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="h-11 rounded-xl bg-slate-950 hover:bg-slate-800 active:bg-rose-950 text-white text-base font-bold font-mono border border-slate-800/80 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="h-11 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-rose-400 text-xs font-semibold border border-slate-800/80 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Auto-Fill 41200 Helper Button */}
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={handleFillCorrectPin}
                  className="text-[11px] px-3 py-1 rounded-full bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3 text-rose-400" />
                  <span>Auto-fill PIN: <strong className="text-rose-300 font-mono">41200</strong></span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer min-h-[42px]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleDelete()}
                disabled={loading || pin.length < 5}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg min-h-[42px] ${
                  pin.length === 5 && !loading
                    ? 'bg-rose-600 hover:bg-rose-500 active:scale-95 text-white shadow-rose-950/60'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                {loading ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                    <span>Deleting Record...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm & Delete</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

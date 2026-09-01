import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, Lock, X, Check, ShieldCheck, AlertCircle } from 'lucide-react';

interface SlipEditPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  title?: string;
  description?: string;
}

export const SlipEditPinModal: React.FC<SlipEditPinModalProps> = ({
  isOpen,
  onClose,
  onVerified,
  title = 'Admin Slip Edit Authorization',
  description = 'Slip edit ya save karne ke liye Security PIN 0214 darj karein.',
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (pin.length < 4) {
      const nextPin = pin + val;
      setPin(nextPin);
      if (nextPin === '0214') {
        setTimeout(() => {
          onVerified();
        }, 150);
      } else if (nextPin.length === 4) {
        setError('Ghalat PIN! Durust PIN 0214 darj karein.');
        triggerShake();
      }
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

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.trim() === '0214') {
      onVerified();
    } else {
      setError('Ghalat PIN! Durust PIN 0214 darj karein.');
      triggerShake();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div
        className={`bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden transition-transform duration-200 ${
          isShaking ? 'animate-bounce' : ''
        }`}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-b border-slate-800/80 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
              <Lock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                  PIN: 0214
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form & PIN Input */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex flex-col items-center">
            <label className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              Enter 4-Digit PIN (0214)
            </label>

            {/* Visual PIN Dots */}
            <div className="flex items-center gap-3 my-2">
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full transition-all duration-200 ${
                      isFilled
                        ? 'bg-amber-400 shadow-md shadow-amber-400/40 scale-110'
                        : 'bg-slate-800 border border-slate-700'
                    }`}
                  />
                );
              })}
            </div>

            <input
              ref={inputRef}
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/[^\d]/g, '');
                setError(null);
                setPin(val);
                if (val === '0214') {
                  setTimeout(() => onVerified(), 150);
                }
              }}
              className="opacity-0 absolute -z-10"
              autoFocus
            />

            {error && (
              <div className="mt-2 text-xs text-rose-400 bg-rose-950/50 border border-rose-800/60 px-3 py-1.5 rounded-xl text-center flex items-center gap-1.5 animate-fadeIn">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeypadPress(digit)}
                className="h-11 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-amber-600 active:text-white text-slate-200 font-bold text-base transition-all border border-slate-700/60 shadow-sm cursor-pointer"
              >
                {digit}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              className="h-11 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-medium text-xs transition-all border border-slate-800 cursor-pointer"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="h-11 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-amber-600 active:text-white text-slate-200 font-bold text-base transition-all border border-slate-700/60 shadow-sm cursor-pointer"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              className="h-11 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-rose-400 font-medium text-xs transition-all border border-slate-800 cursor-pointer"
            >
              ⌫
            </button>
          </div>

          {/* Quick Auto-Fill PIN */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setPin('0214');
                setTimeout(() => onVerified(), 150);
              }}
              className="text-[11px] text-amber-400 hover:text-amber-300 font-mono underline decoration-dotted cursor-pointer"
            >
              Quick Auto-Fill (PIN: 0214)
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-950/60 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Verify & Continue</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

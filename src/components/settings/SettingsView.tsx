import React, { useState, useEffect } from 'react';
import { PaymentMethod, Country, AuditLog } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Settings,
  Lock,
  CreditCard,
  Download,
  Upload,
  Globe,
  Activity,
  CheckCircle,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Database,
  Calendar,
  MessageSquare,
  Sparkles,
  Save,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import {
  DEFAULT_PAYMENT_CONFIRMATION_TEMPLATE,
  compilePaymentConfirmationMessage,
} from '../../utils/messageFormatter';

export const SettingsView: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();

  // Tab
  const [activeTab, setActiveTab] = useState<
    'security' | 'templates' | 'payment_methods' | 'countries' | 'backup' | 'audit'
  >('security');

  // WhatsApp & SMS Templates state
  const [paymentConfTemplate, setPaymentConfTemplate] = useState<string>(
    DEFAULT_PAYMENT_CONFIRMATION_TEMPLATE
  );
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [changingPass, setChangingPass] = useState(false);

  // Payment Methods state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [newMethodName, setNewMethodName] = useState('');

  // Countries state
  const [countries, setCountries] = useState<Country[]>([]);
  const [newCountryName, setNewCountryName] = useState('');
  const [newCountryIso, setNewCountryIso] = useState('');
  const [newCountryFlag, setNewCountryFlag] = useState('');
  const [newCountryPhone, setNewCountryPhone] = useState('');

  // Backup & Restore
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreJsonInput, setRestoreJsonInput] = useState('');

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadSettingsData = async () => {
    try {
      const [pmData, cData, settingsData] = await Promise.all([
        api.getPaymentMethods(),
        api.getCountries(),
        api.getSettings(),
      ]);
      setPaymentMethods(pmData);
      setCountries(cData);
      if (settingsData.payment_confirmation_message) {
        setPaymentConfTemplate(settingsData.payment_confirmation_message);
      }
    } catch (err: any) {
      showToast('Failed to load system settings.', 'error');
    }
  };

  const handleSavePaymentTemplate = async () => {
    if (!paymentConfTemplate.trim()) {
      showToast('Payment template cannot be empty.', 'error');
      return;
    }
    setSavingTemplate(true);
    try {
      await api.updateSettings({
        payment_confirmation_message: paymentConfTemplate,
      });
      showToast('Payment confirmation template saved successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save template.', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleResetPaymentTemplate = () => {
    setPaymentConfTemplate(DEFAULT_PAYMENT_CONFIRMATION_TEMPLATE);
    showToast('Template reset to official KBMAX standard!', 'info');
  };

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const logs = await api.getAuditLogs(100);
      setAuditLogs(logs);
    } catch (err: any) {
      showToast('Failed to load audit logs.', 'error');
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  // Handle password change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New password and confirmation do not match.', 'error');
      return;
    }

    setChangingPass(true);
    try {
      await api.changePassword({
        currentPassword,
        newPassword,
      });
      showToast('Admin password updated successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err.message || 'Failed to change password.', 'error');
    } finally {
      setChangingPass(false);
    }
  };

  // Handle add payment method
  const handleAddPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMethodName.trim()) return;
    try {
      await api.createPaymentMethod({ name: newMethodName.trim(), status: 'Active' });
      showToast('Payment method added!', 'success');
      setNewMethodName('');
      loadSettingsData();
    } catch (err: any) {
      showToast(err.message || 'Failed to add payment method.', 'error');
    }
  };

  const handleDeletePaymentMethod = async (id: number) => {
    try {
      await api.deletePaymentMethod(id);
      showToast('Payment method removed.', 'success');
      loadSettingsData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete payment method.', 'error');
    }
  };

  // Handle add country
  const handleAddCountry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCountryName.trim() || !newCountryIso.trim()) {
      showToast('Country name and ISO code are required.', 'error');
      return;
    }
    try {
      await api.createCountry({
        name: newCountryName.trim(),
        iso_code: newCountryIso.trim().toUpperCase(),
        flag: newCountryFlag.trim() || '🌐',
        phone_code: newCountryPhone.trim() || '+00',
      });
      showToast('Country added to directory!', 'success');
      setNewCountryName('');
      setNewCountryIso('');
      setNewCountryFlag('');
      setNewCountryPhone('');
      loadSettingsData();
    } catch (err: any) {
      showToast(err.message || 'Failed to add country.', 'error');
    }
  };

  // Handle export backup
  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const res = await api.exportBackup();
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || `kbmax_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Database backup downloaded successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to export backup.', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Handle restore backup
  const handleRestoreBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreJsonInput.trim()) {
      showToast('Please paste backup JSON data to restore.', 'error');
      return;
    }

    if (!confirm('WARNING: Restoring will overwrite existing database records. Do you wish to continue?')) {
      return;
    }

    setRestoring(true);
    try {
      const res = await api.restoreBackup(restoreJsonInput.trim());
      showToast(res.message || 'Database restored successfully! Reloading...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      showToast(err.message || 'Failed to restore database.', 'error');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-emerald-400" />
          <span>System Settings & Administration</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage admin credentials, payment channels, country catalog, and full database backups
        </p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
        {[
          { id: 'security', label: 'Admin Security', icon: Lock },
          { id: 'templates', label: 'WhatsApp & SMS Templates', icon: MessageSquare },
          { id: 'payment_methods', label: 'Payment Methods', icon: CreditCard },
          { id: 'countries', label: 'Country Catalog', icon: Globe },
          { id: 'backup', label: 'Backup & Restore', icon: Database },
          { id: 'audit', label: 'Audit Trail', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab: WhatsApp & SMS Templates */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Editor Column */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>WhatsApp Payment Confirmation SMS Template</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    پیمنٹ سینڈ کرنے کے بعد کسٹمر کو جانے والا واٹس ایپ میسج — آپ خود کسٹمائز کر سکتے ہیں
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetPaymentTemplate}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>
              </div>

              {/* Dynamic Tokens Toolbar */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Insert Dynamic Variables / ٹیگز داخل کریں
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: '{{date_range}}', label: '📅 Date Range (24 AUG → 31 AUG 2026)' },
                    { tag: '{{client_name}}', label: '👤 Client Name' },
                    { tag: '{{amount}}', label: '💰 Amount (Rs.)' },
                    { tag: '{{currency}}', label: '💵 Currency (PKR)' },
                    { tag: '{{payment_method}}', label: '💳 Payment Channel' },
                    { tag: '{{payment_details}}', label: '📝 Account Number / IBAN' },
                  ].map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => setPaymentConfTemplate((prev) => prev + ` ${t.tag}`)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-slate-800 hover:border-emerald-500/40 transition cursor-pointer font-mono"
                      title={`Click to append ${t.tag}`}
                    >
                      + {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Editor */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Template Content (Live Editor)
                </label>
                <textarea
                  value={paymentConfTemplate}
                  onChange={(e) => setPaymentConfTemplate(e.target.value)}
                  rows={14}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-2xl p-4 text-xs font-mono text-slate-100 leading-relaxed outline-none shadow-inner resize-y"
                  placeholder="Paste or write your custom template..."
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 font-mono">
                  <span>{paymentConfTemplate.split('\n').length} lines</span>
                  <span>{paymentConfTemplate.length} characters</span>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSavePaymentTemplate}
                  disabled={savingTemplate}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  {savingTemplate ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      <span>Saving Template...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Template as System Default</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live WhatsApp Preview Column */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col">
              <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Live WhatsApp Bubble Preview</span>
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Sample Output
                </span>
              </div>

              <p className="text-xs text-slate-400">
                This is how the SMS message will appear inside the recipient's WhatsApp chat with simulated client data:
              </p>

              {/* WhatsApp Mock Chat Bubble */}
              <div className="bg-[#0b141a] rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-inner flex-1 flex flex-col justify-center">
                <div className="bg-[#005c4b] text-white p-4 rounded-2xl rounded-tr-none shadow-lg relative font-sans text-xs leading-relaxed whitespace-pre-wrap selection:bg-emerald-300 selection:text-black">
                  {compilePaymentConfirmationMessage({
                    template: paymentConfTemplate,
                    startDate: '2026-08-24',
                    endDate: '2026-08-31',
                    clientName: 'Ali Khan',
                    amount: 85400,
                    currencySymbol: 'Rs.',
                    currency: 'PKR',
                    paymentMethod: 'JazzCash / Bank',
                  })}
                  <div className="text-[10px] text-emerald-200/80 text-right mt-2 flex items-center justify-end gap-1">
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <CheckCircle2 className="w-3 h-3 text-sky-300 inline" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: Security & Password Change */}
      {activeTab === 'security' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm max-w-xl space-y-5">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Change Admin Master Password</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Secure scrypt key derivation function protects the master login credential
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Current Password
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                New Master Password
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Confirm New Password
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPass ? 'Hide Passwords' : 'Show Passwords'}</span>
              </button>

              <button
                type="submit"
                disabled={changingPass}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/50 flex items-center gap-2 cursor-pointer"
              >
                {changingPass ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Payment Methods Master */}
      {activeTab === 'payment_methods' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm max-w-2xl space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Registered Payout Channels</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Channels available when registering client payout profiles
            </p>
          </div>

          <form onSubmit={handleAddPaymentMethod} className="flex gap-2">
            <input
              type="text"
              value={newMethodName}
              onChange={(e) => setNewMethodName(e.target.value)}
              placeholder="e.g. Nayapay, Sadapay, Binance Pay..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Method</span>
            </button>
          </form>

          <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
            {paymentMethods.map((pm) => (
              <div key={pm.id} className="p-3.5 bg-slate-950/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold text-white">{pm.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                    {pm.status}
                  </span>
                  <button
                    onClick={() => handleDeletePaymentMethod(pm.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 transition-colors"
                    title="Remove method"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Countries Catalog */}
      {activeTab === 'countries' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>Country Catalog & Dial Codes</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Master country list used across panels and SMS rate tables
            </p>
          </div>

          {/* Add Country Form */}
          <form onSubmit={handleAddCountry} className="grid grid-cols-1 sm:grid-cols-5 gap-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Flag Emoji</label>
              <input
                type="text"
                value={newCountryFlag}
                onChange={(e) => setNewCountryFlag(e.target.value)}
                placeholder="🇹🇿"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] text-slate-400 mb-1">Country Name</label>
              <input
                type="text"
                value={newCountryName}
                onChange={(e) => setNewCountryName(e.target.value)}
                placeholder="e.g. Tanzania"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 mb-1">ISO Code</label>
              <input
                type="text"
                value={newCountryIso}
                onChange={(e) => setNewCountryIso(e.target.value)}
                placeholder="TZ"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none uppercase font-mono"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Country</span>
              </button>
            </div>
          </form>

          {/* Countries Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {countries.map((c) => (
              <div
                key={c.id}
                className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center gap-3"
              >
                <span className="text-2xl leading-none">{c.flag || '🌐'}</span>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-white truncate block">{c.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">{c.iso_code} • {c.phone_code}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Database Backup & Restore */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Export Database Snapshot</h3>
                <p className="text-xs text-slate-400">Download complete SQLite data & tables as JSON</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              Includes all clients, panel configurations, historical billing records, rate snapshots, and WhatsApp logs.
            </p>

            <button
              onClick={handleExportBackup}
              disabled={exporting}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Generating Snapshot...' : 'Download Full Backup (.json)'}</span>
            </button>
          </div>

          {/* Restore Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Restore from Backup</h3>
                <p className="text-xs text-slate-400">Paste raw backup JSON to overwrite database</p>
              </div>
            </div>

            <form onSubmit={handleRestoreBackup} className="space-y-3">
              <textarea
                value={restoreJsonInput}
                onChange={(e) => setRestoreJsonInput(e.target.value)}
                rows={4}
                placeholder="Paste backup JSON payload here..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono outline-none focus:border-amber-500 resize-none"
              />

              <button
                type="submit"
                disabled={restoring}
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-amber-950/60 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{restoring ? 'Restoring...' : 'Validate & Restore Database'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 5: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>System Activity & Audit Trail</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time security log of all admin operations and database modifications
              </p>
            </div>

            <button
              onClick={loadAuditLogs}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800 max-h-[500px] overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 bg-slate-950/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <div>
                    <span className="font-semibold text-white">{log.action}</span>
                    <span className="text-slate-400 block text-[11px] font-mono">{log.details}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500">{log.created_at}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Menu, PlusCircle, LogOut, Shield, ChevronDown, Calendar, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ActiveTab } from './Sidebar';

interface TopBarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  setMobileOpen: (open: boolean) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  setMobileOpen,
  onRefresh,
  refreshing,
}) => {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  const getPageDetails = () => {
    switch (activeTab) {
      case 'dashboard':
        return { title: 'Admin Dashboard', subtitle: 'Overview & system telemetry' };
      case 'pending_records':
        return { title: 'Pending Records & Dispatch', subtitle: 'Unsent WhatsApp slips and awaiting weekly payments' };
      case 'clients':
        return { title: 'Client Management', subtitle: 'Registered SMS clients & payment profiles' };
      case 'panel_rates':
        return { title: 'SMS Panels & Country Rates', subtitle: 'Configure fixed rates per country and panel' };
      case 'add_record':
        return { title: 'Add Weekly SMS Record', subtitle: 'Automatic billing calculation and slip generator' };
      case 'client_history':
        return { title: 'Client History / SMS Archive', subtitle: 'Chronological client billing history and slips' };
      case 'whatsapp':
        return { title: 'WhatsApp Dispatch Hub', subtitle: 'Payment slips and confirmation message logs' };
      case 'settings':
        return { title: 'System Settings', subtitle: 'Admin account, templates, database backup & audit logs' };
      default:
        return { title: 'KB MAX SMS System', subtitle: 'Admin Portal' };
    }
  };

  const details = getPageDetails();

  return (
    <header className="h-16 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8">
      {/* Left side: Hamburger + Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden transition-colors"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate leading-tight flex items-center gap-2">
            <span>{details.title}</span>
          </h1>
          <p className="text-xs text-slate-400 hidden sm:block truncate">
            {details.subtitle}
          </p>
        </div>
      </div>

      {/* Right side: Action Controls & User Menu */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Weekly Billing Notice Tag */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-medium text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
          <span>Billing Cycle: <strong className="text-emerald-400">Weekly</strong> (Mon → Sun)</span>
        </div>

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        )}

        {/* Quick Add Record CTA */}
        {activeTab !== 'add_record' && (
          <button
            onClick={() => setActiveTab('add_record')}
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/50 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Record</span>
          </button>
        )}

        {/* Admin Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-medium hidden md:inline truncate max-w-[100px]">
              {user?.username || 'Admin'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* Dropdown Menu */}
          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-xl py-2 z-40 animate-fadeIn">
                <div className="px-4 py-2 border-b border-slate-800">
                  <p className="text-xs font-semibold text-white truncate">{user?.name || 'KB MAX Admin'}</p>
                  <p className="text-[11px] text-slate-400 truncate">@{user?.username || 'admin'}</p>
                </div>

                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setProfileOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                >
                  <span>Account & Password Settings</span>
                </button>

                <div className="border-t border-slate-800 my-1" />

                <button
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-rose-950/30 flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

import React, { useState } from 'react';
import {
  Menu,
  PlusCircle,
  LogOut,
  Shield,
  ChevronDown,
  Calendar,
  RefreshCw,
  Sun,
  Moon,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme, Theme } from '../../context/ThemeContext';
import { ActiveTab } from './Sidebar';

interface TopBarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  collapsed = false,
  setCollapsed,
  setMobileOpen,
  onRefresh,
  refreshing,
}) => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

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

  const themes: { id: Theme; label: string; icon: any }[] = [
    { id: 'dark', label: 'Dark Mode', icon: Moon },
    { id: 'light', label: 'Light Mode', icon: Sun },
    { id: 'midnight', label: 'Midnight OLED', icon: Sparkles },
  ];

  const currentThemeObj = themes.find((t) => t.id === theme) || themes[0];
  const ThemeIcon = currentThemeObj.icon;

  return (
    <header
      className={`h-16 border-b sticky top-0 z-30 flex items-center justify-between px-3 sm:px-6 transition-colors duration-200 ${
        theme === 'light'
          ? 'bg-white/95 border-slate-200 text-slate-800 shadow-sm'
          : theme === 'midnight'
          ? 'bg-black/90 border-slate-800 text-slate-100 backdrop-blur-md'
          : 'bg-slate-900/90 border-slate-800 text-slate-100 backdrop-blur-md'
      }`}
    >
      {/* Left side: Hamburger / Sidebar Toggle + Page Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Toggle Button */}
        <button
          onClick={() => setMobileOpen(true)}
          className={`p-2 rounded-xl lg:hidden transition-colors ${
            theme === 'light'
              ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          aria-label="Open Navigation Menu"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Sidebar Toggle Button */}
        {setCollapsed && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`hidden lg:flex p-2 rounded-xl transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={collapsed ? 'Show Full Sidebar' : 'Hide Sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-5 h-5 text-emerald-500" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        )}

        <div className="flex flex-col min-w-0">
          <h1
            className={`text-sm sm:text-base md:text-lg font-bold tracking-tight truncate leading-tight flex items-center gap-2 ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}
          >
            <span>{details.title}</span>
          </h1>
          <p
            className={`text-[11px] hidden sm:block truncate ${
              theme === 'light' ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            {details.subtitle}
          </p>
        </div>
      </div>

      {/* Right side: Action Controls, Theme Switcher & User Menu */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Weekly Billing Notice Tag */}
        <div
          className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${
            theme === 'light'
              ? 'bg-slate-100 border-slate-200 text-slate-700'
              : 'bg-slate-800/80 border-slate-700/60 text-slate-300'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-emerald-500" />
          <span>
            Billing: <strong className="text-emerald-500">Weekly</strong> (Mon → Sun)
          </span>
        </div>

        {/* Theme Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setThemeMenuOpen(!themeMenuOpen)}
            className={`flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border transition-all cursor-pointer ${
              theme === 'light'
                ? 'bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-700'
                : 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-300'
            }`}
            title="Switch Theme (Dark, Light, Midnight)"
          >
            <ThemeIcon className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium hidden md:inline capitalize">{theme}</span>
            <ChevronDown className="w-3 h-3 opacity-60 hidden sm:block" />
          </button>

          {themeMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setThemeMenuOpen(false)}
              />
              <div
                className={`absolute right-0 mt-2 w-44 rounded-xl shadow-xl py-1.5 z-40 border animate-fadeIn ${
                  theme === 'light'
                    ? 'bg-white border-slate-200 text-slate-800 shadow-slate-200'
                    : 'bg-slate-900 border-slate-800 text-slate-200 shadow-2xl'
                }`}
              >
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Select Theme
                </div>
                {themes.map((t) => {
                  const Icon = t.icon;
                  const isSelected = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTheme(t.id);
                        setThemeMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/15 text-emerald-500 font-bold'
                          : theme === 'light'
                          ? 'hover:bg-slate-100 text-slate-700'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5" />
                        <span>{t.label}</span>
                      </div>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`p-2 rounded-xl transition-colors border cursor-pointer ${
              theme === 'light'
                ? 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border-slate-200'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border-slate-700'
            }`}
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        )}

        {/* Quick Add Record CTA */}
        {activeTab !== 'add_record' && (
          <button
            onClick={() => setActiveTab('add_record')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Record</span>
          </button>
        )}

        {/* Admin Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className={`flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border transition-colors cursor-pointer ${
              theme === 'light'
                ? 'bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-800'
                : 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-200'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center font-bold text-xs">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-medium hidden md:inline truncate max-w-[100px]">
              {user?.username || 'Admin'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60 hidden sm:block" />
          </button>

          {/* Profile Dropdown Menu */}
          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setProfileOpen(false)}
              />
              <div
                className={`absolute right-0 mt-2 w-56 rounded-xl shadow-2xl py-2 z-40 border animate-fadeIn ${
                  theme === 'light'
                    ? 'bg-white border-slate-200 text-slate-800'
                    : 'bg-slate-900 border-slate-800 text-slate-100'
                }`}
              >
                <div className={`px-4 py-2 border-b ${theme === 'light' ? 'border-slate-100' : 'border-slate-800'}`}>
                  <p className={`text-xs font-semibold truncate ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                    {user?.name || 'KB MAX Admin'}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">@{user?.username || 'admin'}</p>
                </div>

                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setProfileOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 cursor-pointer ${
                    theme === 'light' ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <span>Account & PIN Settings</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('whatsapp');
                    setProfileOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 cursor-pointer ${
                    theme === 'light' ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <span>WhatsApp Dispatch Hub</span>
                </button>

                <div className={`border-t my-1 ${theme === 'light' ? 'border-slate-100' : 'border-slate-800'}`} />

                <button
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer"
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


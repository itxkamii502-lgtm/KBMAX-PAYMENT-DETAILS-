import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Sliders,
  PlusCircle,
  History,
  MessageSquare,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Cpu,
  X,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../api/client';

export type ActiveTab =
  | 'dashboard'
  | 'pending_records'
  | 'clients'
  | 'panel_rates'
  | 'add_record'
  | 'client_history'
  | 'whatsapp'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const { logout, user } = useAuth();
  const { theme } = useTheme();
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    // Fetch pending count for the badge
    const loadPendingCount = async () => {
      try {
        const stats = await api.getDashboardStats();
        if (stats && typeof stats.pendingPaymentsCount === 'number') {
          setPendingCount(stats.pendingPaymentsCount);
        }
      } catch {
        // silent fallback
      }
    };
    loadPendingCount();
    const interval = setInterval(loadPendingCount, 15000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const menuItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard, badge: null },
    {
      id: 'pending_records' as ActiveTab,
      label: 'Pending Records',
      icon: Clock,
      badge: pendingCount && pendingCount > 0 ? `${pendingCount}` : null,
      badgeVariant: 'amber',
    },
    { id: 'clients' as ActiveTab, label: 'Clients', icon: Users, badge: null },
    { id: 'panel_rates' as ActiveTab, label: 'Panel Rates', icon: Sliders, badge: null },
    { id: 'add_record' as ActiveTab, label: 'Add Record', icon: PlusCircle, highlight: true },
    { id: 'client_history' as ActiveTab, label: 'Client History', icon: History, badge: null },
    { id: 'whatsapp' as ActiveTab, label: 'WhatsApp', icon: MessageSquare, badge: 'Hub' },
    { id: 'settings' as ActiveTab, label: 'Settings', icon: Settings, badge: null },
  ];

  const handleSelect = (id: ActiveTab) => {
    setActiveTab(id);
    if (mobileOpen) {
      setMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="main-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r transition-all duration-300 ease-in-out ${
          collapsed ? 'w-20' : 'w-64'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-700 shadow-lg lg:shadow-none'
            : theme === 'midnight'
            ? 'bg-black border-slate-800/80 text-slate-200'
            : 'bg-slate-900 border-slate-800 text-slate-200'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div
          className={`h-16 flex items-center justify-between px-4 border-b shrink-0 ${
            theme === 'light' ? 'border-slate-200' : 'border-slate-800'
          }`}
        >
          <div
            className="flex items-center gap-3 cursor-pointer overflow-hidden"
            onClick={() => handleSelect('dashboard')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-white shrink-0 shadow-md shadow-emerald-950/40">
              <Cpu className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span
                  className={`font-bold tracking-tight leading-none text-base truncate ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  KB MAX
                </span>
                <span className="text-[10px] text-emerald-500 font-semibold tracking-wider uppercase mt-1 truncate">
                  SMS & Billing Hub
                </span>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className={`p-1.5 rounded-lg lg:hidden transition-colors ${
              theme === 'light'
                ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`hidden lg:flex p-1.5 rounded-lg transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 scrollbar-thin">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all relative group cursor-pointer ${
                  isActive
                    ? theme === 'light'
                      ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-300/60 shadow-xs'
                      : 'bg-emerald-600/15 text-emerald-300 font-semibold border border-emerald-500/30 shadow-xs'
                    : item.highlight
                    ? theme === 'light'
                      ? 'text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100/80'
                      : 'text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/30 hover:text-emerald-300'
                    : theme === 'light'
                    ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    isActive
                      ? 'text-emerald-500'
                      : item.highlight
                      ? 'text-emerald-500'
                      : theme === 'light'
                      ? 'text-slate-500 group-hover:text-slate-800'
                      : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />

                {!collapsed && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}

                {!collapsed && item.badge && (
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md border ${
                      item.badgeVariant === 'amber'
                        ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                        : 'bg-sky-500/20 text-sky-500 border-sky-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Active Indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-500 rounded-r-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Admin Info & Logout */}
        <div
          className={`p-3 border-t shrink-0 ${
            theme === 'light' ? 'border-slate-200' : 'border-slate-800'
          }`}
        >
          {!collapsed && (
            <div
              className={`flex items-center gap-3 px-2.5 py-2 mb-2 rounded-xl border ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold text-xs shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span
                  className={`text-xs font-semibold truncate ${
                    theme === 'light' ? 'text-slate-800' : 'text-white'
                  }`}
                >
                  {user?.name || 'Administrator'}
                </span>
                <span className="text-[10px] text-slate-400 truncate">
                  @{user?.username || 'admin'}
                </span>
              </div>
            </div>
          )}

          <button
            id="sidebar-logout-btn"
            onClick={logout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer`}
            title="Log Out"
          >
            <LogOut className="w-5 h-5 shrink-0 text-rose-500" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};


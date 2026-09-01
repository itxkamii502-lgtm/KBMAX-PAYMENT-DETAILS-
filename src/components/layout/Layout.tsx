import React, { useState, useEffect } from 'react';
import { Sidebar, ActiveTab } from './Sidebar';
import { TopBar } from './TopBar';
import {
  LayoutDashboard,
  Clock,
  PlusCircle,
  Users,
  Menu,
  MessageSquare,
} from 'lucide-react';
import { api } from '../../api/client';

interface LayoutProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  activeTab,
  setActiveTab,
  onRefresh,
  refreshing,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const stats = await api.getDashboardStats();
        if (stats && typeof stats.pendingPaymentsCount === 'number') {
          setPendingCount(stats.pendingPaymentsCount);
        }
      } catch {
        // ignore
      }
    };
    fetchCount();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Fixed Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          collapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <TopBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setMobileOpen={setMobileOpen}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />

        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl w-full mx-auto animate-fadeIn">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Exclusive for touch / phones) */}
      <nav
        id="mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-800 backdrop-blur-xl flex items-center justify-around py-2 px-2 lg:hidden shadow-2xl"
      >
        {/* Dashboard */}
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition min-h-[44px] cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-emerald-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Home</span>
        </button>

        {/* Pending Records */}
        <button
          type="button"
          onClick={() => setActiveTab('pending_records')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition min-h-[44px] cursor-pointer relative ${
            activeTab === 'pending_records'
              ? 'text-amber-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Clock className="w-5 h-5" />
            {pendingCount && pendingCount > 0 ? (
              <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full flex items-center justify-center animate-pulse">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            ) : null}
          </div>
          <span className="text-[10px] mt-0.5">Pending</span>
        </button>

        {/* Add Record (Prominent Center Button) */}
        <button
          type="button"
          onClick={() => setActiveTab('add_record')}
          className="flex flex-col items-center justify-center -mt-5 min-h-[50px] cursor-pointer group"
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-950 transition-all ${
              activeTab === 'add_record'
                ? 'bg-emerald-500 text-white scale-110 ring-4 ring-emerald-500/30'
                : 'bg-emerald-600 group-hover:bg-emerald-500 text-white'
            }`}
          >
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-emerald-400 mt-1">Add Record</span>
        </button>

        {/* Clients */}
        <button
          type="button"
          onClick={() => setActiveTab('clients')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition min-h-[44px] cursor-pointer ${
            activeTab === 'clients'
              ? 'text-emerald-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Clients</span>
        </button>

        {/* More Menu Drawer Trigger */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-400 hover:text-slate-200 transition min-h-[44px] cursor-pointer"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Menu</span>
        </button>
      </nav>
    </div>
  );
};

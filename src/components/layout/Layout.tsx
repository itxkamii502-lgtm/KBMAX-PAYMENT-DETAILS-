import React, { useState, useEffect } from 'react';
import { Sidebar, ActiveTab } from './Sidebar';
import { TopBar } from './TopBar';
import { useTheme } from '../../context/ThemeContext';
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
  const { theme } = useTheme();

  return (
    <div
      className={`min-h-screen flex flex-col selection:bg-emerald-500 selection:text-white transition-colors duration-200 ${
        theme === 'light'
          ? 'bg-slate-100 text-slate-800'
          : theme === 'midnight'
          ? 'bg-[#030712] text-slate-100'
          : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Sidebar Navigation */}
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
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          setMobileOpen={setMobileOpen}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />

        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-8 max-w-7xl w-full mx-auto animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginView } from './components/auth/LoginView';
import { Layout } from './components/layout/Layout';
import { ActiveTab } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { ClientsView } from './components/clients/ClientsView';
import { PanelsView } from './components/panels/PanelsView';
import { AddRecordView } from './components/records/AddRecordView';
import { PendingRecordsView } from './components/records/PendingRecordsView';
import { ClientHistoryView } from './components/history/ClientHistoryView';
import { WhatsAppView } from './components/whatsapp/WhatsAppView';
import { SettingsView } from './components/settings/SettingsView';
import { Client } from './types';

const MainApp: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [targetClientForRecord, setTargetClientForRecord] = useState<Client | null>(null);
  const [targetClientForHistory, setTargetClientForHistory] = useState<Client | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium font-mono text-emerald-400">Initializing KB MAX Security...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleViewClientHistory = (client: Client) => {
    setTargetClientForHistory(client);
    setActiveTab('client_history');
  };

  const handleAddRecordForClient = (client: Client) => {
    setTargetClientForRecord(client);
    setActiveTab('add_record');
  };

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onRefresh={handleRefresh}
      refreshing={refreshing}
    >
      <div key={refreshKey} className="w-full">
        {activeTab === 'dashboard' && (
          <DashboardView
            setActiveTab={setActiveTab}
            onSelectClientForRecord={handleAddRecordForClient}
          />
        )}

        {activeTab === 'pending_records' && (
          <PendingRecordsView
            setActiveTab={setActiveTab}
            onAddRecordForClient={handleAddRecordForClient}
          />
        )}

        {activeTab === 'clients' && (
          <ClientsView
            onViewHistory={handleViewClientHistory}
            onAddRecordForClient={handleAddRecordForClient}
          />
        )}

        {activeTab === 'panel_rates' && <PanelsView />}

        {activeTab === 'add_record' && (
          <AddRecordView
            initialClient={targetClientForRecord}
            onRecordCreated={() => {
              setTargetClientForRecord(null);
            }}
          />
        )}

        {activeTab === 'client_history' && (
          <ClientHistoryView
            initialClient={targetClientForHistory}
            onAddRecordForClient={handleAddRecordForClient}
          />
        )}

        {activeTab === 'whatsapp' && <WhatsAppView />}

        {activeTab === 'settings' && <SettingsView />}
      </div>
    </Layout>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;

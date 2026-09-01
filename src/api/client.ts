import { AdminUser, BillingRecord, Client, Country, DashboardStats, Panel, PanelCountryRate, PaymentMethod, SystemSettings, WhatsAppMessage, AuditLog } from '../types';

const API_BASE = '/api';

function getAuthToken(): string | null {
  return localStorage.getItem('kbmax_admin_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('kbmax_admin_token', token);
  } else {
    localStorage.removeItem('kbmax_admin_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as any)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    setAuthToken(null);
    window.dispatchEvent(new CustomEvent('kbmax_unauthorized'));
    throw new Error('Session expired or unauthorized. Please log in again.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) =>
    request<{ success: boolean; token: string; user: AdminUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  getCurrentUser: () => request<{ user: AdminUser }>('/auth/me'),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Dashboard Stats
  getDashboardStats: () => request<DashboardStats>('/dashboard/stats'),

  // Clients
  getClients: (params?: { search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    return request<Client[]>(`/clients?${query.toString()}`);
  },

  getClientById: (id: number) => request<Client>(`/clients/${id}`),

  createClient: (client: Partial<Client>) =>
    request<Client>('/clients', {
      method: 'POST',
      body: JSON.stringify(client),
    }),

  updateClient: (id: number, client: Partial<Client>) =>
    request<Client>(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(client),
    }),

  deleteClient: (id: number) =>
    request<{ success: boolean; message: string }>(`/clients/${id}`, {
      method: 'DELETE',
    }),

  getClientHistory: (id: number) =>
    request<{ client: Client; records: BillingRecord[] }>(`/clients/${id}/history`),

  getClientNextPeriod: (id: number) =>
    request<{
      client_id: number;
      client_name: string;
      latestRecord: BillingRecord | null;
      nextStart: string;
      nextEnd: string;
      formatted: string;
    }>(`/clients/${id}/next-period`),

  // Panels
  getPanels: () => request<Panel[]>('/panels'),

  createPanel: (panel: { name: string; status?: string }) =>
    request<Panel>('/panels', {
      method: 'POST',
      body: JSON.stringify(panel),
    }),

  updatePanel: (id: number, panel: { name?: string; status?: string }) =>
    request<Panel>(`/panels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(panel),
    }),

  deletePanel: (id: number) =>
    request<{ success: boolean; message: string }>(`/panels/${id}`, {
      method: 'DELETE',
    }),

  // Panel Country Rates
  getPanelRates: (panelId: number) => request<PanelCountryRate[]>(`/panels/${panelId}/rates`),

  createPanelRate: (panelId: number, data: { country_id: number; rate: number; status?: string }) =>
    request<PanelCountryRate>(`/panels/${panelId}/rates`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePanelRate: (panelId: number, rateId: number, data: { rate?: number; status?: string }) =>
    request<PanelCountryRate>(`/panels/${panelId}/rates/${rateId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deletePanelRate: (panelId: number, rateId: number) =>
    request<{ success: boolean; message: string }>(`/panels/${panelId}/rates/${rateId}`, {
      method: 'DELETE',
    }),

  // Countries
  getCountries: () => request<Country[]>('/countries'),

  createCountry: (data: Partial<Country>) =>
    request<Country>('/countries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Payment Methods
  getPaymentMethods: () => request<PaymentMethod[]>('/payment-methods'),

  createPaymentMethod: (data: { name: string; status?: string }) =>
    request<PaymentMethod>('/payment-methods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePaymentMethod: (id: number, data: { name?: string; status?: string }) =>
    request<PaymentMethod>(`/payment-methods/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deletePaymentMethod: (id: number) =>
    request<{ success: boolean }>(`/payment-methods/${id}`, {
      method: 'DELETE',
    }),

  // Billing Records
  getBillingRecords: (params?: { search?: string; status?: string; client_id?: number; panel_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    if (params?.client_id) query.append('client_id', String(params.client_id));
    if (params?.panel_id) query.append('panel_id', String(params.panel_id));
    return request<BillingRecord[]>(`/billing-records?${query.toString()}`);
  },

  getBillingRecordById: (id: number) => request<BillingRecord>(`/billing-records/${id}`),

  createBillingRecord: (data: {
    client_id: number;
    panel_id?: number;
    billing_period_start: string;
    billing_period_end: string;
    billing_cycle?: string;
    payment_status?: string;
    payment_date?: string | null;
    clearance_date?: string | null;
    notes?: string;
    country_rows: { country_id: number; sms_count: number; rate?: number; panel_id?: number }[];
    force_duplicate?: boolean;
  }) =>
    request<BillingRecord>('/billing-records', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateBillingRecord: (id: number, data: any) =>
    request<BillingRecord>(`/billing-records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateBillingRecordStatus: (id: number, data: { payment_status: string; payment_date?: string | null }) =>
    request<{ success: boolean; payment_status: string; payment_date: string | null }>(
      `/billing-records/${id}/status`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  deleteBillingRecord: (id: number, pin: string) =>
    request<{ success: boolean; message: string }>(`/billing-records/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ pin }),
      headers: {
        'x-admin-pin': pin,
      },
    }),

  batchDeleteBillingRecords: (ids: number[], pin: string) =>
    request<{ success: boolean; message: string }>('/billing-records/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids, pin }),
      headers: {
        'x-admin-pin': pin,
      },
    }),

  // WhatsApp
  sendWhatsAppMessage: (data: {
    client_id?: number;
    billing_record_id?: number;
    message_type?: string;
    recipient_number: string;
    message_body: string;
  }) =>
    request<{
      success: boolean;
      messageId: number;
      status: string;
      directUrl: string;
      cleanNumber: string;
    }>('/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getWhatsAppMessages: () => request<WhatsAppMessage[]>('/whatsapp/messages'),

  // Settings & Backups
  getSettings: () => request<Record<string, string>>('/settings'),

  updateSettings: (settings: Record<string, string>) =>
    request<{ success: boolean; message: string }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  getAuditLogs: (limit = 100) => request<AuditLog[]>(`/audit-logs?limit=${limit}`),

  exportBackup: () => request<{ data: string; filename: string }>('/backup/export'),

  restoreBackup: (backupData: string) =>
    request<{ success: boolean; message: string }>('/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ backupData }),
    }),
};

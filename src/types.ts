export type PaymentStatus = 'Draft' | 'Record Added' | 'Payment Pending' | 'Payment Sent' | 'Payment Completed';

export type WhatsAppMessageStatus = 'Not Sent' | 'Sending' | 'Sent' | 'Failed' | 'Direct Link Generated';

export interface AdminUser {
  id: number;
  username: string;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethod {
  id: number;
  name: string;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
}

export interface Country {
  id: number;
  name: string;
  iso_code: string;
  phone_code: string;
  flag: string;
  status: 'Active' | 'Inactive';
  created_at?: string;
}

export interface Panel {
  id: number;
  name: string;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
  country_rates_count?: number;
}

export interface PanelCountryRate {
  id: number;
  panel_id: number;
  country_id: number;
  rate: number;
  status: 'Active' | 'Inactive';
  country_name?: string;
  iso_code?: string;
  phone_code?: string;
  flag?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: number;
  client_name: string;
  registration_date: string;
  payment_method_id: number;
  payment_method_name?: string;
  payment_details: string;
  whatsapp_number: string;
  additional_info: string;
  status: 'Active' | 'Inactive';
  total_weeks?: number;
  total_sms?: number;
  total_amount?: number;
  pending_amount?: number;
  created_at: string;
  updated_at: string;
}

export interface BillingRecordCountry {
  id?: number;
  billing_record_id?: number;
  country_id: number;
  country_name_snapshot: string;
  country_code_snapshot: string;
  flag_snapshot?: string;
  sms_count: number;
  rate_snapshot: number;
  country_total: number;
  panel_id?: number;
  panel_name_snapshot?: string;
  created_at?: string;
}

export interface BillingRecord {
  id: number;
  client_id: number;
  panel_id: number;
  client_name_snapshot: string;
  panel_name_snapshot: string;
  billing_period_start: string;
  billing_period_end: string;
  billing_cycle: string;
  total_sms: number;
  calculated_total: number;
  net_payable: number;
  payment_method_id: number;
  payment_method_name_snapshot: string;
  payment_details_snapshot: string;
  payment_status: PaymentStatus;
  payment_date?: string | null;
  clearance_date?: string | null;
  professional_slip?: string;
  simple_slip?: string;
  notes?: string;
  whatsapp_number_snapshot?: string;
  whatsapp_status?: WhatsAppMessageStatus;
  whatsapp_send_count?: number;
  whatsapp_sent_at?: string;
  countries?: BillingRecordCountry[];
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: number;
  client_id?: number | null;
  client_name?: string;
  billing_record_id?: number | null;
  message_type: 'Billing Slip' | 'Payment Completed' | 'Custom';
  recipient_number: string;
  message_body: string;
  provider_message_id?: string | null;
  status: WhatsAppMessageStatus;
  error_message?: string | null;
  sent_at?: string | null;
  created_at: string;
}

export interface SystemSettings {
  business_name: string;
  business_logo_url?: string;
  billing_cycle: string;
  default_clearance_day: string;
  currency: string;
  currency_symbol: string;
  slip_header: string;
  slip_footer: string;
  note_text: string;
  payment_confirmation_message: string;
  professional_slip_template: string;
  simple_slip_template: string;
  whatsapp_mode: 'direct_link' | 'cloud_api' | 'custom_gateway';
  whatsapp_phone_number_id?: string;
  whatsapp_business_account_id?: string;
  whatsapp_sender_number?: string;
  whatsapp_api_token?: string;
}

export interface AuditLog {
  id: number;
  admin_id?: number | null;
  admin_name?: string;
  action: string;
  target_type: string;
  target_id?: string | number | null;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalSms: number;
  totalBillingAmount: number;
  pendingPaymentsCount: number;
  pendingPaymentsAmount: number;
  completedPaymentsCount: number;
  completedPaymentsAmount: number;
  currentBillingWeek: {
    start: string;
    end: string;
    formatted: string;
  };
  recentRecords: BillingRecord[];
  panelStats: {
    panel_name: string;
    total_sms: number;
    total_revenue: number;
    records_count: number;
  }[];
  countryStats: {
    country_name: string;
    flag: string;
    total_sms: number;
    total_revenue: number;
  }[];
}

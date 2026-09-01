/**
 * Formats a start and end date into clean, standardized date range representation
 * e.g., '2026-08-24' and '2026-08-31' -> '24 AUG → 31 AUG 2026'
 */
export function formatPeriodDateRange(startStr?: string, endStr?: string): string {
  if (!startStr && !endStr) return '24 AUG → 31 AUG 2026';
  if (!startStr) return endStr || '';
  if (!endStr) return startStr || '';

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const parseDate = (dStr: string) => {
    if (!dStr) return null;
    const clean = String(dStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const parsed = new Date(clean);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const s = parseDate(startStr);
  const e = parseDate(endStr);

  if (s && e) {
    const sDay = s.getDate();
    const sMon = months[s.getMonth()];
    const sYear = s.getFullYear();

    const eDay = e.getDate();
    const eMon = months[e.getMonth()];
    const eYear = e.getFullYear();

    if (sYear === eYear) {
      return `${sDay} ${sMon} → ${eDay} ${eMon} ${eYear}`;
    } else {
      return `${sDay} ${sMon} ${sYear} → ${eDay} ${eMon} ${eYear}`;
    }
  }

  return `${startStr} → ${endStr}`;
}

export const DEFAULT_PAYMENT_CONFIRMATION_TEMPLATE = `╔══════════════════════════════════╗
💳 KBMAX PAYMENT
╚══════════════════════════════════╝

📅 {{date_range}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ YOUR PAYMENT HAS BEEN COMPLETED

💸 PAYMENT SENT SUCCESSFULLY

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❤️ Thank you for your hard work and support.

🔥 STAY ACTIVE • STAY STRONG
💎 KBMAX TEAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

export interface CompilePaymentMessageParams {
  template?: string;
  startDate?: string;
  endDate?: string;
  clientName?: string;
  amount?: number;
  currency?: string;
  currencySymbol?: string;
  paymentMethod?: string;
  paymentDetails?: string;
}

export function compilePaymentConfirmationMessage(params: CompilePaymentMessageParams): string {
  const tmpl = params.template?.trim() || DEFAULT_PAYMENT_CONFIRMATION_TEMPLATE;
  const dateRange = formatPeriodDateRange(params.startDate, params.endDate);
  const cur = params.currency || 'PKR';
  const sym = params.currencySymbol || 'Rs.';
  const amtFormatted = params.amount !== undefined ? (params.amount || 0).toLocaleString() : '0';

  let result = tmpl;

  // Replace tokens
  result = result.replace(/\{\{date_range\}\}/gi, dateRange);
  result = result.replace(/\{\{billing_period_start\}\}/gi, params.startDate || '');
  result = result.replace(/\{\{billing_period_end\}\}/gi, params.endDate || '');
  result = result.replace(/\{\{client_name\}\}/gi, params.clientName || 'Client');
  result = result.replace(/\{\{amount\}\}/gi, amtFormatted);
  result = result.replace(/\{\{currency\}\}/gi, cur);
  result = result.replace(/\{\{currency_symbol\}\}/gi, sym);
  result = result.replace(/\{\{payment_method\}\}/gi, params.paymentMethod || 'JazzCash / Bank');
  result = result.replace(/\{\{payment_details\}\}/gi, params.paymentDetails || 'N/A');

  return result;
}

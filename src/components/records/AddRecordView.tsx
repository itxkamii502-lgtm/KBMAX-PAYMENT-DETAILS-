import React, { useState, useEffect, useMemo } from 'react';
import { Client, Panel, PanelCountryRate, Country, BillingRecord } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { SlipModal } from '../slips/SlipModal';
import {
  PlusCircle,
  Calendar,
  Users,
  Globe,
  Trash2,
  Plus,
  Send,
  Copy,
  Check,
  FileText,
  CreditCard,
  Phone,
  Sparkles,
  Info,
  Clock,
  Layers,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CountryRowState {
  id: string; // unique internal row key
  country_id: number | '';
  sms_count: number | '';
  rate: number;
}

interface PanelBlockState {
  id: string;
  panel_id: number | '';
  country_rows: CountryRowState[];
}

interface AddRecordViewProps {
  initialClient?: Client | null;
  onRecordCreated?: (record: BillingRecord) => void;
}

// Helper to calculate Monday-Sunday of a given week offset
function getWeekRange(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = day === 0 ? -6 : 1 - day; // offset to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offsetWeeks * 7);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

// Calculate the Wednesday following the billing week
function getClearanceWednesday(endDateStr: string) {
  if (!endDateStr) return '';
  const end = new Date(endDateStr);
  const wednesday = new Date(end);
  wednesday.setDate(end.getDate() + 3); // Sunday + 3 days = Wednesday
  return wednesday.toISOString().split('T')[0];
}

export const AddRecordView: React.FC<AddRecordViewProps> = ({
  initialClient,
  onRecordCreated,
}) => {
  const { showToast } = useToast();

  // Master data
  const [clients, setClients] = useState<Client[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [allPanelRates, setAllPanelRates] = useState<Record<number, PanelCountryRate[]>>({});
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Client Selection
  const [selectedClientId, setSelectedClientId] = useState<number | ''>(
    initialClient?.id || ''
  );

  // Client latest history info & collision check
  const [clientHistory, setClientHistory] = useState<BillingRecord[]>([]);
  const [suggestedNextPeriod, setSuggestedNextPeriod] = useState<{
    nextStart: string;
    nextEnd: string;
    latestRecord: BillingRecord | null;
  } | null>(null);

  // Weekly Date Range
  const defaultWeek = useMemo(() => getWeekRange(0), []);
  const [startDate, setStartDate] = useState<string>(defaultWeek.start);
  const [endDate, setEndDate] = useState<string>(defaultWeek.end);
  const [clearanceDate, setClearanceDate] = useState<string>(
    getClearanceWednesday(defaultWeek.end)
  );

  const [billingCycle, setBillingCycle] = useState<string>('Haftawar (Weekly)');
  const [paymentStatus, setPaymentStatus] = useState<string>('Payment Pending');
  const [notes, setNotes] = useState<string>('');
  const [forceDuplicate, setForceDuplicate] = useState<boolean>(false);

  // Multi-Panel Structure State
  const [panelBlocks, setPanelBlocks] = useState<PanelBlockState[]>([
    {
      id: 'p1',
      panel_id: '',
      country_rows: [{ id: 'r1', country_id: '', sms_count: '', rate: 0 }],
    },
  ]);

  // Slip preview tab & modal
  const [slipTab, setSlipTab] = useState<'professional' | 'simple'>('professional');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdRecord, setCreatedRecord] = useState<BillingRecord | null>(null);

  // Load master data on mount
  useEffect(() => {
    async function load() {
      setLoadingInitial(true);
      try {
        const [clientsData, panelsData, countriesData] = await Promise.all([
          api.getClients({ status: 'Active' }),
          api.getPanels(),
          api.getCountries(),
        ]);
        const sortedClients = [...clientsData].sort((a, b) =>
          a.client_name.localeCompare(b.client_name, undefined, { sensitivity: 'base' })
        );
        setClients(sortedClients);
        setPanels(panelsData);
        setCountries(countriesData);

        const clientId = initialClient?.id || (sortedClients.length > 0 ? sortedClients[0].id : '');
        setSelectedClientId(clientId);

        const firstPanelId = panelsData.length > 0 ? panelsData[0].id : '';

        // Load rates for first panel
        if (firstPanelId) {
          const rates = await api.getPanelRates(firstPanelId);
          setAllPanelRates((prev) => ({ ...prev, [firstPanelId]: rates }));

          setPanelBlocks([
            {
              id: 'p1',
              panel_id: firstPanelId,
              country_rows: [{ id: 'r1', country_id: '', sms_count: '', rate: 0 }],
            },
          ]);
        }
      } catch (err: any) {
        showToast(err.message || 'Failed to load initial data.', 'error');
      } finally {
        setLoadingInitial(false);
      }
    }
    load();
  }, []);

  // When client changes, fetch latest period and history
  useEffect(() => {
    if (!selectedClientId) return;
    async function checkClient() {
      try {
        const [historyRes, nextRes] = await Promise.all([
          api.getClientHistory(Number(selectedClientId)),
          api.getClientNextPeriod(Number(selectedClientId)),
        ]);
        setClientHistory(historyRes.records || []);
        setSuggestedNextPeriod({
          nextStart: nextRes.nextStart,
          nextEnd: nextRes.nextEnd,
          latestRecord: nextRes.latestRecord,
        });

        // If client already has records, auto-advance to next week suggestion
        if (nextRes.latestRecord && nextRes.nextStart && nextRes.nextEnd) {
          setStartDate(nextRes.nextStart);
          setEndDate(nextRes.nextEnd);
          setClearanceDate(getClearanceWednesday(nextRes.nextEnd));
        }
      } catch (e) {
        // silent fallback
      }
    }
    checkClient();
  }, [selectedClientId]);

  // Load rates for a panel on demand if not loaded yet
  const ensurePanelRates = async (panelId: number) => {
    if (allPanelRates[panelId]) return allPanelRates[panelId];
    try {
      const rates = await api.getPanelRates(panelId);
      setAllPanelRates((prev) => ({ ...prev, [panelId]: rates }));
      return rates;
    } catch (e) {
      return [];
    }
  };

  // Check for duplicate date period
  const duplicateCollision = useMemo(() => {
    if (!selectedClientId || !startDate || !endDate) return null;
    return clientHistory.find(
      (r) => r.billing_period_start === startDate && r.billing_period_end === endDate
    );
  }, [selectedClientId, startDate, endDate, clientHistory]);

  // Handler to apply suggested next week
  const handleApplySuggestedWeek = () => {
    if (!suggestedNextPeriod) return;
    setStartDate(suggestedNextPeriod.nextStart);
    setEndDate(suggestedNextPeriod.nextEnd);
    setClearanceDate(getClearanceWednesday(suggestedNextPeriod.nextEnd));
    showToast(`Applied next billing period: ${suggestedNextPeriod.nextStart} ➔ ${suggestedNextPeriod.nextEnd}`, 'info');
  };

  // Panel Block Handlers
  const handleAddPanelBlock = async () => {
    const nextPanel = panels.find(
      (p) => !panelBlocks.some((b) => b.panel_id === p.id)
    ) || panels[0];

    const nextPanelId = nextPanel ? nextPanel.id : '';
    if (nextPanelId) {
      await ensurePanelRates(nextPanelId);
    }

    setPanelBlocks((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        panel_id: nextPanelId,
        country_rows: [{ id: Math.random().toString(36).substring(2, 9), country_id: '', sms_count: '', rate: 0 }],
      },
    ]);
  };

  const handleRemovePanelBlock = (blockId: string) => {
    if (panelBlocks.length === 1) {
      showToast('At least one panel is required.', 'error');
      return;
    }
    setPanelBlocks((prev) => prev.filter((b) => b.id !== blockId));
  };

  const handlePanelChange = async (blockId: string, panelId: number) => {
    const rates = await ensurePanelRates(panelId);
    setPanelBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          panel_id: panelId,
          country_rows: block.country_rows.map((row) => {
            if (!row.country_id) return row;
            const match = rates.find((r) => r.country_id === row.country_id);
            return {
              ...row,
              rate: match ? match.rate : row.rate || 0,
            };
          }),
        };
      })
    );
  };

  // "⚡ Select All Countries" button for a panel
  const handleSelectAllCountries = async (blockId: string) => {
    const block = panelBlocks.find((b) => b.id === blockId);
    if (!block || !block.panel_id) {
      showToast('Please select a panel first.', 'error');
      return;
    }

    const rates = (await ensurePanelRates(Number(block.panel_id))) || [];
    if (rates.length === 0) {
      showToast('No active country rates found for this panel. Please configure panel rates first.', 'error');
      return;
    }

    // Populate all countries configured in this panel
    const newRows: CountryRowState[] = rates.map((r) => ({
      id: Math.random().toString(36).substring(2, 9),
      country_id: r.country_id,
      sms_count: '',
      rate: r.rate,
    }));

    setPanelBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, country_rows: newRows } : b))
    );

    showToast(`Added all ${rates.length} configured countries for this panel!`, 'success');
  };

  // Add single country row in a panel block
  const handleAddCountryRow = (blockId: string) => {
    const block = panelBlocks.find((b) => b.id === blockId);
    if (!block) return;

    const rates = (block.panel_id ? allPanelRates[Number(block.panel_id)] : []) || [];
    const pickedCountryIds = new Set(block.country_rows.map((r) => r.country_id));

    // Prefer countries in panel rates not yet picked
    const availableRate = rates.find((r) => !pickedCountryIds.has(r.country_id));
    const nextCountryId = availableRate ? availableRate.country_id : (countries.find((c) => !pickedCountryIds.has(c.id))?.id || '');
    const initialRate = availableRate ? availableRate.rate : (rates.find((r) => r.country_id === nextCountryId)?.rate || 0);

    setPanelBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          country_rows: [
            ...b.country_rows,
            {
              id: Math.random().toString(36).substring(2, 9),
              country_id: nextCountryId,
              sms_count: '',
              rate: initialRate,
            },
          ],
        };
      })
    );
  };

  const handleRemoveCountryRow = (blockId: string, rowId: string) => {
    setPanelBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        if (b.country_rows.length === 1) {
          showToast('Each panel must have at least one country entry.', 'error');
          return b;
        }
        return {
          ...b,
          country_rows: b.country_rows.filter((r) => r.id !== rowId),
        };
      })
    );
  };

  const handleCountryChange = (blockId: string, rowId: string, countryId: number) => {
    const block = panelBlocks.find((b) => b.id === blockId);
    const rates = (block?.panel_id ? allPanelRates[Number(block.panel_id)] : []) || [];
    
    // Find explicit rate for the selected country
    let matchRate = rates.find((r) => r.country_id === countryId)?.rate;

    // If no explicit rate found for this country, fallback to 'Other all country' rate if panel has one
    if (matchRate === undefined) {
      const otherCountryObj = countries.find(
        (c) => c.iso_code === 'OTHER' || c.name.toLowerCase() === 'other all country'
      );
      if (otherCountryObj) {
        const otherRateObj = rates.find((r) => r.country_id === otherCountryObj.id);
        if (otherRateObj && otherRateObj.rate !== undefined) {
          matchRate = otherRateObj.rate;
        }
      }
    }

    setPanelBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          country_rows: b.country_rows.map((r) =>
            r.id === rowId ? { ...r, country_id: countryId, rate: matchRate !== undefined ? matchRate : 0 } : r
          ),
        };
      })
    );
  };

  const handleSmsCountChange = (blockId: string, rowId: string, value: string) => {
    const num = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
    setPanelBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          country_rows: b.country_rows.map((r) =>
            r.id === rowId ? { ...r, sms_count: num } : r
          ),
        };
      })
    );
  };

  const handleRateOverride = (blockId: string, rowId: string, value: string) => {
    const rateNum = value === '' ? 0 : Math.max(0, parseFloat(value) || 0);
    setPanelBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          country_rows: b.country_rows.map((r) =>
            r.id === rowId ? { ...r, rate: rateNum } : r
          ),
        };
      })
    );
  };

  // Selected client object
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  // Overall totals across all panel blocks
  const { totalSmsCount, calculatedTotalPkr, panelSubtotals } = useMemo(() => {
    let grandSms = 0;
    let grandPkr = 0;
    const subtotals: Record<string, { sms: number; pkr: number; panelName: string }> = {};

    panelBlocks.forEach((block) => {
      let bSms = 0;
      let bPkr = 0;
      const pObj = panels.find((p) => p.id === block.panel_id);
      const pName = pObj?.name || 'SMS PANEL';

      block.country_rows.forEach((row) => {
        const sms = Number(row.sms_count) || 0;
        const rate = Number(row.rate) || 0;
        const total = sms * rate;
        bSms += sms;
        bPkr += total;
      });

      subtotals[block.id] = { sms: bSms, pkr: bPkr, panelName: pName };
      grandSms += bSms;
      grandPkr += bPkr;
    });

    return {
      totalSmsCount: grandSms,
      calculatedTotalPkr: grandPkr,
      panelSubtotals: subtotals,
    };
  }, [panelBlocks, panels]);

  // Real-Time Live Slip Text Generator (Matches the exact prompt layout)
  const liveProfessionalSlip = useMemo(() => {
    if (!selectedClient) return 'Please select a client to preview slip.';

    const isMultiPanel = panelBlocks.length > 1;

    let bodyContent = '';

    if (!isMultiPanel) {
      const block = panelBlocks[0];
      const pObj = panels.find((p) => p.id === block?.panel_id);
      const rowsWithSms = block ? block.country_rows.filter((r) => r.country_id && (Number(r.sms_count) || 0) >= 0) : [];

      if (rowsWithSms.length === 0) {
        bodyContent = '*(No country SMS records added yet)*';
      } else {
        bodyContent = rowsWithSms
          .map((row) => {
            const country = countries.find((c) => c.id === row.country_id);
            const flag = country?.flag || '🌐';
            const name = country?.name || 'COUNTRY';
            const sms = Number(row.sms_count) || 0;
            const rate = Number(row.rate) || 0;
            const total = sms * rate;

            return `🌐 ${flag} ${name.toUpperCase()}
• Total SMS: ${sms.toLocaleString()} SMS
• Fixed Rate: Rs. ${rate.toFixed(2)} / SMS
• Country Total: Rs. ${total.toLocaleString()} PKR`;
          })
          .join('\n\n');
      }

      const pTitle = pObj ? pObj.name.toUpperCase() : 'KB MAX - LAMIX SMS PANAL';

      return `📋 KBMAX PAYMENT DETAILS
━━━━━━━━━━━━━━━━━━━━
👤 Client Name: ${selectedClient.client_name}
📅 Payment Period: ${startDate} ➔ ${endDate}
🔄 Billing Cycle: ${billingCycle}
━━━━━━━━━━━━━━━━━━━━
📱 PANEL: ${pTitle}
━━━━━━━━━━━━━━━━━━━━
${bodyContent}
━━━━━━━━━━━━━━━━━━━━
📊 TOTAL SMS COUNT: ${totalSmsCount.toLocaleString()} SMS
💰 CALCULATED TOTAL PKR: Rs. ${calculatedTotalPkr.toLocaleString()} PKR
━━━━━━━━━━━━━━━━━━━━
⏰ PAYMENT SCHEDULE:
📌 Monday to Sunday record payment is cleared on Wednesday
━━━━━━━━━━━━━━━━━━━━
💳 KBMAX PAYMENT DETAILS:
• Method: ${selectedClient.payment_method_name || 'JazzCash'}
• Details: ${selectedClient.payment_details || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
Thank you for your support! ❤️
Stay Active • Stay Strong 💯🔥`;
    } else {
      // Multi-Panel Format: all panels written together
      const blocksFormatted: string[] = [];

      panelBlocks.forEach((block, idx) => {
        const pObj = panels.find((p) => p.id === block.panel_id);
        const pName = pObj?.name || `PANEL ${idx + 1}`;
        const bSub = panelSubtotals[block.id] || { sms: 0, pkr: 0 };

        const cLines = block.country_rows
          .map((row) => {
            const country = countries.find((c) => c.id === row.country_id);
            const flag = country?.flag || '🌐';
            const name = country?.name || 'COUNTRY';
            const sms = Number(row.sms_count) || 0;
            const rate = Number(row.rate) || 0;
            const total = sms * rate;

            return `🌐 ${flag} ${name.toUpperCase()}
• Total SMS: ${sms.toLocaleString()} SMS
• Fixed Rate: Rs. ${rate.toFixed(2)} / SMS
• Country Total: Rs. ${total.toLocaleString()} PKR`;
          })
          .join('\n\n');

        blocksFormatted.push(
          `📱 PANEL ${idx + 1}: ${pName.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━
${cLines || '*(No countries entered)*'}
📊 Panel Subtotal: ${bSub.sms.toLocaleString()} SMS | Rs. ${bSub.pkr.toLocaleString()} PKR`
        );
      });

      return `📋 KBMAX PAYMENT DETAILS
━━━━━━━━━━━━━━━━━━━━
👤 Client Name: ${selectedClient.client_name}
📅 Payment Period: ${startDate} ➔ ${endDate}
🔄 Billing Cycle: ${billingCycle}
━━━━━━━━━━━━━━━━━━━━
${blocksFormatted.join('\n\n━━━━━━━━━━━━━━━━━━━━\n')}
━━━━━━━━━━━━━━━━━━━━
📊 TOTAL SMS COUNT: ${totalSmsCount.toLocaleString()} SMS
💰 CALCULATED TOTAL PKR: Rs. ${calculatedTotalPkr.toLocaleString()} PKR
━━━━━━━━━━━━━━━━━━━━
⏰ PAYMENT SCHEDULE:
📌 Monday to Sunday record payment is cleared on Wednesday
━━━━━━━━━━━━━━━━━━━━
💳 KBMAX PAYMENT DETAILS:
• Method: ${selectedClient.payment_method_name || 'JazzCash'}
• Details: ${selectedClient.payment_details || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
Thank you for your support! ❤️
Stay Active • Stay Strong 💯🔥`;
    }
  }, [
    selectedClient,
    panelBlocks,
    panels,
    countries,
    startDate,
    endDate,
    billingCycle,
    totalSmsCount,
    calculatedTotalPkr,
    panelSubtotals,
  ]);

  const liveSimpleSlip = useMemo(() => {
    if (!selectedClient) return 'Please select a client to preview slip.';
    return liveProfessionalSlip;
  }, [liveProfessionalSlip, selectedClient]);

  const activeSlipPreview = slipTab === 'professional' ? liveProfessionalSlip : liveSimpleSlip;

  const handleCopySlip = () => {
    navigator.clipboard.writeText(activeSlipPreview);
    setCopied(true);
    showToast('Slip copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  // Submit Handler
  const handleSubmit = async (andSendWhatsApp = false) => {
    if (!selectedClientId) {
      showToast('Please select a client.', 'error');
      return;
    }

    if (!startDate || !endDate) {
      showToast('Please select billing period start and end dates.', 'error');
      return;
    }

    if (duplicateCollision && !forceDuplicate) {
      showToast(
        `Duplicate period detected: A record (#${duplicateCollision.id}) already exists for ${startDate} ➔ ${endDate}. Please use Next Week or tick 'Allow Overwrite'.`,
        'error'
      );
      return;
    }

    // Flatten validated country rows across panels
    const flatCountryRows: {
      country_id: number;
      sms_count: number;
      rate: number;
      panel_id: number;
    }[] = [];

    for (const block of panelBlocks) {
      const pId = Number(block.panel_id);
      if (!pId) {
        showToast('Please select a panel for all panel blocks.', 'error');
        return;
      }

      for (const row of block.country_rows) {
        if (!row.country_id) continue;
        const sms = row.sms_count === '' ? 0 : Number(row.sms_count);
        if (sms < 0) {
          showToast('SMS count cannot be negative.', 'error');
          return;
        }

        flatCountryRows.push({
          country_id: Number(row.country_id),
          sms_count: sms,
          rate: Number(row.rate) || 0,
          panel_id: pId,
        });
      }
    }

    if (flatCountryRows.length === 0) {
      showToast('Please add at least one country with SMS count.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const primaryPanelId = panelBlocks[0]?.panel_id ? Number(panelBlocks[0].panel_id) : 1;

      const record = await api.createBillingRecord({
        client_id: Number(selectedClientId),
        panel_id: primaryPanelId,
        billing_period_start: startDate,
        billing_period_end: endDate,
        billing_cycle: billingCycle,
        payment_status: paymentStatus,
        clearance_date: clearanceDate,
        notes,
        country_rows: flatCountryRows,
        force_duplicate: forceDuplicate,
      });

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });

      showToast(`Billing Record #${record.id} created successfully!`, 'success');

      if (onRecordCreated) {
        onRecordCreated(record);
      }

      if (andSendWhatsApp) {
        // Prepare single WhatsApp dispatch
        const phone = record.whatsapp_number_snapshot || selectedClient?.whatsapp_number;
        if (phone) {
          const res = await api.sendWhatsAppMessage({
            client_id: record.client_id,
            billing_record_id: record.id,
            message_type: 'Billing Slip',
            recipient_number: phone,
            message_body: record.professional_slip || activeSlipPreview,
          });

          showToast('Opening WhatsApp dispatch...', 'success');
          if (res.directUrl) {
            window.open(res.directUrl, '_blank', 'noopener,noreferrer');
          }
        }
      }

      setCreatedRecord(record);
    } catch (err: any) {
      showToast(err.message || 'Failed to save billing record.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div id="add-record-loading" className="flex items-center justify-center p-12 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3"></div>
        Loading panel rates and client data...
      </div>
    );
  }

  return (
    <div id="add-record-view-container" className="space-y-6">
      {/* Header Banner */}
      <div
        id="add-record-header"
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800">
              Pro Billing Hub
            </span>
            <span className="text-xs text-slate-500 font-medium">Haftawar (Weekly) SMS Record</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Create Client SMS Billing Record
          </h1>
          <p className="text-sm text-slate-600">
            Select client, panel & countries. Rates calculate live into WhatsApp payment slips.
          </p>
        </div>

        {suggestedNextPeriod && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
            <Clock className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-xs">
              <div className="font-semibold text-emerald-900">Next Scheduled Week:</div>
              <div className="text-emerald-700 font-medium">{suggestedNextPeriod.nextStart} ➔ {suggestedNextPeriod.nextEnd}</div>
            </div>
            <button
              type="button"
              onClick={handleApplySuggestedWeek}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition"
            >
              Apply Week
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Record Creation Form (7 cols) */}
        <div className="xl:col-span-7 space-y-6">
          {/* 1. Client & Period Setup Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              1. Client & Billing Period
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Client <span className="text-rose-500">*</span>
                </label>
                <select
                  id="record-client-select"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {clients
                    .slice()
                    .sort((a, b) => a.client_name.localeCompare(b.client_name, undefined, { sensitivity: 'base' }))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.client_name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Billing Cycle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Billing Cycle
                </label>
                <input
                  type="text"
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl px-3.5 py-2.5"
                  placeholder="e.g. Haftawar (Weekly)"
                />
              </div>
            </div>

            {/* Selected Client Overview Badge */}
            {selectedClient && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold">{selectedClient.client_name}</span>
                  <span className="text-slate-500 font-mono">({selectedClient.whatsapp_number})</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-slate-600">
                    {selectedClient.payment_method_name || 'JazzCash'}: {selectedClient.payment_details || 'Default'}
                  </span>
                </div>
              </div>
            )}

            {/* Date Range Selection */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  Payment Period (Date-to-Date Protection)
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const range = getWeekRange(0);
                      setStartDate(range.start);
                      setEndDate(range.end);
                      setClearanceDate(getClearanceWednesday(range.end));
                    }}
                    className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                  >
                    Current Week
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const range = getWeekRange(1);
                      setStartDate(range.start);
                      setEndDate(range.end);
                      setClearanceDate(getClearanceWednesday(range.end));
                    }}
                    className="px-2.5 py-1 text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold rounded-lg transition"
                  >
                    +1 Week Ahead
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Start Date (Shuru Ki Tareekh)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    End Date (Akhiri Tareekh)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setClearanceDate(getClearanceWednesday(e.target.value));
                    }}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              {/* Duplicate Overlap Collision Warning */}
              {duplicateCollision && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-xs text-amber-900 mt-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 flex-1">
                    <div className="font-bold">⚠️ Date Range Collision (Duplicate Protection):</div>
                    <p>
                      Record <strong>#{duplicateCollision.id}</strong> has already been created for this client for{' '}
                      <strong>{startDate} ➔ {endDate}</strong>.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <label className="inline-flex items-center gap-1.5 text-xs text-amber-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={forceDuplicate}
                          onChange={(e) => setForceDuplicate(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>Allow Overwrite / Create Anyway</span>
                      </label>
                      {suggestedNextPeriod && (
                        <button
                          type="button"
                          onClick={handleApplySuggestedWeek}
                          className="underline text-emerald-700 hover:text-emerald-900 font-semibold ml-auto"
                        >
                          Switch to Next Week ({suggestedNextPeriod.nextStart})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Panels & Country Records Manager */}
          <div className="space-y-4">
            {panelBlocks.map((block, pIndex) => {
              const pSub = panelSubtotals[block.id] || { sms: 0, pkr: 0 };
              const currentPanel = panels.find((p) => p.id === block.panel_id);

              return (
                <div
                  key={block.id}
                  id={`panel-block-${block.id}`}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative"
                >
                  {/* Panel Block Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                        P{pIndex + 1}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          📱 Panel Name:
                        </span>
                        <select
                          value={block.panel_id}
                          onChange={(e) => handlePanelChange(block.id, Number(e.target.value))}
                          className="ml-2 font-bold text-slate-900 bg-emerald-50 border border-emerald-300 text-xs rounded-lg px-2.5 py-1 focus:ring-emerald-500"
                        >
                          {panels.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* "⚡ Select All Countries" button */}
                      <button
                        type="button"
                        onClick={() => handleSelectAllCountries(block.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl transition"
                        title="Add all active countries configured in this panel in 1-click"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        ⚡ Select All Countries
                      </button>

                      {panelBlocks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePanelBlock(block.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="Remove this panel"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Country Rows Table / Grid */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-500 px-2 uppercase tracking-wider">
                      <div className="col-span-5">Country (Mulk)</div>
                      <div className="col-span-3">Total SMS</div>
                      <div className="col-span-2 text-right">Fixed Rate</div>
                      <div className="col-span-2 text-right">Total PKR</div>
                    </div>

                    {block.country_rows.map((row) => {
                      const rowTotal = (Number(row.sms_count) || 0) * (Number(row.rate) || 0);

                      // Filter out countries chosen in other rows of this same panel block
                      const otherPickedIds = new Set(
                        block.country_rows
                          .filter((r) => r.id !== row.id && r.country_id)
                          .map((r) => Number(r.country_id))
                      );

                      const rates = (block.panel_id ? allPanelRates[Number(block.panel_id)] : []) || [];
                      const panelRateMap = new Map(rates.map((r) => [r.country_id, r.rate]));

                      const otherCountryObj = countries.find(
                        (c) => c.iso_code === 'OTHER' || c.name.toLowerCase() === 'other all country'
                      );
                      const otherRate = otherCountryObj ? panelRateMap.get(otherCountryObj.id) : undefined;

                      // Countries available for this specific row
                      const availableCountries = countries.filter(
                        (c) => !otherPickedIds.has(c.id)
                      );

                      return (
                        <div
                          key={row.id}
                          className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition"
                        >
                          {/* Country Selector */}
                          <div className="col-span-5">
                            <select
                              value={row.country_id}
                              onChange={(e) =>
                                handleCountryChange(block.id, row.id, Number(e.target.value))
                              }
                              className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-semibold rounded-lg px-2.5 py-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                            >
                              <option value="">-- Choose Country (Dunya ki Har Country / Other all country) --</option>
                              {availableCountries.map((c) => {
                                const isOther = c.iso_code === 'OTHER' || c.name.toLowerCase() === 'other all country';
                                const hasDirectRate = panelRateMap.has(c.id);
                                const fRate = panelRateMap.get(c.id);

                                let rateLabel = '';
                                if (hasDirectRate && fRate !== undefined) {
                                  rateLabel = `⚡ (Fixed: Rs. ${Number(fRate).toFixed(2)})`;
                                } else if (!isOther && otherRate !== undefined) {
                                  rateLabel = `⚡ (Default: Rs. ${Number(otherRate).toFixed(2)})`;
                                }

                                return (
                                  <option key={c.id} value={c.id}>
                                    {isOther ? '🌐 Other all country (Baqi Tamam Mumalik)' : `${c.flag || '🌐'} ${c.name} (${c.iso_code})`} {rateLabel}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* SMS Count Input */}
                          <div className="col-span-3">
                            <input
                              type="number"
                              min="0"
                              placeholder="0 SMS"
                              value={row.sms_count}
                              onChange={(e) =>
                                handleSmsCountChange(block.id, row.id, e.target.value)
                              }
                              className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-bold text-center rounded-lg px-2 py-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>

                          {/* Fixed Rate (PKR / SMS) */}
                          <div className="col-span-2">
                            <div className="relative">
                              <span className="absolute left-2 top-2 text-[10px] text-slate-400 font-semibold">
                                Rs.
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={row.rate}
                                onChange={(e) =>
                                  handleRateOverride(block.id, row.id, e.target.value)
                                }
                                className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-bold pl-7 pr-1 py-2 text-right rounded-lg focus:ring-emerald-500"
                                title="Fixed Rate per SMS"
                              />
                            </div>
                          </div>

                          {/* Line Total & Remove */}
                          <div className="col-span-2 flex items-center justify-end gap-1 text-right">
                            <span className="text-xs font-extrabold text-emerald-700">
                              Rs.{rowTotal.toLocaleString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCountryRow(block.id, row.id)}
                              className="text-slate-300 hover:text-rose-600 p-1 rounded transition"
                              title="Delete country row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Country Row & Subtotal Footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleAddCountryRow(block.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Another Country Row
                    </button>

                    <div className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg text-right">
                      {currentPanel?.name || 'Panel'} Subtotal:{' '}
                      <span className="text-emerald-700 font-black">
                        {pSub.sms.toLocaleString()} SMS | Rs. {pSub.pkr.toLocaleString()} PKR
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* "➕ Add Another Panel to This Bill" */}
            <button
              type="button"
              onClick={handleAddPanelBlock}
              className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              ➕ Add Another Panel to This Bill (Doosra Panel Add Karein)
            </button>
          </div>

          {/* Grand Totals & Payout Note Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Total SMS Count
                </span>
                <span className="text-2xl font-black text-slate-900">
                  {totalSmsCount.toLocaleString()} <span className="text-sm font-medium">SMS</span>
                </span>
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 sm:col-span-2">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
                  💰 Calculated Grand Total PKR
                </span>
                <span className="text-2xl font-black text-emerald-700">
                  Rs. {calculatedTotalPkr.toLocaleString()}{' '}
                  <span className="text-sm font-medium">PKR</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2"
                >
                  <option value="Payment Pending">Payment Pending (Clearance on Wednesday)</option>
                  <option value="Payment Completed">Payment Completed (Done & Transferred)</option>
                  <option value="Partial Payment">Partial Payment</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Admin Internal Note (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Cleared via JazzCash on Wednesday"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl px-3 py-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Real-Time Live WhatsApp Slip Preview (5 cols) */}
        <div className="xl:col-span-5 space-y-4">
          <div className="bg-slate-900 text-slate-100 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4 sticky top-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-sm text-white">
                  Live WhatsApp Slip Preview
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySlip}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Formatted Text Box */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-emerald-300 leading-relaxed whitespace-pre-wrap max-h-[520px] overflow-y-auto select-all">
              {activeSlipPreview}
            </div>

            {/* Anti-Ban Safety Notice & Direct Dispatch Buttons */}
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                Anti-Ban Safe Dispatch Protocol:
              </div>
              <p className="text-slate-400">
                Direct WhatsApp link sends to the selected client with human pacing to protect your number from spam bans.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Saving & Generating...' : 'Save & Open in WhatsApp (Single Send)'}
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition"
              >
                Save Record Only (Send Later)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Slip Modal Popup when saved */}
      {createdRecord && (
        <SlipModal
          record={createdRecord}
          onClose={() => setCreatedRecord(null)}
          onStatusUpdated={() => {
            if (onRecordCreated) onRecordCreated(createdRecord);
          }}
        />
      )}
    </div>
  );
};

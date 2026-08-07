import Modal from './Modal';
import { formatINR, formatDate, formatValidityRange } from '../lib/utils';
import { FileText, Receipt, PieChart, Clock, Calendar, CheckCircle2, DollarSign, Building, ShieldCheck } from 'lucide-react';

function DetailRow({ label, value, color = 'text-white' }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className={`text-xs font-bold font-mono ${color}`}>{value || '—'}</span>
    </div>
  );
}

function StatCard({ label, value, color = 'blue' }) {
  const cls = {
    blue: 'border-jio-blue-800/40 bg-jio-blue-900/30 text-jio-blue-400',
    green: 'border-emerald-800/40 bg-emerald-900/20 text-emerald-400',
    amber: 'border-amber-800/40 bg-amber-900/20 text-amber-400',
    cyan: 'border-cyan-800/40 bg-cyan-900/20 text-cyan-400',
    purple: 'border-purple-800/40 bg-purple-900/20 text-purple-400',
    rose: 'border-rose-800/40 bg-rose-900/20 text-rose-400',
  };
  return (
    <div className={`rounded-xl border p-3 ${cls[color]}`}>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-bold tracking-tight">{value}</p>
    </div>
  );
}

export default function SummaryModal({ row, onClose, expectedPaymentDate = null }) {
  if (!row) return null;

  // Determine Record Type (JMS vs Invoice vs Budget)
  const isInvoice = !!(row.inv_number || row.grand_total !== undefined || row.full_amount_received_date !== undefined);
  const isJms = !isInvoice && !!(row.jms_no || row.qsd_release_date !== undefined || row.a1_name !== undefined);
  const isBudget = !isInvoice && !isJms;

  const modalTitle = isInvoice
    ? `Invoice Details — ${row.inv_number || 'Record'}`
    : isJms
    ? `JMS Details — JMS #${row.jms_no || 'Record'}`
    : `Budget Work Order — WO #${row.work_order_number || 'Record'}`;

  return (
    <Modal open={!!row} onClose={onClose} title={modalTitle} size="max-w-2xl">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

        {/* ═══ INVOICE RECORD DETAILS VIEW ═══════════════════════ */}
        {isInvoice && (
          <>
            <div className="rounded-2xl border border-emerald-800/40 bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/30 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center justify-center">
                    <Receipt size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Invoice #{row.inv_number || 'N/A'}</h3>
                    <p className="text-xs text-slate-400">WO #{row.work_order_number || 'N/A'} · Site: {row.site || 'N/A'}</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                  {row.payment_status || 'Pending'}
                </span>
              </div>
            </div>

            {/* Quick Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Net Amount" value={formatINR(row.total)} color="blue" />
              <StatCard label="IGST (18%)" value={formatINR(row.igst)} color="purple" />
              <StatCard label="CGST + SGST" value={formatINR((row.cgst || 0) + (row.sgst || 0))} color="amber" />
              <StatCard label="Grand Total" value={formatINR(row.grand_total)} color="green" />
            </div>

            {/* Complete Key-Value Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <DetailRow label="Invoice Number" value={row.inv_number} />
              <DetailRow label="Invoice Date" value={formatDate(row.inv_date)} color="text-purple-300" />
              <DetailRow label="Expected Payment Date" value={formatDate(expectedPaymentDate)} color="text-amber-400" />
              <DetailRow label="JMS Number" value={row.jms_no} />
              <DetailRow label="Work Order Number" value={row.work_order_number} />
              <DetailRow label="GST Number" value={row.gst_no} />
              <DetailRow label="SAC Code" value={row.sac_code} />
              <DetailRow label="Site / Location" value={row.site} />
              <DetailRow label="Type of RO" value={row.type_of_ro} />
              <DetailRow label="RO Code" value={row.ro_code} />
              <DetailRow label="TDS" value={formatINR(row.tds)} />
              <DetailRow label="GST Deduction" value={formatINR(row.gst_amount_deduction)} />
              <DetailRow label="GST TDS 2% IOCL" value={formatINR(row.gst_tds_2pct_iocl)} />
              <DetailRow label="SD / Retention" value={formatINR(row.sd_retention)} />
              <DetailRow label="TCS / Credit Note" value={formatINR(row.tcs_credit_note)} />
              <DetailRow label="Received Bill Amount" value={formatINR(row.received_bill_amount)} color="text-emerald-400" />
              <DetailRow label="Full Amount Received Date" value={formatDate(row.full_amount_received_date || row.amount_received_date)} />
              <DetailRow label="GST Amount Received Date" value={formatDate(row.gst_amount_received_date)} />
            </div>

            {row.work_description && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <span className="text-slate-400 font-semibold block mb-1">Work Description:</span>
                <p className="text-slate-200 leading-relaxed">{row.work_description}</p>
              </div>
            )}
          </>
        )}

        {/* ═══ JMS RECORD DETAILS VIEW ═════════════════════════ */}
        {isJms && (
          <>
            <div className="rounded-2xl border border-purple-800/40 bg-gradient-to-br from-slate-900 via-slate-900/90 to-purple-950/30 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-950 text-purple-400 border border-purple-800/60 flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">JMS #{row.jms_no || 'N/A'}</h3>
                    <p className="text-xs text-slate-400">WO #{row.work_order_number || 'N/A'} · Site: {row.site || 'N/A'}</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-950 text-purple-300 border border-purple-700/60">
                  {row.status || 'Pending'}
                </span>
              </div>
            </div>

            {/* Quick Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Net Amount" value={formatINR(row.net_amount)} color="green" />
              <StatCard label="JMS Date" value={formatDate(row.jms_create_date || row.inv_date)} color="purple" />
              <StatCard label="Current Stage" value={row.status || 'Pending'} color="amber" />
            </div>

            {/* Key-Value Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <DetailRow label="JMS Number" value={row.jms_no} />
              <DetailRow label="JMS Date" value={formatDate(row.jms_create_date || row.inv_date)} color="text-purple-300" />
              <DetailRow label="Period of Work" value={row.period_of_work} />
              <DetailRow label="Work Order Number" value={row.work_order_number} />
              <DetailRow label="ARC Number" value={row.arc_number} />
              <DetailRow label="Net Amount" value={formatINR(row.net_amount)} color="text-emerald-400" />
              <DetailRow label="Site / Location" value={row.site} />
              <DetailRow label="RO Code" value={row.ro_code} />
              <DetailRow label="A1 Approver" value={row.a1_name} />
              <DetailRow label="A1 Release Date" value={formatDate(row.a1_release_date)} />
              <DetailRow label="A2 Approver" value={row.a2_name} />
              <DetailRow label="A2 Release Date" value={formatDate(row.a2_release_date)} />
              <DetailRow label="QSD Approver" value={row.qsd_name} />
              <DetailRow label="QSD Release Date" value={formatDate(row.qsd_release_date)} />
              <DetailRow label="A3 Approver" value={row.a3_name} />
              <DetailRow label="Invoice Number" value={row.inv_number} />
              <DetailRow label="Invoice Date" value={formatDate(row.inv_date)} />
              <DetailRow label="Payment Date" value={formatDate(row.payment_date)} color="text-emerald-400" />
            </div>

            {row.work_description && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <span className="text-slate-400 font-semibold block mb-1">Work Description:</span>
                <p className="text-slate-200 leading-relaxed">{row.work_description}</p>
              </div>
            )}
          </>
        )}

        {/* ═══ BUDGET RECORD DETAILS VIEW ═══════════════════════ */}
        {isBudget && (
          <>
            <div className="rounded-2xl border border-blue-800/40 bg-gradient-to-br from-slate-900 via-slate-900/90 to-blue-950/30 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-950 text-blue-400 border border-blue-800/60 flex items-center justify-center">
                    <PieChart size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">WO #{row.work_order_number || 'N/A'}</h3>
                    <p className="text-xs text-slate-400">Operation: {row.operation || 'N/A'} · ARC: {row.arc_number || 'N/A'}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  row.status === 'Closed' ? 'bg-purple-950 text-purple-300 border-purple-700/60' : 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                }`}>
                  {row.status === 'Closed' ? 'WO Closed' : 'Open (Active)'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="FO Total Budget" value={formatINR(row.fo_total_budget)} color="blue" />
              <StatCard label="Budget Consumed" value={formatINR(row.total_consumed)} color="rose" />
              <StatCard label="Remaining Balance" value={formatINR((row.fo_total_budget || 0) - (row.total_consumed || 0))} color="green" />
              <StatCard label="Timeframe" value={`${row.payment_timeframe_days || 30} Days`} color="purple" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <DetailRow label="Work Order Number" value={row.work_order_number} />
              <DetailRow label="Operation" value={row.operation} />
              <DetailRow label="ARC Number" value={row.arc_number} />
              <DetailRow label="Validity of Contract" value={formatValidityRange(row.validity_of_contract)} />
              <DetailRow label="Expected Payment Timeframe" value={`${row.payment_timeframe_days || 30} Days`} color="text-purple-300" />
              <DetailRow label="Work Order Status" value={row.status || 'Open'} />
            </div>

            {row.description && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <span className="text-slate-400 font-semibold block mb-1">Description:</span>
                <p className="text-slate-200 leading-relaxed">{row.description}</p>
              </div>
            )}
          </>
        )}

      </div>
    </Modal>
  );
}

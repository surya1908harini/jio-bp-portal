import Modal from './Modal'
import { formatINR, formatDate } from '../lib/utils'
import { FileText, Calendar, DollarSign, Building, Shield, CheckCircle2, Clock, Eye, AlertCircle } from 'lucide-react'
import PdfCell from './PdfCell'

function DetailItem({ label, value, color = 'text-white', highlight = false }) {
  return (
    <div className={`p-3 rounded-xl border flex flex-col justify-between ${
      highlight ? 'bg-slate-900 border-orange-500/40 shadow-inner' : 'bg-slate-950/60 border-slate-800'
    }`}>
      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-xs sm:text-sm font-bold font-mono mt-1 ${color}`}>{value || '—'}</span>
    </div>
  )
}

export default function RecordDetailModal({ record, type = 'invoice', onClose, onEdit, onDelete, isAdmin = true }) {
  if (!record) return null

  const isInvoice = type === 'invoice'
  const isJms = type === 'jms'
  const isBudget = type === 'budget'

  const title = isInvoice
    ? `Invoice Record: #${record.inv_number || record.id}`
    : isJms
    ? `JMS Record: #${record.jms_no || record.id}`
    : `Work Order: #${record.work_order_number || record.id}`

  return (
    <Modal open={!!record} onClose={onClose} title={title} size="max-w-3xl">
      <div className="space-y-5">
        {/* Header Summary Pill Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-950/80 via-slate-900 to-slate-950 border border-orange-800/50 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-orange-300 uppercase tracking-wider">
              {type.toUpperCase()} SUMMARY DETAILS
            </p>
            <h3 className="text-lg font-extrabold text-white">
              {isInvoice
                ? `INV #${record.inv_number || 'N/A'}`
                : isJms
                ? `JMS #${record.jms_no || 'N/A'}`
                : `WO #${record.work_order_number || 'N/A'}`}
            </h3>
            <p className="text-xs text-slate-400">
              Work Order: <strong className="text-slate-200">{record.work_order_number || 'N/A'}</strong> · Site: <strong className="text-slate-200">{record.site || 'N/A'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {record.payment_status && (
              <span className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-950 text-emerald-400 border border-emerald-800 shadow-md">
                {record.payment_status}
              </span>
            )}
            {record.status && !record.payment_status && (
              <span className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-orange-950 text-orange-300 border border-orange-800 shadow-md">
                {record.status}
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Fields Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {isInvoice && (
            <>
              <DetailItem label="Invoice Number" value={record.inv_number} color="text-orange-400" highlight />
              <DetailItem label="Invoice Date" value={formatDate(record.inv_date)} color="text-cyan-400" />
              <DetailItem label="JMS Number" value={record.jms_no} color="text-white" />
              <DetailItem label="Work Order" value={record.work_order_number} color="text-white" />
              <DetailItem label="GST Number" value={record.gst_no} color="text-slate-300" />
              <DetailItem label="SAC Code" value={record.sac_code} color="text-slate-300" />
              <DetailItem label="Site" value={record.site} color="text-slate-300" />
              <DetailItem label="Type of RO" value={record.type_of_ro} color="text-slate-300" />
              <DetailItem label="RO Code" value={record.ro_code} color="text-slate-300" />

              <DetailItem label="Total (Before Tax)" value={formatINR(record.total)} color="text-blue-400" highlight />
              <DetailItem label="IGST (18%)" value={formatINR(record.igst)} color="text-orange-300" />
              <DetailItem label="CGST (9%)" value={formatINR(record.cgst)} color="text-orange-300" />
              <DetailItem label="SGST (9%)" value={formatINR(record.sgst)} color="text-orange-300" />
              <DetailItem label="Grand Total" value={formatINR(record.grand_total)} color="text-emerald-400" highlight />

              <DetailItem label="Invoice Posting Date" value={formatDate(record.inv_posting_date)} color="text-cyan-300" highlight />
              <DetailItem label="Expected Timeframe" value={`${record.payment_timeframe_days || 30} Days`} color="text-amber-400" />
              <DetailItem label="Expected Payment Date" value={formatDate(record.expected_payment_date)} color="text-amber-300" highlight />

              <DetailItem label="Full Amount Received Date" value={formatDate(record.full_amount_received_date || record.amount_received_date)} color="text-emerald-300" />
              <DetailItem label="GST Amount Received Date" value={formatDate(record.gst_amount_received_date)} color="text-emerald-300" />

              <DetailItem label="TDS" value={formatINR(record.tds)} color="text-slate-300" />
              <DetailItem label="GST Amt Deduction" value={formatINR(record.gst_amount_deduction)} color="text-slate-300" />
              <DetailItem label="GST TDS 2% IOCL" value={formatINR(record.gst_tds_2pct_iocl)} color="text-slate-300" />
              <DetailItem label="SD / Retention" value={formatINR(record.sd_retention)} color="text-slate-300" />
              <DetailItem label="TCS / Credit Note" value={formatINR(record.tcs_credit_note)} color="text-slate-300" />
              <DetailItem label="Received Bill Amount" value={formatINR(record.received_bill_amount)} color="text-amber-400" highlight />
            </>
          )}

          {isJms && (
            <>
              <DetailItem label="JMS Number" value={record.jms_no} color="text-orange-400" highlight />
              <DetailItem label="JMS Create Date" value={formatDate(record.jms_create_date || record.inv_date || record.a1_release_date)} color="text-cyan-400" />
              <DetailItem label="Period of Work" value={record.period_of_work} color="text-white" />
              <DetailItem label="Work Order Number" value={record.work_order_number} color="text-white" />
              <DetailItem label="ARC Number" value={record.arc_number} color="text-slate-300" />
              <DetailItem label="Net Amount" value={formatINR(record.net_amount)} color="text-emerald-400" highlight />
              <DetailItem label="Site" value={record.site} color="text-slate-300" />
              <DetailItem label="RO Code" value={record.ro_code} color="text-slate-300" />

              <DetailItem label="A1 Name" value={record.a1_name} color="text-slate-300" />
              <DetailItem label="A1 Release Date" value={formatDate(record.a1_release_date)} color="text-slate-300" />
              <DetailItem label="A2 Name" value={record.a2_name} color="text-slate-300" />
              <DetailItem label="A2 Release Date" value={formatDate(record.a2_release_date)} color="text-slate-300" />
              <DetailItem label="QSD Name" value={record.qsd_name} color="text-slate-300" />
              <DetailItem label="QSD Release Date" value={formatDate(record.qsd_release_date)} color="text-slate-300" />
              <DetailItem label="A3 Name" value={record.a3_name} color="text-slate-300" />

              <DetailItem label="Invoice Number" value={record.inv_number} color="text-orange-300" />
              <DetailItem label="Invoice Date" value={formatDate(record.inv_date)} color="text-slate-300" />
              <DetailItem label="Invoice Posting Date" value={formatDate(record.inv_posting_date)} color="text-slate-300" />
              <DetailItem label="Payment Date" value={formatDate(record.payment_date)} color="text-emerald-300" />
            </>
          )}

          {isBudget && (
            <>
              <DetailItem label="Work Order Number" value={record.work_order_number} color="text-orange-400" highlight />
              <DetailItem label="Operation" value={record.operation} color="text-white" />
              <DetailItem label="ARC Number" value={record.arc_number} color="text-slate-300" />
              <DetailItem label="WO Status" value={record.status === 'Closed' ? 'WO Closed' : 'Active'} color={record.status === 'Closed' ? 'text-slate-400' : 'text-emerald-400'} highlight />
              <DetailItem label="Payment Timeframe" value={`${record.payment_timeframe_days || 30} Days`} color="text-amber-400" highlight />
              <DetailItem label="Validity of Contract" value={record.validity_of_contract} color="text-cyan-300" />
              <DetailItem label="FO Total Budget" value={formatINR(record.fo_total_budget)} color="text-blue-400" highlight />
              <DetailItem label="Total Consumed" value={formatINR(record.total_consumed)} color="text-rose-400" />
              <DetailItem label="Balance Available" value={formatINR((record.fo_total_budget || 0) - (record.total_consumed || 0))} color="text-emerald-400" highlight />
            </>
          )}
        </div>

        {/* Work Description Box */}
        {record.work_description && (
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">WORK DESCRIPTION</span>
            <p className="text-xs text-slate-200 leading-relaxed font-mono">{record.work_description}</p>
          </div>
        )}
        {record.description && !record.work_description && (
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">DESCRIPTION</span>
            <p className="text-xs text-slate-200 leading-relaxed font-mono">{record.description}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 mr-1">PDF Attachment:</span>
            <PdfCell pdfUrl={record.pdf_url} folder={type} isAdmin={isAdmin} />
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && onEdit && (
              <button
                onClick={() => { onClose(); onEdit(record) }}
                className="btn-ghost text-jio-blue-400 hover:text-white"
              >
                Edit Record
              </button>
            )}
            {isAdmin && onDelete && (
              <button
                onClick={() => { onClose(); onDelete(record.id) }}
                className="btn-ghost text-rose-400 hover:text-white"
              >
                Delete Record
              </button>
            )}
            <button onClick={onClose} className="btn-primary">
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

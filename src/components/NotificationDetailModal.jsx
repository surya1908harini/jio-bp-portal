import Modal from './Modal'
import { formatINR, formatDate, parseValidity, formatValidityRange } from '../lib/utils'
import { FileText, ExternalLink, Download, Eye, AlertTriangle, Clock, DollarSign, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function DetailRow({ label, value, color = 'text-white' }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className={`text-xs font-bold font-mono ${color}`}>{value || '—'}</span>
    </div>
  )
}

export default function NotificationDetailModal({ notif, onClose, onNavigate }) {
  const navigate = useNavigate()
  if (!notif) return null

  const { record, category, title, sub, days, severity, link } = notif

  const handleGoToPage = () => {
    onClose()
    if (onNavigate) onNavigate(link)
    else navigate(link)
  }

  return (
    <Modal open={!!notif} onClose={onClose} title="Notification Record Details" size="max-w-xl">
      <div className="space-y-4">
        {/* ── Top Header Banner Card ────────────────────── */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white shadow-xl flex items-center justify-between">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/30">
              {category.toUpperCase()} ALERT
            </span>
            <h3 className="text-base font-extrabold text-white mt-1.5 leading-snug">{title}</h3>
            <p className="text-xs text-purple-100 mt-0.5">{sub}</p>
          </div>
          <span className="px-3 py-1 rounded-xl text-xs font-bold bg-black/30 border border-white/20">
            {severity === 'high' ? 'URGENT' : `${days}d`}
          </span>
        </div>

        {/* ── Record Details Breakdown ─────────────────── */}
        {record ? (
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Record Information</p>

            {category === 'invoice' && (
              <>
                <DetailRow label="Invoice Number" value={`#${record.inv_number || '—'}`} color="text-purple-300" />
                <DetailRow label="Work Order No" value={record.work_order_number} />
                <DetailRow label="JMS Number" value={record.jms_no} />
                <DetailRow label="Invoice Date" value={formatDate(record.inv_date)} />
                <DetailRow label="Grand Total Amount" value={formatINR(record.grand_total)} color="text-emerald-400" />
                <DetailRow label="Payment Status" value={record.payment_status || 'Pending'} color={record.payment_status === 'Full Payment Received' ? 'text-emerald-400' : 'text-rose-400'} />
                <DetailRow label="Received Bill Amount" value={formatINR(record.received_bill_amount)} />
                <DetailRow label="Full Amount Received Date" value={formatDate(record.amount_received_date)} />
                <DetailRow label="GST Amount Received Date" value={formatDate(record.gst_amount_received_date)} />
              </>
            )}

            {category === 'budget' && (
              <>
                <DetailRow label="Work Order Number" value={`WO #${record.work_order_number || '—'}`} color="text-purple-300" />
                <DetailRow label="ARC Number" value={record.arc_number} />
                <DetailRow label="Operation" value={record.operation} />
                <DetailRow label="Validity Period" value={formatValidityRange(record.validity_of_contract) || record.validity_of_contract} />
                <DetailRow label="FO Total Budget" value={formatINR(record.fo_total_budget)} color="text-blue-400" />
                <DetailRow label="Total Consumed" value={formatINR(record.total_consumed)} color="text-rose-400" />
                <DetailRow label="Balance Available" value={formatINR((record.fo_total_budget || 0) - (record.total_consumed || 0))} color={(record.fo_total_budget || 0) - (record.total_consumed || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
              </>
            )}

            {category === 'jms' && (
              <>
                <DetailRow label="JMS Number" value={`JMS #${record.jms_no || '—'}`} color="text-purple-300" />
                <DetailRow label="Work Order Number" value={record.work_order_number} />
                <DetailRow label="Create Date" value={formatDate(record.jms_create_date || record.created_at)} />
                <DetailRow label="Net Amount" value={formatINR(record.net_amount)} color="text-emerald-400" />
                <DetailRow label="Current Stage Status" value={record.status || 'Pending A1'} color="text-amber-400" />
                <DetailRow label="A1 Release Date" value={formatDate(record.a1_release_date)} />
                <DetailRow label="A2 Release Date" value={formatDate(record.a2_release_date)} />
                <DetailRow label="QSD Release Date" value={formatDate(record.qsd_release_date)} />
              </>
            )}

            {/* PDF View Attachment Link */}
            {record.pdf_url && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-slate-800 mt-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <FileText size={16} className="text-purple-400" />
                  <span>Attached PDF Document</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={record.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-purple-950 text-purple-300 border border-purple-800 text-xs font-semibold hover:bg-purple-900 transition-colors flex items-center gap-1"
                  >
                    <Eye size={13} /> View
                  </a>
                  <a
                    href={record.pdf_url}
                    download
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium hover:bg-slate-700 transition-colors flex items-center gap-1"
                  >
                    <Download size={13} /> Download
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
            Click "Go to Full Record Page" below to inspect and manage this record.
          </div>
        )}

        {/* ── Footer Actions ────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button type="button" onClick={onClose} className="btn-ghost">
            Close
          </button>
          <button
            type="button"
            onClick={handleGoToPage}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 hover:opacity-95 active:scale-95 transition-all flex items-center gap-2"
          >
            <ExternalLink size={14} /> Open Full Record Page
          </button>
        </div>
      </div>
    </Modal>
  )
}

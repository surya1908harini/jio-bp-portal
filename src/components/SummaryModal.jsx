import Modal from './Modal';
import { formatINR, formatValidityRange, formatDate } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jmsDb, invoiceDb } from '../lib/db';
import DataTable from './DataTable';

function SummaryRow({ label, value, color = 'text-white' }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-800/50 transition-colors">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value || '—'}</span>
    </div>
  );
}

function AmountCard({ label, amount, color = 'blue' }) {
  const cls = {
    blue: 'border-jio-blue-700/40 bg-jio-blue-900/30 text-jio-blue-400',
    green: 'border-emerald-700/40 bg-emerald-900/20 text-emerald-400',
    amber: 'border-amber-700/40 bg-amber-900/20 text-amber-400',
    cyan: 'border-cyan-700/40 bg-cyan-900/20 text-cyan-400',
    red: 'border-jio-red-700/40 bg-jio-red-900/20 text-jio-red-400',
    purple: 'border-purple-700/40 bg-purple-900/20 text-purple-400',
  };
  return (
    <div className={`rounded-xl border p-3 ${cls[color]}`}>
      <p className="text-[10px] font-medium text-slate-500 mb-1 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold ${cls[color]?.split(' ').pop()}`}>{formatINR(amount)}</p>
    </div>
  );
}

export default function SummaryModal({ row, onClose }) {
  const navigate = useNavigate();
  const [showRecords, setShowRecords] = useState(false);
  const workOrderNumber = row?.work_order_number;

  const { data: jmsList = [], isLoading: jmsLoading } = useQuery({
    queryKey: ['jms', 'by-wo', workOrderNumber],
    queryFn: async () => {
      const all = await jmsDb.listAll();
      return all.filter(j => j.work_order_number === workOrderNumber);
    },
    enabled: showRecords && !!workOrderNumber,
  });

  const { data: invoiceList = [], isLoading: invoiceLoading } = useQuery({
    queryKey: ['invoices', 'by-wo', workOrderNumber],
    queryFn: async () => {
      const all = await invoiceDb.listAll();
      return all.filter(i => i.work_order_number === workOrderNumber);
    },
    enabled: showRecords && !!workOrderNumber,
  });

  if (!row) return null;

  const {
    operation, description, arc_number, work_order_number,
    validity_of_contract, fo_total_budget, total_consumed,
    a3_released_amount, pending_amount, invoiced_amount, balance_available,
  } = row;

  const utilPct = fo_total_budget > 0
    ? Math.min(100, Math.round((total_consumed / fo_total_budget) * 100))
    : 0;
  const isOverdraft = (balance_available || 0) < 0;

  const jmsColumns = [
    { key: 'jms_no', header: 'JMS No', render: r => <span className="font-semibold text-white">{r.jms_no}</span> },
    { key: 'jms_create_date', header: 'JMS Date', render: r => formatDate(r.jms_create_date || r.inv_date) },
    { key: 'net_amount', header: 'Net Amount', render: r => <span className="text-emerald-400 font-semibold">{formatINR(r.net_amount)}</span> },
    { key: 'status', header: 'Status', render: r => <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-950 text-purple-300 border border-purple-800">{r.status || 'Pending'}</span> },
  ];

  const invColumns = [
    { key: 'inv_number', header: 'Inv No', render: r => <span className="font-semibold text-white">{r.inv_number}</span> },
    { key: 'inv_date', header: 'Inv Date', render: r => formatDate(r.inv_date) },
    { key: 'jms_no', header: 'JMS No', render: r => <span className="font-semibold text-purple-300">{r.jms_no}</span> },
    { key: 'grand_total', header: 'Grand Total', render: r => <span className="text-emerald-400 font-semibold">{formatINR(r.grand_total)}</span> },
    { key: 'payment_status', header: 'Payment Status', render: r => <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700">{r.payment_status || 'Pending'}</span> },
  ];

  return (
    <Modal open={!!row} onClose={onClose} title="Budget Record Summary" size={showRecords ? "max-w-5xl" : "max-w-2xl"}>
      <div className="space-y-5">
        {/* ── Header Info ────────────────────────────────── */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-jio-blue-900/50 border border-jio-blue-700/40 flex items-center justify-center text-jio-blue-400 font-bold text-sm">
              WO
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{work_order_number || '—'}</p>
              <p className="text-[11px] text-slate-500">{operation || 'No operation'}</p>
            </div>
          </div>
          <SummaryRow label="ARC Number" value={arc_number} />
          <SummaryRow label="Validity" value={formatValidityRange(validity_of_contract)} />
          {row.pdf_url && (
            <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-800/50 transition-colors border-t border-slate-700/40 mt-1">
              <span className="text-xs font-medium text-slate-400">PDF Document</span>
              <div className="flex items-center gap-2">
                <a
                  href={row.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-red-950/80 text-red-400 border border-red-700/50 hover:bg-red-900 hover:text-white transition-colors text-xs font-semibold"
                >
                  View PDF
                </a>
                <a
                  href={row.pdf_url}
                  download
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors text-xs font-medium"
                >
                  Download PDF
                </a>
              </div>
            </div>
          )}
          {description && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700/30">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Description</p>
              <p className="text-xs text-slate-300 leading-relaxed">{description}</p>
            </div>
          )}
        </div>

        {/* ── Financial Breakdown ─────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Financial Breakdown</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <AmountCard label="FO Total Budget" amount={fo_total_budget} color="blue" />
            <AmountCard label="Total Consumed" amount={total_consumed} color="red" />
            <AmountCard label="Balance Available" amount={balance_available} color={isOverdraft ? 'red' : 'green'} />
            <AmountCard label="A3 Released" amount={a3_released_amount} color="green" />
            <AmountCard label="Pending Stage" amount={pending_amount} color="amber" />
            <AmountCard label="Invoiced" amount={invoiced_amount} color="cyan" />
          </div>
        </div>

        {/* ── Utilization Bar ────────────────────────────── */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Budget Utilization</span>
            <span className={`font-semibold ${utilPct > 85 ? 'text-jio-red-400' : utilPct > 60 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {utilPct}%
            </span>
          </div>
          <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${utilPct}%`,
                background: utilPct > 85
                  ? 'linear-gradient(90deg, #E30613, #88040b)'
                  : utilPct > 60
                    ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                    : 'linear-gradient(90deg, #10b981, #059669)',
              }}
            />
          </div>
          {isOverdraft && (
            <p className="text-[11px] text-jio-red-400 mt-2 flex items-center gap-1">
              ⚠ Budget is in overdraft — consumed exceeds total budget
            </p>
          )}
        </div>

        {/* ── Actions ────────────────────────────── */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
          <button
            onClick={() => setShowRecords(!showRecords)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white font-medium text-xs transition-all"
          >
            {showRecords ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showRecords ? 'HIDE RECORDS' : 'SEE RECORDS ONSCREEN'}
          </button>
          
          <button 
            onClick={() => {
              onClose();
              navigate(`/search?search=${encodeURIComponent(work_order_number)}`);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-lg hover:shadow-purple-500/25"
          >
            <Search size={14} /> FULL SEARCH
          </button>
        </div>

        {/* ── Onscreen Records ────────────────────────────── */}
        {showRecords && (
          <div className="pt-4 space-y-6 border-t border-slate-700/50 animate-slide-in">
            <div>
              <h3 className="text-sm font-bold text-white mb-3">Related JMS Records</h3>
              <DataTable
                columns={jmsColumns}
                data={jmsList}
                loading={jmsLoading}
                emptyMessage="No JMS records found for this Work Order."
              />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-3">Related Invoices</h3>
              <DataTable
                columns={invColumns}
                data={invoiceList}
                loading={invoiceLoading}
                emptyMessage="No invoices found for this Work Order."
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

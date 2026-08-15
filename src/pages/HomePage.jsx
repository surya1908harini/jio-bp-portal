import React, { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { jmsDb, invoiceDb, budgetDb, purchaseBillDb, homeDb } from '../lib/db'
import { formatINR, CURRENT_FY, getFinancialYear, getBudgetRecordFy } from '../lib/utils'
import { MONTHS } from '../components/MonthTabs'
import { PieChart as PieChartIcon, CheckCircle, TrendingUp, Sparkles, Plus, Send, FileText, Receipt, Landmark, ExternalLink, Trash2, Save } from 'lucide-react'

export default function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Daniel Scott'

  // Fetch data
  const { data: jmsList = [] }          = useQuery({ queryKey: ['jms', 'all'],            queryFn: () => jmsDb.listAll() })
  const { data: invoiceList = [] }      = useQuery({ queryKey: ['invoices', 'all'],        queryFn: () => invoiceDb.listAll() })
  const { data: budgetList = [] }       = useQuery({ queryKey: ['budget', 'all'],          queryFn: () => budgetDb.listAll() })
  const { data: purchaseBillList = [] } = useQuery({ queryKey: ['purchase_bills', 'all'],  queryFn: () => purchaseBillDb.listAll() })
  const { data: homeSettings = {} }     = useQuery({ queryKey: ['home-settings'],          queryFn: () => homeDb.getSettings() })

  // Helpers
  const getJmsFy = (r) => {
    const date = r.jms_create_date || r.inv_date || r.a1_release_date || r.a2_release_date || r.qsd_release_date || r.inv_posting_date || r.payment_date;
    if (date) { const fy = getFinancialYear(date); if (fy) return fy }
    return r.financial_year || '2024-25'
  }
  const getInvFy = (r) => {
    const date = r.inv_date || r.amount_received_date;
    if (date) { const fy = getFinancialYear(date); if (fy) return fy }
    return r.financial_year || '2024-25'
  }

  // Active records
  const activeJmsList = useMemo(() => jmsList.filter(j => !String(j.work_description || '').includes('[Cancelled:') && !String(j.status || '').toLowerCase().includes('cancel')), [jmsList])
  const activeInvList = useMemo(() => invoiceList.filter(i => !String(i.work_description || '').includes('[Cancelled:') && !String(i.payment_status || i.status || '').toLowerCase().includes('cancel') && String(i.type_of_ro || '').trim().toUpperCase() !== 'IOCL'), [invoiceList])

  const currentJmsList = activeJmsList.filter(j => getJmsFy(j) === CURRENT_FY)
  const currentInvList = activeInvList.filter(i => getInvFy(i) === CURRENT_FY)

  const isJmsReleased = (j) => {
    if (j.a3_release_date) return true
    const st = String(j.status || '').trim().toLowerCase()
    return st === 'released by a3' || st === 'invoiced' || st.includes('released')
  }

  const pendingA1 = currentJmsList.filter(j => { const st = String(j.status || '').trim().toLowerCase(); return st === 'pending a1' || st === 'a1' || st === 'pending' }).length
  const pendingA2 = currentJmsList.filter(j => { const st = String(j.status || '').trim().toLowerCase(); return st === 'pending a2' || st === 'a2' }).length
  const pendingQsd= currentJmsList.filter(j => { const st = String(j.status || '').trim().toLowerCase(); return st === 'pending qsd' || st === 'qsd' }).length
  const pendingA3 = currentJmsList.filter(j => { const st = String(j.status || '').trim().toLowerCase(); return st === 'pending a3' || st === 'a3' }).length

  // User-specific Sticky Note
  const [stickyNote, setStickyNote] = useState(() => localStorage.getItem('sticky_note_' + user?.id) || '')
  useEffect(() => { localStorage.setItem('sticky_note_' + user?.id, stickyNote) }, [stickyNote, user?.id])

  // Shared Admin Due Dates (Stored in Database)
  const isAdmin = user?.user_metadata?.role === 'admin'
  const dueDates = homeSettings.due_dates || []

  // GSTR1 Distribution state
  const [gstrMonth, setGstrMonth] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return (d.getMonth() + 1).toString();
  })
  const [gstrYear, setGstrYear] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.getFullYear().toString();
  })

  const gstrStats = useMemo(() => {
    let list = invoiceList
    if (gstrYear !== 'all' || gstrMonth !== 'all') {
      list = list.filter(i => {
         const d = i.inv_date || i.amount_received_date
         if (!d) return false
         const p = d.split(/[-/]/)
         let dt
         if (p[0].length === 4) dt = new Date(d) // YYYY-MM-DD
         else if (p[2] && p[2].length === 4) dt = new Date(`${p[2]}-${p[1]}-${p[0]}`) // DD-MM-YYYY
         else return false
         if (isNaN(dt.getTime())) return false
         const matchesYear = gstrYear === 'all' || dt.getFullYear().toString() === gstrYear
         const matchesMonth = gstrMonth === 'all' || (dt.getMonth() + 1).toString() === gstrMonth
         return matchesYear && matchesMonth
      })
    }
    const igst = list.reduce((sum, i) => sum + (Number(i.igst) || 0), 0)
    const cgst = list.reduce((sum, i) => sum + (Number(i.cgst) || 0), 0)
    const sgst = list.reduce((sum, i) => sum + (Number(i.sgst) || 0), 0)
    const total = igst + cgst + sgst
    return { igst, cgst, sgst, total }
  }, [invoiceList, gstrMonth, gstrYear])

  const igstPct = gstrStats.total > 0 ? (gstrStats.igst / gstrStats.total) * 100 : 0
  const cgstPct = gstrStats.total > 0 ? (gstrStats.cgst / gstrStats.total) * 100 : 0
  const sgstPct = gstrStats.total > 0 ? (gstrStats.sgst / gstrStats.total) * 100 : 0
  const igstDash = (igstPct / 100) * 220
  const cgstDash = (cgstPct / 100) * 220
  const sgstDash = (sgstPct / 100) * 220

  const [activeGstSegment, setActiveGstSegment] = useState(null)

  return (
    <div className="space-y-6 animate-page-enter">
      
      {/* ── Status Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-500 rounded-[24px] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => navigate(`/jms?slot=pending_a1&fy=${CURRENT_FY}`)}>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white dark:bg-[#1e1e2d]/20 rounded-full blur-xl pointer-events-none" />
          <p className="text-xs text-blue-100 uppercase font-bold tracking-wider">Pending A1</p>
          <p className="text-4xl font-extrabold text-white mt-2">{pendingA1}</p>
        </div>
        <div className="bg-purple-500 rounded-[24px] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => navigate(`/jms?slot=pending_a2&fy=${CURRENT_FY}`)}>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white dark:bg-[#1e1e2d]/20 rounded-full blur-xl pointer-events-none" />
          <p className="text-xs text-purple-100 uppercase font-bold tracking-wider">Pending A2</p>
          <p className="text-4xl font-extrabold text-white mt-2">{pendingA2}</p>
        </div>
        <div className="bg-amber-500 rounded-[24px] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => navigate(`/jms?slot=pending_qsd&fy=${CURRENT_FY}`)}>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white dark:bg-[#1e1e2d]/20 rounded-full blur-xl pointer-events-none" />
          <p className="text-xs text-amber-100 uppercase font-bold tracking-wider">Pending QSD</p>
          <p className="text-4xl font-extrabold text-white mt-2">{pendingQsd}</p>
        </div>
        <div className="bg-pink-500 rounded-[24px] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => navigate(`/jms?slot=pending_a3&fy=${CURRENT_FY}`)}>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white dark:bg-[#1e1e2d]/20 rounded-full blur-xl pointer-events-none" />
          <p className="text-xs text-pink-100 uppercase font-bold tracking-wider">Pending A3</p>
          <p className="text-4xl font-extrabold text-white mt-2">{pendingA3}</p>
        </div>
      </div>

      {/* ── Middle Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sticky Notes */}
        <div className="bg-yellow-50 rounded-[24px] p-6 shadow-sm border border-yellow-200 flex flex-col interactive-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-yellow-900 flex items-center gap-2">
              <Sparkles size={16} /> STICKY NOTES
            </h3>
          </div>
          <textarea
            value={stickyNote}
            onChange={(e) => setStickyNote(e.target.value)}
            placeholder="Type your personal notes here..."
            className="w-full flex-1 bg-transparent border-none resize-none focus:ring-0 p-0 text-sm font-medium text-yellow-900 placeholder-yellow-700/50"
          />
        </div>

        {/* Due Dates Reminders */}
        <div className="bg-white dark:bg-[#1e1e2d] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-gray-800/50 flex flex-col interactive-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 dark:text-white">DUE DATES</h3>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {dueDates.map(d => {
              const colorMap = {
                red: 'bg-red-50 border-red-100 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400',
                orange: 'bg-orange-50 border-orange-100 text-orange-700 dark:bg-orange-500/10 dark:border-orange-500/20 dark:text-orange-400',
                blue: 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400',
                green: 'bg-green-50 border-green-100 text-green-700 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400',
                purple: 'bg-purple-50 border-purple-100 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/20 dark:text-purple-400',
                cyan: 'bg-cyan-50 border-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:border-cyan-500/20 dark:text-cyan-400'
              }
              return (
                <div key={d.id} className={`flex items-center justify-between p-3 rounded-xl border ${colorMap[d.color] || colorMap.blue} group/item transition-colors`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/60 dark:bg-[#1e1e2d]/60 flex flex-col items-center justify-center font-bold shadow-sm">
                      <span className="text-[10px] uppercase opacity-70 leading-none mb-0.5">Due</span>
                      <span className="text-sm leading-none">{d.date?.replace(/[^0-9]/g, '') || d.date}</span>
                    </div>
                    <span className="font-bold text-sm">{d.title}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* GSTR1 Distribution */}
        <div className="bg-white dark:bg-[#1e1e2d] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-gray-800/50 flex flex-col interactive-card">
          <div className="flex items-start justify-between mb-6">
            <h3 className="font-bold text-gray-900 dark:text-white">GSTR1 Distribution</h3>
            <div className="flex gap-2">
              <select value={gstrMonth} onChange={e=>setGstrMonth(e.target.value)} className="bg-gray-50 dark:bg-[#151521] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-white text-[10px] rounded px-1 py-1 outline-none">
                <option value="all">All Months</option>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select value={gstrYear} onChange={e=>setGstrYear(e.target.value)} className="bg-gray-50 dark:bg-[#151521] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-white text-[10px] rounded px-1 py-1 outline-none">
                <option value="all">All Yrs</option>
                {Array.from({length: 5}).map((_, i) => {
                  const y = (new Date().getFullYear() - 2 + i).toString()
                  return <option key={y} value={y}>{y}</option>
                })}
              </select>
            </div>
          </div>
          


          <div className="text-center mt-2 mb-2">
            <span className="text-[10px] font-bold text-gray-500 dark:text-white dark:text-white uppercase">Total GST Amount</span>
            <div className="text-lg font-black text-gray-900 dark:text-white leading-tight">{formatINR(gstrStats.total)}</div>
          </div>

          <div className="flex flex-col gap-2 mt-2 text-xs font-semibold text-gray-600 dark:text-white dark:text-white">
            <div className="flex justify-between items-center bg-gray-50 dark:bg-[#151521] px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800/50 cursor-pointer hover:bg-gray-100 dark:bg-gray-800" onMouseEnter={() => setActiveGstSegment('IGST')} onMouseLeave={() => setActiveGstSegment(null)}>
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500"></span>IGST ({igstPct.toFixed(1)}%)</span>
              <span className="text-gray-900 dark:text-white">{formatINR(gstrStats.igst)}</span>
            </div>
            <div className="flex justify-between items-center bg-gray-50 dark:bg-[#151521] px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800/50 cursor-pointer hover:bg-gray-100 dark:bg-gray-800" onMouseEnter={() => setActiveGstSegment('CGST')} onMouseLeave={() => setActiveGstSegment(null)}>
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>CGST ({cgstPct.toFixed(1)}%)</span>
              <span className="text-gray-900 dark:text-white">{formatINR(gstrStats.cgst)}</span>
            </div>
            <div className="flex justify-between items-center bg-gray-50 dark:bg-[#151521] px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800/50 cursor-pointer hover:bg-gray-100 dark:bg-gray-800" onMouseEnter={() => setActiveGstSegment('SGST')} onMouseLeave={() => setActiveGstSegment(null)}>
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500"></span>SGST ({sgstPct.toFixed(1)}%)</span>
              <span className="text-gray-900 dark:text-white">{formatINR(gstrStats.sgst)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Important Links ── */}
      <div className="bg-white dark:bg-[#1e1e2d] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-gray-800/50 interactive-card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-gray-900 dark:text-white">Important Links</h3>
        </div>
        <div className="flex flex-wrap gap-4">
          {(homeSettings.links && homeSettings.links.length > 0) ? (
            homeSettings.links.map((link, idx) => (
              <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-[#151521] rounded-lg hover:bg-gray-100 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-white transition-colors border border-gray-200 dark:border-gray-800/50 shadow-sm">
                <ExternalLink size={16} className="text-orange-500" /> {link.name}
              </a>
            ))
          ) : (
            <>
              <a href="#" className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-[#151521] rounded-lg hover:bg-gray-100 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-white transition-colors border border-gray-200 dark:border-gray-800/50 shadow-sm">
                <ExternalLink size={16} className="text-orange-500" /> GST Portal
              </a>
              <a href="#" className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-[#151521] rounded-lg hover:bg-gray-100 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-white transition-colors border border-gray-200 dark:border-gray-800/50 shadow-sm">
                <ExternalLink size={16} className="text-orange-500" /> Income Tax Portal
              </a>
              <a href="#" className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-[#151521] rounded-lg hover:bg-gray-100 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-white transition-colors border border-gray-200 dark:border-gray-800/50 shadow-sm">
                <ExternalLink size={16} className="text-orange-500" /> PF Portal
              </a>
            </>
          )}
        </div>
      </div>

    </div>
  )
}

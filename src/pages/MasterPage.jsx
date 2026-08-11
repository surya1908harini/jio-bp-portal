import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { jmsDb, invoiceDb, budgetDb } from '../lib/db'
import { loadMasters, saveMasters, seedMastersFromRecords } from '../lib/masters'
import ModuleHeader from '../components/ModuleHeader'
import { Database, Plus, Trash2, UserCheck, MapPin, FileText, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MasterPage() {
  const [masters, setMasters] = useState(loadMasters())
  const [activeTab, setActiveTab] = useState('officers') // 'officers' | 'sites' | 'work_orders'
  const [officerRole, setOfficerRole] = useState('officers_a1') // 'officers_a1' | 'officers_a2' | 'officers_qsd' | 'officers_a3'

  // Forms
  const [officerName, setOfficerName] = useState('')
  const [siteName, setSiteName] = useState('')
  const [siteLocation, setSiteLocation] = useState('')
  const [woNumber, setWoNumber] = useState('')
  const [arcNumber, setArcNumber] = useState('')
  const [woDesc, setWoDesc] = useState('')

  // Pre-seed from existing DB records
  const { data: jmsList = [] } = useQuery({ queryKey: ['jms', 'all'], queryFn: () => jmsDb.listAll() })
  const { data: invoiceList = [] } = useQuery({ queryKey: ['invoices', 'all'], queryFn: () => invoiceDb.listAll() })
  const { data: budgetList = [] } = useQuery({ queryKey: ['budget', 'all'], queryFn: () => budgetDb.listAll() })

  useEffect(() => {
    if (jmsList.length || invoiceList.length || budgetList.length) {
      const seeded = seedMastersFromRecords(jmsList, invoiceList, budgetList)
      setMasters(seeded)
    }
  }, [jmsList, invoiceList, budgetList])

  const handleAddOfficer = (e) => {
    e.preventDefault()
    if (!officerName.trim()) return toast.error('Officer name required')
    const list = [...(masters[officerRole] || [])]
    if (list.some(o => o.name.toLowerCase() === officerName.trim().toLowerCase())) {
      return toast.error('Officer already exists in this master list')
    }
    const updated = {
      ...masters,
      [officerRole]: [...list, { id: `off-${Date.now()}`, name: officerName.trim() }]
    }
    setMasters(updated)
    saveMasters(updated)
    setOfficerName('')
    toast.success('Officer added to Master ✓')
  }

  const handleDeleteOfficer = (id) => {
    const list = masters[officerRole].filter(o => o.id !== id)
    const updated = { ...masters, [officerRole]: list }
    setMasters(updated)
    saveMasters(updated)
    toast.success('Officer removed from Master')
  }

  const handleAddSite = (e) => {
    e.preventDefault()
    if (!siteName.trim()) return toast.error('Site name required')
    const list = [...(masters.sites || [])]
    if (list.some(s => s.name.toLowerCase() === siteName.trim().toLowerCase())) {
      return toast.error('Site already exists in Master')
    }
    const updated = {
      ...masters,
      sites: [...list, { id: `site-${Date.now()}`, name: siteName.trim(), location: siteLocation.trim() }]
    }
    setMasters(updated)
    saveMasters(updated)
    setSiteName('')
    setSiteLocation('')
    toast.success('Site added to Master ✓')
  }

  const handleDeleteSite = (id) => {
    const list = masters.sites.filter(s => s.id !== id)
    const updated = { ...masters, sites: list }
    setMasters(updated)
    saveMasters(updated)
    toast.success('Site removed from Master')
  }

  const handleAddWorkOrder = (e) => {
    e.preventDefault()
    if (!woNumber.trim()) return toast.error('Work Order number required')
    const list = [...(masters.work_orders || [])]
    if (list.some(w => w.work_order_number.toLowerCase() === woNumber.trim().toLowerCase())) {
      return toast.error('Work Order already exists in Master')
    }
    const updated = {
      ...masters,
      work_orders: [
        ...list,
        {
          id: `wo-${Date.now()}`,
          work_order_number: woNumber.trim(),
          arc_number: arcNumber.trim(), // Optional! If empty, stays blank!
          description: woDesc.trim()
        }
      ]
    }
    setMasters(updated)
    saveMasters(updated)
    setWoNumber('')
    setArcNumber('')
    setWoDesc('')
    toast.success('Work Order added to Master ✓')
  }

  const handleDeleteWorkOrder = (id) => {
    const list = masters.work_orders.filter(w => w.id !== id)
    const updated = { ...masters, work_orders: list }
    setMasters(updated)
    saveMasters(updated)
    toast.success('Work Order removed from Master')
  }

  const roleLabels = {
    officers_a1: 'A1 Officers Master',
    officers_a2: 'A2 Officers Master',
    officers_qsd: 'QSD Officers Master',
    officers_a3: 'A3 Officers Master',
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Master Data Management (மாஸ்டர் அமைப்புகள்)"
        subtitle="Manage Officers (A1, A2, QSD, A3), Sites, and Work Orders for 1-click auto-fill across JMS and Invoice entries"
        icon={Database}
      />

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('officers')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'officers'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <UserCheck size={15} /> Officer Masters (A1 / A2 / QSD / A3)
        </button>
        <button
          onClick={() => setActiveTab('sites')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'sites'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <MapPin size={15} /> Site Masters
        </button>
        <button
          onClick={() => setActiveTab('work_orders')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'work_orders'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <FileText size={15} /> Work Order & ARC Masters
        </button>
      </div>

      {/* ── 1. OFFICERS TAB ── */}
      {activeTab === 'officers' && (
        <div className="space-y-5">
          {/* Role Sub-tabs */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(roleLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setOfficerRole(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  officerRole === key
                    ? 'bg-slate-800 text-orange-300 border border-orange-500/40 font-bold'
                    : 'bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {label} ({masters[key]?.length || 0})
              </button>
            ))}
          </div>

          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <UserCheck size={16} className="text-orange-400" /> Add New Officer to {roleLabels[officerRole]}
            </h3>
            <form onSubmit={handleAddOfficer} className="flex gap-3 items-center max-w-xl">
              <input
                type="text"
                value={officerName}
                onChange={e => setOfficerName(e.target.value)}
                placeholder="Enter officer full name (e.g. Rajkumar M)"
                className="input-field flex-1"
                required
              />
              <button type="submit" className="btn-primary flex items-center gap-1.5 whitespace-nowrap">
                <Plus size={15} /> Add Officer
              </button>
            </form>
          </div>

          {/* Officers Table */}
          <div className="glass-card p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="p-3">#</th>
                    <th className="p-3">Officer Name</th>
                    <th className="p-3">Master Category</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(masters[officerRole] || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500 italic">No officers added to this category yet.</td>
                    </tr>
                  ) : (
                    masters[officerRole].map((off, idx) => (
                      <tr key={off.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-3 font-semibold text-white">{off.name}</td>
                        <td className="p-3 text-orange-300 font-mono text-[11px]">{roleLabels[officerRole]}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteOfficer(off.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-950 text-rose-400 hover:text-rose-200 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. SITES TAB ── */}
      {activeTab === 'sites' && (
        <div className="space-y-5">
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <MapPin size={16} className="text-emerald-400" /> Add New Site to Master List
            </h3>
            <form onSubmit={handleAddSite} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={siteName}
                onChange={e => setSiteName(e.target.value)}
                placeholder="Site Name (e.g. CHENNAI or PONDICHERRY)"
                className="input-field"
                required
              />
              <input
                type="text"
                value={siteLocation}
                onChange={e => setSiteLocation(e.target.value)}
                placeholder="State / Location (e.g. TAMIL NADU)"
                className="input-field"
              />
              <button type="submit" className="btn-primary flex items-center justify-center gap-1.5">
                <Plus size={15} /> Add Site Master
              </button>
            </form>
          </div>

          <div className="glass-card p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="p-3">#</th>
                    <th className="p-3">Site Name</th>
                    <th className="p-3">Location / State</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(masters.sites || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500 italic">No sites added yet.</td>
                    </tr>
                  ) : (
                    masters.sites.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-3 font-semibold text-white">{s.name}</td>
                        <td className="p-3 text-emerald-300 font-mono text-[11px]">{s.location || '—'}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteSite(s.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-950 text-rose-400 hover:text-rose-200 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. WORK ORDERS TAB ── */}
      {activeTab === 'work_orders' && (
        <div className="space-y-5">
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText size={16} className="text-amber-400" /> Add Work Order & ARC Master (Work Order with optional ARC No)
            </h3>
            <form onSubmit={handleAddWorkOrder} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                value={woNumber}
                onChange={e => setWoNumber(e.target.value)}
                placeholder="Work Order Number * (Required)"
                className="input-field"
                required
              />
              <input
                type="text"
                value={arcNumber}
                onChange={e => setArcNumber(e.target.value)}
                placeholder="ARC Number (Optional - leave blank if none)"
                className="input-field"
              />
              <input
                type="text"
                value={woDesc}
                onChange={e => setWoDesc(e.target.value)}
                placeholder="Work Description (Optional)"
                className="input-field"
              />
              <button type="submit" className="btn-primary flex items-center justify-center gap-1.5">
                <Plus size={15} /> Add Work Order
              </button>
            </form>
          </div>

          <div className="glass-card p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="p-3">#</th>
                    <th className="p-3">Work Order Number</th>
                    <th className="p-3">ARC Number</th>
                    <th className="p-3">Work Description</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(masters.work_orders || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500 italic">No Work Orders added to Master yet.</td>
                    </tr>
                  ) : (
                    masters.work_orders.map((w, idx) => (
                      <tr key={w.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-3 font-bold text-white">{w.work_order_number}</td>
                        <td className="p-3 text-amber-300 font-mono text-[11px]">{w.arc_number || '—'}</td>
                        <td className="p-3 text-slate-300 max-w-xs truncate">{w.description || '—'}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteWorkOrder(w.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-950 text-rose-400 hover:text-rose-200 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

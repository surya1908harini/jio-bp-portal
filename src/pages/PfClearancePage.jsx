import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Calendar, LayoutTemplate } from 'lucide-react'
import toast from 'react-hot-toast'
import ModuleHeader from '../components/ModuleHeader'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { pfDb, budgetDb } from '../lib/db'
import { useAuth } from '../context/AuthContext'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const YEARS = [2023, 2024, 2025, 2026, 2027]
const PROJECTS = ['TAMILNADU MEC', 'RBML PROJECT']

export default function PfClearancePage() {
  const { user, isAdmin } = useAuth()
  const qc = useQueryClient()
  
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[currentDate.getMonth()])
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [activeProjectIdx, setActiveProjectIdx] = useState(0)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [uploadStep, setUploadStep] = useState(1) // 1: Paste, 2: Preview
  const [bulkWoInput, setBulkWoInput] = useState('')
  const [previewRecords, setPreviewRecords] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch PF Data
  const { data: pfRecords = [], isLoading } = useQuery({
    queryKey: ['pf_clearance', 'all'],
    queryFn: () => pfDb.listAll()
  })

  // Fetch Budget Data for Auto-Fetch
  const { data: budgetRecords = [] } = useQuery({
    queryKey: ['budgets', 'all'],
    queryFn: () => budgetDb.listAll()
  })

  const activeProject = PROJECTS[activeProjectIdx]

  // Filter records
  const filteredRecords = useMemo(() => {
    return pfRecords.filter(r => 
      r.month === selectedMonth && 
      Number(r.year) === Number(selectedYear) && 
      r.project_name === activeProject
    ).map((r, i) => ({ ...r, s_no: i + 1 }))
  }, [pfRecords, selectedMonth, selectedYear, activeProject])

  // Navigation handlers
  const handlePrev = () => {
    setActiveProjectIdx(prev => (prev === 0 ? PROJECTS.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setActiveProjectIdx(prev => (prev === PROJECTS.length - 1 ? 0 : prev + 1))
  }

  // Step 1 -> Step 2
  const handleFetchDetails = () => {
    const wos = bulkWoInput.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
    if (wos.length === 0) return toast.error('Please enter at least one Work Order')

    const newPreview = wos.map((wo, index) => {
      const found = budgetRecords.find(b => String(b.work_order_number).trim().toLowerCase() === wo.toLowerCase())
      
      let projName = activeProject
      if (found && found.operation) {
        projName = found.operation // Directly map the operation from the Budget!
      }

      return {
        id: index,
        work_order_no: found?.work_order_number || wo,
        project_name: projName,
        description: found?.description || '',
        isFound: !!found
      }
    })
    setPreviewRecords(newPreview)
    setUploadStep(2)
  }

  const handlePreviewChange = (id, field, value) => {
    setPreviewRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  // Save Records
  const handleSaveAll = async () => {
    if (previewRecords.length === 0) return

    for (const r of previewRecords) {
      if (!r.work_order_no) return toast.error('Work Order No is required for all rows')
    }

    setIsSubmitting(true)
    try {
      const promises = previewRecords.map(r => 
        pfDb.insert({
          work_order_no: r.work_order_no,
          project_name: r.project_name,
          description: r.description,
          month: selectedMonth,
          year: Number(selectedYear)
        }, user?.id || 'system')
      )
      await Promise.all(promises)

      qc.invalidateQueries(['pf_clearance'])
      toast.success(`${previewRecords.length} Records added successfully!`)
      
      // Reset Modal
      setIsModalOpen(false)
      setUploadStep(1)
      setBulkWoInput('')
      setPreviewRecords([])
    } catch (error) {
      console.error(error)
      toast.error('Failed to add records')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete Record
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return
    try {
      await pfDb.delete(id)
      qc.invalidateQueries(['pf_clearance'])
      toast.success('Record deleted')
    } catch (err) {
      toast.error('Failed to delete')
    }
  }

  const columns = [
    { key: 's_no', header: 'S.NO', className: 'w-[10%] min-w-[60px]', render: r => <span className="font-mono text-gray-500 dark:text-white dark:text-white">{r.s_no}</span> },
    { key: 'work_order_no', header: 'Work Order No', className: 'w-[25%] min-w-[150px]', render: r => <span className="font-bold text-gray-900 dark:text-white">{r.work_order_no}</span> },
    { 
      key: 'project_name', 
      header: 'Project Name / Operation', 
      className: 'w-[25%] min-w-[200px]',
      render: r => {
        const found = budgetRecords.find(b => String(b.work_order_number).trim().toLowerCase() === String(r.work_order_no).trim().toLowerCase())
        return <span className="font-semibold text-gray-700 dark:text-white">{(found && found.operation) ? found.operation : r.project_name}</span>
      }
    },
    { key: 'description', header: 'Description', className: 'w-[40%]', render: r => <span className="text-gray-500 dark:text-white dark:text-white">{r.description || '-'}</span> },
  ]

  return (
    <div className="animate-page-enter">
      {document.getElementById('topbar-center') && createPortal(
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#151521] p-1.5 rounded-lg border border-brand-border dark:border-gray-800">
          <Calendar size={14} className="text-neon-orange ml-1" />
          <select 
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="bg-transparent border-none text-gray-900 dark:text-white text-xs font-semibold focus:ring-0 cursor-pointer"
          >
            {MONTHS.map(m => <option key={m} value={m} className="bg-white dark:bg-[#1e1e2d] text-brand-text">{m}</option>)}
          </select>
          <span className="text-gray-500 dark:text-white dark:text-white text-xs">/</span>
          <select 
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="bg-transparent border-none text-gray-900 dark:text-white text-xs font-semibold focus:ring-0 cursor-pointer pr-4"
          >
            {YEARS.map(y => <option key={y} value={y} className="bg-white dark:bg-[#1e1e2d] text-brand-text">{y}</option>)}
          </select>
        </div>,
        document.getElementById('topbar-center')
      )}
      {document.getElementById('topbar-actions') && createPortal(
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary !px-3 !py-1.5 !text-xs"
        >
          <Plus size={14} /> Add Record
        </button>,
        document.getElementById('topbar-actions')
      )}

      {/* Carousel Area */}
      <div className="relative bg-white dark:bg-[#1e1e2d] border border-brand-border dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm p-6 min-h-[500px] flex flex-col">
        
        {/* Carousel Header */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={handlePrev}
            className="p-3 bg-gray-100 dark:bg-gray-800 hover:bg-brand-accent text-gray-500 dark:text-white dark:text-white hover:text-white rounded-xl transition-all shadow-sm"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="flex-1 text-center px-4">
            <div className="inline-block px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl shadow-lg shadow-orange-500/20">
              <h2 className="text-xl md:text-2xl font-black text-white tracking-widest uppercase">
                {activeProject}
              </h2>
            </div>
            <p className="text-gray-500 dark:text-white dark:text-white text-sm mt-3 font-medium">
              Showing records for {selectedMonth} {selectedYear}
            </p>
          </div>

          <button 
            onClick={handleNext}
            className="p-3 bg-gray-100 dark:bg-gray-800 hover:bg-brand-accent text-gray-500 dark:text-white dark:text-white hover:text-white rounded-xl transition-all shadow-sm"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Data Table Area */}
        <div className="flex-1 bg-white dark:bg-[#1e1e2d] rounded-2xl border border-brand-border dark:border-gray-800 overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-white dark:text-white">
              <div className="w-8 h-8 border-4 border-neon-orange border-t-transparent rounded-full animate-spin mb-4" />
              Loading records...
            </div>
          ) : filteredRecords.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-24 text-gray-500 dark:text-white dark:text-white animate-fade-in">
               <div className="p-4 bg-gray-50 dark:bg-[#151521] rounded-full mb-3 border border-brand-border dark:border-gray-800">
                 <LayoutTemplate size={32} className="text-gray-400 dark:text-white opacity-50" />
               </div>
               <p className="font-medium">No PF clearance records found.</p>
               <p className="text-xs mt-1 opacity-70">for {activeProject} in {selectedMonth} {selectedYear}</p>
             </div>
          ) : (
            <DataTable 
              columns={columns} 
              data={filteredRecords} 
              onRowClick={() => {}}
              actions={r => (
                <button onClick={() => handleDelete(r.id)} className="px-3 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-400/10 hover:bg-rose-500 rounded transition-colors">Delete</button>
              )}
            />
          )}
        </div>

      </div>

      {/* Add Modal */}
      <Modal open={isModalOpen} onClose={() => { setIsModalOpen(false); setUploadStep(1); setBulkWoInput(''); setPreviewRecords([]); }} title="Add PF Clearance Records" size="max-w-3xl">
        <div className="space-y-4">
          
          <div className="flex gap-4 mb-4 bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
            <div>
              <span className="text-xs text-gray-500 dark:text-white dark:text-white block mb-1">Target Month</span>
              <span className="text-sm font-bold text-neon-orange">{selectedMonth} {selectedYear}</span>
            </div>
            <div className="w-px bg-gray-200 h-8"></div>
            <div>
              <span className="text-xs text-gray-500 dark:text-white dark:text-white block mb-1">Target Project</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">Will auto-match or set manually</span>
            </div>
          </div>

          {uploadStep === 1 && (
            <div className="animate-fade-in">
              <label className="text-xs font-semibold text-gray-500 dark:text-white dark:text-white uppercase tracking-wider mb-2 block">
                Paste Work Order Numbers
              </label>
              <textarea
                className="input-field w-full min-h-[150px] font-mono text-sm leading-relaxed"
                value={bulkWoInput}
                onChange={e => setBulkWoInput(e.target.value)}
                placeholder="Paste WO numbers here... (Comma or newline separated)&#10;Ex:&#10;WO12345&#10;WO67890"
              />
              <div className="pt-4 flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 dark:text-white dark:text-white hover:text-white font-medium">Cancel</button>
                <button onClick={handleFetchDetails} disabled={!bulkWoInput.trim()} className="btn-primary">
                  Fetch Details
                </button>
              </div>
            </div>
          )}

          {uploadStep === 2 && (
            <div className="animate-fade-in">
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar border border-gray-200 dark:border-gray-800 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800 sticky top-0 z-10 text-gray-700 dark:text-white">
                    <tr>
                      <th className="p-3 font-semibold w-[20%]">Status</th>
                      <th className="p-3 font-semibold w-[25%]">Work Order No</th>
                      <th className="p-3 font-semibold w-[25%]">Project Name</th>
                      <th className="p-3 font-semibold w-[30%]">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:bg-[#1e1e2d]">
                    {previewRecords.map(r => (
                      <tr key={r.id} className="hover:bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800/30 transition-colors">
                        <td className="p-3">
                          {r.isFound ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
                              Found
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-1 rounded">
                              Not Found
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <input 
                            type="text" 
                            className="input-field w-full !py-1 !text-sm font-mono text-jio-blue-300"
                            value={r.work_order_no} 
                            onChange={e => handlePreviewChange(r.id, 'work_order_no', e.target.value)} 
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            type="text"
                            className="input-field w-full !py-1 !text-sm font-semibold"
                            value={r.project_name} 
                            onChange={e => handlePreviewChange(r.id, 'project_name', e.target.value)}
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            type="text" 
                            className="input-field w-full !py-1 !text-sm"
                            value={r.description} 
                            onChange={e => handlePreviewChange(r.id, 'description', e.target.value)}
                            placeholder="Description..."
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 flex justify-between items-center">
                <button onClick={() => setUploadStep(1)} className="px-4 py-2 text-gray-500 dark:text-white dark:text-white hover:text-white font-medium text-sm flex items-center gap-2">
                  <ChevronLeft size={16}/> Back
                </button>
                <div className="flex gap-3">
                  <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 dark:text-white dark:text-white hover:text-white font-medium">Cancel</button>
                  <button onClick={handleSaveAll} disabled={isSubmitting} className="btn-primary">
                    {isSubmitting ? 'Saving...' : `Save ${previewRecords.length} Records`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

    </div>
  )
}

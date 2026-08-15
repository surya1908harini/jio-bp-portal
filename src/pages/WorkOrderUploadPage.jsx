import React, { useState } from 'react'
import { Upload, FileText, CheckCircle, Database } from 'lucide-react'
import toast from 'react-hot-toast'
import ModuleHeader from '../components/ModuleHeader'
import { extractWorkOrderData } from '../lib/pdfParser'
import { workOrderDb } from '../lib/db'

export default function WorkOrderUploadPage() {
  const [parsedData, setParsedData] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || file.type !== 'application/pdf') {
      toast.error('Please upload a valid PDF file.')
      return
    }

    setIsProcessing(true)
    const toastId = toast.loading('Extracting data from PDF...')
    
    try {
      const data = await extractWorkOrderData(file)
      if (data.items.length === 0) {
        toast.error('No items found in PDF. Check format.', { id: toastId })
      } else {
        toast.success(`Found ${data.items.length} items!`, { id: toastId })
        setParsedData(data)
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to parse PDF', { id: toastId })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveToDatabase = async () => {
    if (!parsedData) return
    
    setIsSaving(true)
    const toastId = toast.loading('Saving Work Order to Database...')
    
    try {
      // 1. Create Work Order
      const woPayload = {
        wo_number: parsedData.woNumber,
        date: new Date().toISOString().split('T')[0]
      }
      
      const newWo = await workOrderDb.create(woPayload)
      
      // 2. Insert Items
      const itemsPayload = parsedData.items.map(item => ({
        wo_id: newWo.id,
        item_code: item.item_code,
        description: item.description,
        rate: item.rate,
        unit: item.unit
      }))
      
      await workOrderDb.insertItems(itemsPayload)
      
      toast.success('Successfully saved to Database!', { id: toastId })
      setParsedData(null) // Reset
    } catch (error) {
      console.error(error)
      if (error.code === '23505') {
        toast.error('This Work Order Number already exists!', { id: toastId })
      } else {
        toast.error('Failed to save to database.', { id: toastId })
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-page-enter pb-20">
      <ModuleHeader title="Work Order Uploader" subtitle="Upload PDF Work Orders to automatically extract SL Codes and Rates into Master Data." />
      
      {!parsedData ? (
        <div className="card p-12 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-jio-blue-500 transition-colors">
          <FileText size={64} className="text-gray-300 dark:text-gray-600 mb-6" />
          <h2 className="text-xl font-bold mb-2">Upload Work Order PDF</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-md text-center">We will automatically scan the document for Item Codes, Descriptions, and Rates.</p>
          <label className="btn-primary px-8 py-3 cursor-pointer">
            <Upload size={18} className="mr-2" /> Select PDF
            <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} disabled={isProcessing} />
          </label>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card p-6 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 flex items-center justify-between">
            <div>
              <h3 className="text-green-800 dark:text-green-400 font-bold flex items-center"><CheckCircle size={18} className="mr-2" /> PDF Parsed Successfully</h3>
              <p className="text-sm text-green-700 dark:text-green-500 mt-1">Work Order: <strong>{parsedData.woNumber}</strong> | Found <strong>{parsedData.items.length}</strong> items.</p>
            </div>
            <button 
              onClick={handleSaveToDatabase} 
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium shadow-md shadow-green-600/20 transition-all flex items-center"
            >
              <Database size={18} className="mr-2" /> {isSaving ? 'Saving...' : 'Save to Database'}
            </button>
          </div>
          
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 bg-gray-50 dark:bg-[#1a1a24] dark:text-gray-400 uppercase">
                  <tr>
                    <th className="px-6 py-3">Item Code</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Rate</th>
                    <th className="px-6 py-3">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {parsedData.items.map((item, idx) => (
                    <tr key={idx} className="bg-white dark:bg-[#1e1e2d] hover:bg-gray-50 dark:hover:bg-[#252538] transition-colors">
                      <td className="px-6 py-4 font-mono font-medium">{item.item_code}</td>
                      <td className="px-6 py-4">{item.description}</td>
                      <td className="px-6 py-4 font-semibold text-right">{item.rate.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                      <td className="px-6 py-4 text-gray-500">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="text-center">
            <button onClick={() => setParsedData(null)} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 underline">
              Cancel & Upload Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

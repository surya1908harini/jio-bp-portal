import React, { useState, useRef } from 'react'
import { Upload, FileText, Download, LayoutTemplate, Plus, Trash2, Settings, Image as ImageIcon, Printer } from 'lucide-react'
import Papa from 'papaparse'
import toast from 'react-hot-toast'
import ModuleHeader from '../components/ModuleHeader'
import TemplateWorkspace from '../components/TemplateWorkspace'
import { generateBulkDocuments } from '../lib/documentExport'

export default function TemplateGeneratorPage() {
  const [step, setStep] = useState(1)
  
  // Template State
  const [templateImage, setTemplateImage] = useState(null)
  
  // Mapping State (The draggable boxes)
  const [mappings, setMappings] = useState([])
  
  // Data State
  const [csvData, setCsvData] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)

  // Handlers
  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setTemplateImage(event.target.result)
        setStep(2)
      }
      reader.readAsDataURL(file)
    } else {
      toast.error('Please upload a valid PNG or JPG image.')
    }
  }

  const handleCsvUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setCsvData(results.data)
            toast.success(`Imported ${results.data.length} records.`)
            setStep(4)
          } else {
            toast.error('CSV appears to be empty.')
          }
        },
        error: () => toast.error('Error parsing CSV file.')
      })
    }
  }

  const handleExport = async () => {
    if (csvData.length === 0 || !templateImage || mappings.length === 0) {
      toast.error('Missing template, mappings, or data!')
      return
    }
    
    setIsGenerating(true)
    const toastId = toast.loading('Generating documents... This may take a while for large batches.')
    
    try {
      await generateBulkDocuments(templateImage, mappings, csvData)
      toast.success('Successfully generated and downloaded ZIP!', { id: toastId })
    } catch (error) {
      console.error(error)
      toast.error('Failed to generate documents.', { id: toastId })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6 animate-page-enter pb-20">
      <ModuleHeader title="Template Studio" subtitle="Build custom templates, map dynamic data, and export in bulk." />
      
      {/* Stepper */}
      <div className="flex items-center justify-between bg-white dark:bg-[#1e1e2d] p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
        {[
          { num: 1, label: 'Upload Template', icon: ImageIcon },
          { num: 2, label: 'Map Fields', icon: LayoutTemplate },
          { num: 3, label: 'Import Data', icon: FileText },
          { num: 4, label: 'Generate & Export', icon: Download }
        ].map((s, i) => (
          <React.Fragment key={s.num}>
            <div 
              onClick={() => step >= s.num && setStep(s.num)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                step === s.num ? 'bg-jio-blue-50 dark:bg-jio-blue-900/30 text-jio-blue-600' 
                : step > s.num ? 'text-green-600 cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20' 
                : 'text-gray-400 opacity-60'
              }`}
            >
              <s.icon size={20} />
              <span className="font-semibold text-sm hidden sm:block">{s.num}. {s.label}</span>
            </div>
            {i < 3 && <div className="h-px w-8 sm:w-16 bg-gray-200 dark:bg-gray-700"></div>}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Upload Template */}
      {step === 1 && (
        <div className="card p-12 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-jio-blue-500 transition-colors">
          <ImageIcon size={64} className="text-gray-300 dark:text-gray-600 mb-6" />
          <h2 className="text-xl font-bold mb-2">Upload Base Template</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-md text-center">Upload a high-resolution PNG or JPG image of your blank form or document.</p>
          <label className="btn-primary px-8 py-3 cursor-pointer">
            <Upload size={18} className="mr-2" /> Select Image
            <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleImageUpload} />
          </label>
        </div>
      )}

      {/* Step 2: Workspace Mapping */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-[#1e1e2d] p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="font-bold">Map Variable Fields</h3>
              <p className="text-xs text-gray-500">Drag and resize boxes. Name them exactly as they will appear in your CSV headers.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="btn-primary px-6">
                Next Step <FileText size={16} className="ml-2" />
              </button>
            </div>
          </div>
          
          {/* Workspace Area */}
          <div className="bg-gray-100 dark:bg-[#151521] p-8 rounded-2xl overflow-auto border border-gray-200 dark:border-gray-800 flex justify-center">
            <TemplateWorkspace 
              templateImage={templateImage} 
              mappings={mappings} 
              setMappings={setMappings} 
            />
          </div>
        </div>
      )}

      {/* Step 3: Import Data */}
      {step === 3 && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-8">
            <h3 className="text-lg font-bold mb-4">Required Headers</h3>
            <p className="text-sm text-gray-500 mb-4">Your CSV file must include these column headers exactly as you named them in the mapping step:</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {mappings.length === 0 ? <span className="text-xs italic">No mappings created.</span> : 
                mappings.map(m => (
                  <span key={m.id} className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-mono border border-gray-200 dark:border-gray-700">
                    {m.variableName || 'unnamed'}
                  </span>
                ))
              }
            </div>
          </div>
          <div className="card p-8 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-jio-blue-500 transition-colors">
            <FileText size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
            <h2 className="text-lg font-bold mb-2">Upload CSV Data</h2>
            <label className="btn-primary px-6 py-2 cursor-pointer mt-2">
              <Upload size={16} className="mr-2" /> Select CSV File
              <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
            </label>
          </div>
        </div>
      )}

      {/* Step 4: Generate */}
      {step === 4 && (
        <div className="card p-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 text-green-600 rounded-full mb-6">
            <Download size={32} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Ready to Generate</h2>
          <p className="text-gray-500 mb-8 max-w-lg mx-auto">
            You have uploaded a template, mapped {mappings.length} fields, and imported {csvData.length} data rows.
          </p>
          
          <button 
            onClick={handleExport} 
            disabled={isGenerating}
            className="btn-primary text-lg px-10 py-4 shadow-xl shadow-jio-blue-500/30"
          >
            {isGenerating ? (
              <span className="flex items-center"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div> Generating PDF Bundle...</span>
            ) : (
              <span className="flex items-center"><Printer size={22} className="mr-3" /> Generate Bulk PDFs (ZIP)</span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

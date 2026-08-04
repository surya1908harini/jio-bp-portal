import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react'
import { parseExcelFile } from '../lib/utils'
import Modal from './Modal'
import toast from 'react-hot-toast'

export default function ImportModal({ open, onClose, onImport, columnMap = [], title = 'Import Records' }) {
  const [file,     setFile]     = useState(null)
  const [preview,  setPreview]  = useState([])
  const [headers,  setHeaders]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const handleFile = async (f) => {
    if (!f) return
    setFile(f)
    try {
      const rows = await parseExcelFile(f)
      setPreview(rows.slice(0, 5))
      setHeaders(rows.length > 0 ? Object.keys(rows[0]) : [])
    } catch {
      toast.error('Failed to parse file. Please use a valid .xlsx or .csv file.')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleSubmit = async () => {
    if (!file) return
    setLoading(true)
    try {
      const rows = await parseExcelFile(file)
      await onImport(rows)
      toast.success(`Imported ${rows.length} records successfully`)
      handleClose()
    } catch (err) {
      toast.error(err?.message || err?.response?.data?.detail || 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFile(null); setPreview([]); setHeaders([])
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={title}>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragging ? 'border-jio-blue-500 bg-jio-blue-900/20' : 'border-slate-600 hover:border-jio-blue-600 hover:bg-slate-800/50'
        }`}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileSpreadsheet size={28} className="text-emerald-400" />
            <div className="text-left">
              <p className="text-white font-medium text-sm">{file.name}</p>
              <p className="text-slate-400 text-xs">{(file.size / 1024).toFixed(1)} KB · {preview.length}+ rows detected</p>
            </div>
            <button onClick={e => { e.stopPropagation(); setFile(null); setPreview([]); setHeaders([]) }} className="ml-4 text-slate-500 hover:text-slate-300">
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={32} className="mx-auto mb-3 text-slate-500" />
            <p className="text-sm font-medium text-slate-300">Drop your Excel/CSV file here</p>
            <p className="text-xs text-slate-500 mt-1">or click to browse · .xlsx, .xls, .csv supported</p>
          </>
        )}
      </div>

      {/* Column guide */}
      {columnMap.length > 0 && (
        <div className="mt-4 p-3 bg-slate-800/60 rounded-xl">
          <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Expected Columns</p>
          <div className="flex flex-wrap gap-1.5">
            {columnMap.map(c => (
              <span key={c} className="badge bg-jio-blue-900/50 text-jio-blue-300 border border-jio-blue-700/50">{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* Preview table */}
      {preview.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle size={13} className="text-emerald-400" /> Preview (first 5 rows)
          </p>
          <div className="table-container max-h-48">
            <table className="data-table text-xs">
              <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {headers.map(h => <td key={h}>{String(row[h] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <AlertCircle size={12} /> Detected {headers.length} columns. Ensure column names match expected format.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={handleClose} className="btn-ghost">Cancel</button>
        <button onClick={handleSubmit} disabled={!file || loading} className="btn-primary">
          {loading
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing…</>
            : <><Upload size={15} /> Import {preview.length > 0 ? 'Records' : ''}</>
          }
        </button>
      </div>
    </Modal>
  )
}

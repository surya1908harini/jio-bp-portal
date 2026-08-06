import { useState, useRef } from 'react'
import { FileText, Upload, Trash2, Eye, Download, Loader2 } from 'lucide-react'
import { uploadPdf, deletePdf } from '../lib/utils'
import toast from 'react-hot-toast'

/**
 * PdfCell — used inside table rows to show upload / view / download / delete PDF
 * Props:
 *   pdfUrl   : string | null   — current PDF url stored in DB
 *   onSave   : (url) => void   — called after upload with new URL
 *   onDelete : ()    => void   — called after deletion
 *   folder   : string          — subfolder in Supabase storage
 *   isAdmin  : bool
 */
export default function PdfCell({ pdfUrl, onSave, onDelete, folder = 'general', isAdmin }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large — max 10MB')
      return
    }
    setUploading(true)
    try {
      const url = await uploadPdf(file, folder)
      await onSave(url)
      toast.success('PDF uploaded ✓')
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!window.confirm('Remove this PDF document?')) return
    try {
      if (pdfUrl) await deletePdf(pdfUrl)
      await onDelete()
      toast.success('PDF removed')
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    }
  }

  const handleDownload = async (e) => {
    e.stopPropagation()
    try {
      const response = await fetch(pdfUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = pdfUrl.split('/').pop() || 'document.pdf'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Downloading PDF...')
    } catch (err) {
      window.open(pdfUrl, '_blank')
    }
  }

  if (uploading) {
    return (
      <div className="flex items-center gap-1.5 text-jio-blue-400 text-xs font-medium">
        <Loader2 size={13} className="animate-spin" /> Uploading…
      </div>
    )
  }

  if (pdfUrl) {
    return (
      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View PDF"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/70 text-red-400 border border-red-700/50 hover:bg-red-900 hover:text-white transition-colors text-xs font-semibold shadow-sm"
        >
          <Eye size={12} /> View
        </a>

        <button
          onClick={handleDownload}
          title="Download PDF"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors text-xs font-medium shadow-sm"
        >
          <Download size={12} /> Download
        </button>

        {isAdmin && (
          <button
            onClick={handleDelete}
            title="Delete PDF (Admin only)"
            className="p-1 rounded-lg hover:bg-jio-red-900/50 text-slate-500 hover:text-jio-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    )
  }

  if (!isAdmin) {
    return <span className="text-slate-600 text-xs">—</span>
  }

  return (
    <div onClick={e => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleUpload}
      />
      <button
        onClick={() => inputRef.current?.click()}
        title="Upload PDF (Admin only)"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-400 hover:bg-jio-blue-900/50 hover:text-jio-blue-300 transition-colors text-xs font-medium border border-slate-700 hover:border-jio-blue-700/60 shadow-sm"
      >
        <Upload size={12} /> Upload PDF
      </button>
    </div>
  )
}

import { useState, useRef } from 'react'
import { FileText, Upload, Trash2, Eye, Loader2 } from 'lucide-react'
import { uploadPdf, deletePdf } from '../lib/utils'
import toast from 'react-hot-toast'

/**
 * PdfCell — used inside table rows to show upload / view / delete PDF
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
      toast.success('PDF uploaded')
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Remove this PDF?')) return
    try {
      if (pdfUrl) await deletePdf(pdfUrl)
      await onDelete()
      toast.success('PDF removed')
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    }
  }

  if (uploading) {
    return (
      <div className="flex items-center gap-1 text-jio-blue-400 text-xs">
        <Loader2 size={13} className="animate-spin" /> Uploading…
      </div>
    )
  }

  if (pdfUrl) {
    return (
      <div className="flex items-center gap-1">
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View PDF"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/60 hover:text-white transition-colors text-xs font-medium"
        >
          <FileText size={12} /> View PDF
        </a>
        {isAdmin && (
          <button
            onClick={handleDelete}
            title="Remove PDF"
            className="p-1 rounded-lg hover:bg-red-900/40 text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    )
  }

  if (!isAdmin) {
    return <span className="text-slate-600 text-xs">—</span>
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleUpload}
      />
      <button
        onClick={() => inputRef.current?.click()}
        title="Upload PDF"
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:bg-jio-blue-900/50 hover:text-jio-blue-300 transition-colors text-xs font-medium border border-slate-700 hover:border-jio-blue-700"
      >
        <Upload size={12} /> Upload PDF
      </button>
    </>
  )
}

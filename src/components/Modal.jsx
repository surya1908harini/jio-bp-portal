import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, size = 'max-w-4xl' }) {
  useEffect(() => {
    if (!open) return

    // Prevent background page scrolling while modal is open
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handler)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className={`glass-card w-full ${size} max-h-[90vh] overflow-y-auto p-6 sm:p-7 border border-purple-500/30 shadow-2xl my-auto animate-slide-in flex flex-col justify-between`}>
        <div className="flex items-center justify-between mb-5 shrink-0 border-b border-slate-800 pb-3">
          <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

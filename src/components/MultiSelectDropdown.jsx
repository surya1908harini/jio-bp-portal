import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, X, Search } from 'lucide-react'

export default function MultiSelectDropdown({ options, selected = [], onChange, placeholder = 'Select options...' }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = options.filter(opt =>
    String(opt.label || opt).toLowerCase().includes(search.toLowerCase())
  )

  const toggleOption = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter(item => item !== val))
    } else {
      onChange([...selected, val])
    }
  }

  const toggleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([])
    } else {
      onChange(options.map(opt => opt.value !== undefined ? opt.value : opt))
    }
  }

  const isAllSelected = options.length > 0 && selected.length === options.length

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input-field flex items-center justify-between gap-2 text-left py-2 px-3 min-h-[38px] cursor-pointer"
      >
        <div className="flex items-center gap-1.5 flex-wrap overflow-hidden max-h-16">
          {selected.length === 0 ? (
            <span className="text-slate-400 text-xs">{placeholder}</span>
          ) : (
            <span className="text-xs font-bold text-white bg-purple-950 px-2 py-0.5 rounded-lg border border-purple-800 flex items-center gap-1">
              {selected.length} selected
            </span>
          )}
        </div>
        <ChevronDown size={14} className="text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-11 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[100] p-2.5 space-y-2 max-h-64 flex flex-col animate-fade-in backdrop-blur-xl">
          <div className="relative">
            <input
              type="text"
              placeholder="Search options..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field py-1.5 pl-8 text-xs"
            />
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold border-b border-slate-800">
            <button type="button" onClick={toggleSelectAll} className="text-purple-400 hover:text-purple-300">
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </button>
            {selected.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="text-rose-400 hover:text-rose-300">
                Clear ({selected.length})
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1 space-y-1 pr-1">
            {filteredOptions.length === 0 ? (
              <p className="text-center py-4 text-xs text-slate-500">No options match search</p>
            ) : (
              filteredOptions.map(opt => {
                const val = opt.value !== undefined ? opt.value : opt
                const label = opt.label || opt
                const isSelected = selected.includes(val)
                return (
                  <div
                    key={val}
                    onClick={() => toggleOption(val)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">{label}</span>
                    {isSelected && <Check size={14} className="text-purple-400 shrink-0" />}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

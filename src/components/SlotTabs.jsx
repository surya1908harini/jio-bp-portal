export default function SlotTabs({ slots, active, setActive, activeSlot, onChange }) {
  const currentActive = active ?? activeSlot
  const changeHandler = setActive ?? onChange

  return (
    <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl w-fit backdrop-blur-xl shadow-lg flex-wrap">
      {slots.map(s => (
        <button
          key={s.key}
          type="button"
          onClick={() => changeHandler?.(s.key)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
            currentActive === s.key
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

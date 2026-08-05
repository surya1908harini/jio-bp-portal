export default function SlotTabs({ slots, active, setActive, activeSlot, onChange }) {
  const currentActive = active ?? activeSlot
  const changeHandler = setActive ?? onChange

  return (
    <div className="flex gap-1 p-1 bg-slate-900 rounded-xl w-fit flex-wrap">
      {slots.map(s => (
        <button
          key={s.key}
          type="button"
          onClick={() => changeHandler?.(s.key)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
            currentActive === s.key
              ? 'bg-jio-blue-700 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

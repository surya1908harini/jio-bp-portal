export default function SlotTabs({ slots, active, setActive, activeSlot, onChange }) {
  const currentActive = active ?? activeSlot
  const changeHandler = setActive ?? onChange

  return (
    <select
      value={currentActive}
      onChange={(e) => changeHandler?.(e.target.value)}
      className="input-field py-1.5 px-3 text-xs font-semibold bg-white dark:bg-[#1e1e2d] border border-gray-200 dark:border-gray-800 w-auto rounded-xl"
    >
      {slots.map(s => (
        <option key={s.key} value={s.key}>{s.label}</option>
      ))}
    </select>
  )
}

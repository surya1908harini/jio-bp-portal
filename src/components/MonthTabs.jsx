export const MONTHS = [
  { value: 'all', label: 'All Months' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
]

export default function MonthTabs({ activeMonth, onChange }) {
  return (
    <select
      value={activeMonth}
      onChange={(e) => onChange(e.target.value)}
      className="input-field py-1.5 px-3 text-xs font-semibold bg-slate-900 border border-slate-700 w-auto rounded-xl"
    >
      {MONTHS.map(m => (
        <option key={m.value} value={m.value}>{m.label}</option>
      ))}
    </select>
  )
}

import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FINANCIAL_YEARS, CURRENT_FY } from '../lib/utils'

export default function FyTabs({ basePath }) {
  const { fy } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const activeFy = fy || searchParams.get('fy') || CURRENT_FY

  const handleSelect = (e) => {
    navigate(`${basePath}?fy=${e.target.value}`, { replace: true })
  }

  return (
    <select
      value={activeFy}
      onChange={handleSelect}
      className="input-field py-1.5 px-3 text-xs font-semibold bg-white dark:bg-[#1e1e2d] border border-gray-200 dark:border-gray-800 w-auto rounded-xl"
    >
      <option value="overall">Overall FY</option>
      {FINANCIAL_YEARS.map(f => (
        <option key={f} value={f}>FY {f}</option>
      ))}
    </select>
  )
}

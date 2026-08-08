import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FINANCIAL_YEARS, CURRENT_FY } from '../lib/utils'

export default function FyTabs({ basePath }) {
  const { fy } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const activeFy = fy || searchParams.get('fy') || CURRENT_FY

  const handleSelect = (targetFy) => {
    navigate(`${basePath}?fy=${targetFy}`, { replace: true })
  }

  return (
    <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl w-fit backdrop-blur-xl shadow-lg flex-wrap">
      <button
        type="button"
        onClick={() => handleSelect('overall')}
        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
          activeFy === 'overall'
            ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-md shadow-purple-600/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
        }`}
      >
        Overall FY
      </button>
      {FINANCIAL_YEARS.map(f => (
        <button
          type="button"
          key={f}
          onClick={() => handleSelect(f)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
            activeFy === f
              ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          FY {f}
        </button>
      ))}
    </div>
  )
}

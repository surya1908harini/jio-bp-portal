import { Link, useParams } from 'react-router-dom'
import { FINANCIAL_YEARS } from '../lib/utils'

export default function FyTabs({ basePath }) {
  const { fy } = useParams()
  // Default to 'overall' if no fy is specified in the URL
  const activeFy = fy || 'overall'

  return (
    <div className="flex gap-1 p-1 bg-slate-900 rounded-xl w-fit">
      <Link
        to={`${basePath}/overall`}
        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
          activeFy === 'overall'
            ? 'bg-jio-blue-700 text-white shadow'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
      >
        Overall FY
      </Link>
      {FINANCIAL_YEARS.map(f => (
        <Link
          key={f}
          to={`${basePath}/${f}`}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
            activeFy === f
              ? 'bg-jio-blue-700 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          FY {f}
        </Link>
      ))}
    </div>
  )
}

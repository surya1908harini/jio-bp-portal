import React, { useState } from 'react'
import { Plus, Save, Copy, Trash2, Info } from 'lucide-react'
import Papa from 'papaparse'
import toast from 'react-hot-toast'

export default function SpreadsheetGrid({ columns, onSave, title }) {
  const [rows, setRows] = useState([{}])

  const handleAddRow = () => {
    setRows([...rows, {}])
  }

  const handleRemoveRow = (index) => {
    if (rows.length === 1) return setRows([{}])
    const newRows = [...rows]
    newRows.splice(index, 1)
    setRows(newRows)
  }

  const handleChange = (index, key, value) => {
    const newRows = [...rows]
    newRows[index] = { ...newRows[index], [key]: value }
    setRows(newRows)
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('Text')
    if (!text) return

    Papa.parse(text, {
      delimiter: '\t', // Excel uses tab separated values in clipboard
      skipEmptyLines: true,
      complete: (results) => {
        const rawRows = results.data
        const newRows = rawRows.map(cells => {
          const rowObj = {}
          columns.forEach((col, i) => {
            rowObj[col.key] = cells[i]?.trim() || ''
          })
          return rowObj
        })

        if (newRows.length > 0) {
          setRows(newRows)
          toast.success(`Imported ${newRows.length} rows from clipboard!`)
        }
      }
    })
  }

  const handleSubmit = () => {
    // Filter out completely empty rows
    const validRows = rows.filter(r => Object.values(r).some(v => v !== '' && v !== undefined && v !== null))
    if (validRows.length === 0) {
      return toast.error('No valid data to save')
    }
    onSave(validRows)
  }

  return (
    <div className="bg-white dark:bg-[#151521] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-[calc(100vh-200px)]">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-[#1a1a24]">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">{title || 'Bulk Create'}</h2>
          <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded-full flex items-center gap-1">
            <Info size={12} /> Tip: Click inside the table and press Ctrl+V to paste directly from Excel!
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleAddRow} className="btn-secondary text-xs py-1.5">
            <Plus size={14} /> Add Row
          </button>
          <button onClick={handleSubmit} className="btn-primary text-xs py-1.5">
            <Save size={14} /> Save All ({rows.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-[#151521] p-4 relative" onPaste={handlePaste}>
        <div className="inline-block min-w-full align-middle">
          <div className="border border-gray-300 dark:border-gray-700 rounded shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
              <thead className="bg-gray-100 dark:bg-[#1e1e2d]">
                <tr>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-500 w-10">#</th>
                  {columns.map((col, i) => (
                    <th key={col.key} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap border-l border-gray-300 dark:border-gray-700">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-500 border-l border-gray-300 dark:border-gray-700 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 dark:divide-gray-700 bg-white dark:bg-[#151521]">
                {rows.map((row, rIndex) => (
                  <tr key={rIndex} className="hover:bg-gray-50 dark:hover:bg-[#1a1a24] group">
                    <td className="px-2 py-1.5 text-center text-xs text-gray-400 bg-gray-50 dark:bg-[#1e1e2d]">
                      {rIndex + 1}
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className="p-0 border-l border-gray-300 dark:border-gray-700">
                        <input
                          type={col.type || 'text'}
                          value={row[col.key] || ''}
                          onChange={(e) => handleChange(rIndex, col.key, e.target.value)}
                          className="w-full h-full min-w-[120px] px-3 py-2 text-sm bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-jio-blue-500 text-gray-900 dark:text-white outline-none"
                          placeholder={`Enter ${col.label}`}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center border-l border-gray-300 dark:border-gray-700">
                      <button 
                        onClick={() => handleRemoveRow(rIndex)}
                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        title="Remove Row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

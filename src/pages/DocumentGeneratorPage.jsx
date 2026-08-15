import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer, FileText, Settings2, LayoutTemplate } from 'lucide-react'
import ModuleHeader from '../components/ModuleHeader'
import { jmsDb, invoiceDb } from '../lib/db'
import { formatINR, formatDate } from '../lib/utils'

export default function DocumentGeneratorPage() {
  const [docType, setDocType] = useState('FSR') // 'FSR' or 'INVOICE'
  const [selectedRecordId, setSelectedRecordId] = useState('')

  // Fetch records
  const { data: jmsRecords = [] } = useQuery({ queryKey: ['jms', 'all'], queryFn: () => jmsDb.listAll() })
  const { data: invRecords = [] } = useQuery({ queryKey: ['invoices', 'overall'], queryFn: () => invoiceDb.listAll() })

  const currentRecord = useMemo(() => {
    if (!selectedRecordId) return null
    if (docType === 'FSR') return jmsRecords.find(r => String(r.id) === String(selectedRecordId))
    return invRecords.find(r => String(r.id) === String(selectedRecordId))
  }, [docType, selectedRecordId, jmsRecords, invRecords])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 animate-page-enter print:m-0 print:p-0">
      <div className="print:hidden">
        <ModuleHeader title="Document Generator" subtitle="Generate printable FSR and Invoice documents instantly." />
      </div>

      {/* Control Panel (Hidden during Print) */}
      <div className="bg-white dark:bg-[#1e1e2d] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-jio-blue-50 dark:bg-jio-blue-900/30 rounded-lg text-jio-blue-600">
              <Settings2 size={20} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1 uppercase tracking-wider">Document Type</label>
              <select
                value={docType}
                onChange={(e) => { setDocType(e.target.value); setSelectedRecordId(''); }}
                className="input-field py-2"
              >
                <option value="FSR">Field Service Report (FSR)</option>
                <option value="INVOICE">Tax Invoice</option>
              </select>
            </div>
          </div>

          <div className="w-px h-10 bg-gray-200 dark:bg-gray-700 hidden md:block"></div>

          <div className="flex-1 min-w-[300px]">
            <label className="text-xs font-semibold text-gray-500 block mb-1 uppercase tracking-wider">Select Record</label>
            <select
              value={selectedRecordId}
              onChange={(e) => setSelectedRecordId(e.target.value)}
              className="input-field py-2"
            >
              <option value="">-- Select {docType === 'FSR' ? 'JMS Record' : 'Invoice Record'} --</option>
              {docType === 'FSR' 
                ? jmsRecords.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.jms_no} - {r.site} ({formatINR(r.net_amount)})
                    </option>
                  ))
                : invRecords.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.inv_number} - {r.site} ({formatINR(r.grand_total)})
                    </option>
                  ))
              }
            </select>
          </div>

          <button
            onClick={handlePrint}
            disabled={!currentRecord}
            className="btn-primary py-2.5 px-6 shadow-lg shadow-jio-blue-500/20 self-end disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={18} className="mr-2" />
            Print / Export PDF
          </button>
        </div>
      </div>

      {/* Document Template Container */}
      {!currentRecord ? (
        <div className="card p-16 flex flex-col items-center justify-center text-gray-400 print:hidden">
          <LayoutTemplate size={48} className="mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">No Record Selected</h3>
          <p className="text-sm">Please select a record from the dropdown to generate the document.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-xl mx-auto rounded-none w-full max-w-[210mm] min-h-[297mm] p-[20mm] print:shadow-none print:border-none print:p-0 print:m-0 text-black">
          {/* A4 Size Paper Wrapper */}
          
          {docType === 'FSR' ? (
            <FSRTemplate record={currentRecord} />
          ) : (
            <InvoiceTemplate record={currentRecord} />
          )}

        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------
// TEMPLATES
// ----------------------------------------------------------------------

function FSRTemplate({ record }) {
  return (
    <div className="font-sans text-[12px] leading-relaxed">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold uppercase tracking-widest border-b-2 border-black pb-2 inline-block">Field Service Report (FSR)</h1>
      </div>
      
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <table className="w-full text-left">
            <tbody>
              <tr><th className="py-1 w-32 align-top">JMS No:</th><td className="py-1 font-semibold">{record.jms_no || '-'}</td></tr>
              <tr><th className="py-1 w-32 align-top">Work Order No:</th><td className="py-1 font-semibold">{record.work_order_number || '-'}</td></tr>
              <tr><th className="py-1 w-32 align-top">Date:</th><td className="py-1 font-semibold">{formatDate(record.jms_create_date) || '-'}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <table className="w-full text-left">
            <tbody>
              <tr><th className="py-1 w-24 align-top">Site:</th><td className="py-1 font-semibold uppercase">{record.site || '-'}</td></tr>
              <tr><th className="py-1 w-24 align-top">RO Code:</th><td className="py-1 font-semibold uppercase">{record.ro_code || '-'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="font-bold border-b border-gray-400 mb-2">Description of Work</h3>
        <p className="whitespace-pre-wrap uppercase font-medium">{record.work_description || '-'}</p>
      </div>

      <table className="w-full border-collapse border border-black mb-6">
        <thead className="bg-gray-100">
          <tr>
            <th className="border border-black p-2 text-center w-12">S.No</th>
            <th className="border border-black p-2 text-left">Particulars / Description</th>
            <th className="border border-black p-2 text-center w-24">Unit</th>
            <th className="border border-black p-2 text-center w-24">Qty</th>
            <th className="border border-black p-2 text-right w-32">Rate</th>
            <th className="border border-black p-2 text-right w-32">Amount</th>
          </tr>
        </thead>
        <tbody>
          {/* Generic placeholder rows for the grid until format is provided */}
          <tr>
            <td className="border border-black p-2 text-center">1</td>
            <td className="border border-black p-2 text-left uppercase font-medium">{record.work_description || '-'}</td>
            <td className="border border-black p-2 text-center">LS</td>
            <td className="border border-black p-2 text-center">1</td>
            <td className="border border-black p-2 text-right">{formatINR(record.net_amount || 0).replace('₹', '')}</td>
            <td className="border border-black p-2 text-right font-bold">{formatINR(record.net_amount || 0).replace('₹', '')}</td>
          </tr>
          {/* Empty rows to mimic an excel sheet */}
          {[...Array(5)].map((_, i) => (
            <tr key={i} className="h-8">
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
            </tr>
          ))}
          <tr className="bg-gray-100 font-bold text-sm">
            <td colSpan={5} className="border border-black p-2 text-right uppercase">Total Net Amount</td>
            <td className="border border-black p-2 text-right text-lg">{formatINR(record.net_amount || 0)}</td>
          </tr>
        </tbody>
      </table>
      
      <div className="mt-20 grid grid-cols-3 text-center">
        <div>
          <div className="border-t border-black w-3/4 mx-auto pt-2 font-bold uppercase">Contractor Sign</div>
        </div>
        <div>
          <div className="border-t border-black w-3/4 mx-auto pt-2 font-bold uppercase">Jio-BP Engineer</div>
        </div>
        <div>
          <div className="border-t border-black w-3/4 mx-auto pt-2 font-bold uppercase">Authorized Signatory</div>
        </div>
      </div>
      
      <div className="mt-10 text-center text-[10px] text-gray-500 italic border-t pt-4">
        * This is a system generated Field Service Report. Generic format applied until requested format is provided.
      </div>
    </div>
  )
}

function InvoiceTemplate({ record }) {
  return (
    <div className="font-sans text-[12px] leading-relaxed">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold uppercase tracking-widest border-b-2 border-black pb-2 inline-block">Tax Invoice</h1>
      </div>
      
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="border border-black p-3">
          <h3 className="font-bold mb-2 border-b border-gray-300 pb-1">Billed To:</h3>
          <p className="font-semibold uppercase">Jio-BP (Reliance BP Mobility Limited)</p>
          <p className="mt-2"><span className="font-semibold">GSTIN:</span> {record.gst_no || '-'}</p>
          <p><span className="font-semibold">Site:</span> {record.site || '-'}</p>
        </div>
        <div className="border border-black p-3">
          <h3 className="font-bold mb-2 border-b border-gray-300 pb-1">Invoice Details:</h3>
          <table className="w-full text-left">
            <tbody>
              <tr><th className="py-0.5 w-24">Invoice No:</th><td className="py-0.5 font-bold text-sm">{record.inv_number || '-'}</td></tr>
              <tr><th className="py-0.5 w-24">Date:</th><td className="py-0.5 font-semibold">{formatDate(record.inv_date) || '-'}</td></tr>
              <tr><th className="py-0.5 w-24">JMS No:</th><td className="py-0.5 font-semibold">{record.jms_no || '-'}</td></tr>
              <tr><th className="py-0.5 w-24">WO No:</th><td className="py-0.5 font-semibold">{record.work_order_number || '-'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <table className="w-full border-collapse border border-black mb-6">
        <thead className="bg-gray-100">
          <tr>
            <th className="border border-black p-2 text-center w-12">S.No</th>
            <th className="border border-black p-2 text-left">Description of Goods/Services</th>
            <th className="border border-black p-2 text-center w-24">SAC Code</th>
            <th className="border border-black p-2 text-right w-32">Taxable Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-2 text-center align-top">1</td>
            <td className="border border-black p-2 text-left uppercase font-medium align-top min-h-[100px] block">
              {record.work_description || '-'}
            </td>
            <td className="border border-black p-2 text-center align-top">{record.sac_code || '-'}</td>
            <td className="border border-black p-2 text-right align-top">{formatINR(record.total || 0).replace('₹', '')}</td>
          </tr>
          
          <tr className="border-t border-black">
            <td colSpan={3} className="border-r border-black p-2 text-right font-bold">Total Taxable Value</td>
            <td className="p-2 text-right font-bold">{formatINR(record.total || 0).replace('₹', '')}</td>
          </tr>
          
          {Number(record.cgst) > 0 && (
            <tr>
              <td colSpan={3} className="border-r border-black p-1.5 text-right text-gray-700">Add: CGST</td>
              <td className="p-1.5 text-right">{formatINR(record.cgst).replace('₹', '')}</td>
            </tr>
          )}
          {Number(record.sgst) > 0 && (
            <tr>
              <td colSpan={3} className="border-r border-black p-1.5 text-right text-gray-700">Add: SGST</td>
              <td className="p-1.5 text-right">{formatINR(record.sgst).replace('₹', '')}</td>
            </tr>
          )}
          {Number(record.igst) > 0 && (
            <tr>
              <td colSpan={3} className="border-r border-black p-1.5 text-right text-gray-700">Add: IGST</td>
              <td className="p-1.5 text-right">{formatINR(record.igst).replace('₹', '')}</td>
            </tr>
          )}
          
          <tr className="bg-gray-100 border-y border-black font-bold text-sm">
            <td colSpan={3} className="border-r border-black p-2 text-right uppercase">Grand Total</td>
            <td className="p-2 text-right text-lg">{formatINR(record.grand_total || 0)}</td>
          </tr>
        </tbody>
      </table>
      
      <div className="mt-16 text-right">
        <p className="font-bold uppercase mb-8">For Contractor / Vendor</p>
        <div className="border-t border-black w-48 ml-auto pt-2 font-bold uppercase">Authorized Signatory</div>
      </div>
      
      <div className="mt-10 text-center text-[10px] text-gray-500 italic border-t pt-4">
        * This is a system generated Invoice. Generic format applied until requested format is provided.
      </div>
    </div>
  )
}

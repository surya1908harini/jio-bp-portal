import React, { useState, useEffect, useRef } from 'react'
import { Printer, Plus, Trash2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import ModuleHeader from '../components/ModuleHeader'
import { workOrderDb, jmsDb } from '../lib/db'

export default function FSRGeneratorPage() {
  const [workOrders, setWorkOrders] = useState([])
  const [selectedWo, setSelectedWo] = useState('')
  const [woItems, setWoItems] = useState([])
  const [masterData, setMasterData] = useState([]) // From JMS for autofill

  // FSR Form State
  const [fsrData, setFsrData] = useState({
    roName: '',
    roAddress: '',
    roCode: '',
    roType: '',
    imNumber: '',
    equipment: '',
    vendorCode: '233954',
    vendorName: 'MM CONTRACTOR',
    timeReporting: '',
    dateReporting: '',
    timeCompletion: '',
    dateCompletion: '',
    workDescription: '',
    engineerRemarks: '',
    operatorRemarks: '',
    engineerName: '',
    operatorName: '',
    engineerMobile: '',
    operatorMobile: ''
  })

  // Dynamic Rows State
  const [items, setItems] = useState([
    { id: Date.now(), itemCode: '', description: '', rate: 0, unit: '', quantity: 0 }
  ])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedWo) {
      loadWoItems(selectedWo)
    } else {
      setWoItems([])
    }
  }, [selectedWo])

  const loadData = async () => {
    try {
      const wos = await workOrderDb.getAll()
      setWorkOrders(wos || [])
      
      // Load JMS for RO Master Data Autofill
      const jms = await jmsDb.getAll()
      if (jms && jms.length > 0) {
        // Extract unique ROs
        const uniqueROs = []
        const map = new Map()
        for (const item of jms) {
          if (item.ro_code && !map.has(item.ro_code)) {
            map.set(item.ro_code, true)
            uniqueROs.push({
              roCode: item.ro_code,
              roName: item.site || '',
              roType: item.type_of_ro || ''
            })
          }
        }
        setMasterData(uniqueROs)
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to load data')
    }
  }

  const loadWoItems = async (woId) => {
    try {
      const data = await workOrderDb.getItemsByWoId(woId)
      setWoItems(data || [])
    } catch (error) {
      console.error(error)
      toast.error('Failed to load Work Order items')
    }
  }

  // --- Handlers ---
  const handleFsrChange = (e) => {
    const { name, value } = e.target
    const updates = { [name]: value }

    // Autofill Logic
    if (name === 'roCode') {
      const match = masterData.find(m => m.roCode.toUpperCase() === value.toUpperCase())
      if (match) {
        updates.roName = match.roName
        updates.roType = match.roType
      }
    } else if (name === 'roName') {
      const match = masterData.find(m => m.roName.toUpperCase() === value.toUpperCase())
      if (match) {
        updates.roCode = match.roCode
        updates.roType = match.roType
      }
    }

    setFsrData(prev => ({ ...prev, ...updates }))
  }

  const addItemRow = () => {
    setItems([...items, { id: Date.now(), itemCode: '', description: '', rate: 0, unit: '', quantity: 0 }])
  }

  const removeItemRow = (id) => {
    setItems(items.filter(item => item.id !== id))
  }

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value }
        
        // Smart Autofill for Item Code
        if (field === 'itemCode' && selectedWo) {
          const match = woItems.find(w => w.item_code === value)
          if (match) {
            updatedItem.description = match.description
            updatedItem.rate = match.rate
            updatedItem.unit = match.unit
          }
        }
        return updatedItem
      }
      return item
    }))
  }

  // Calculations (Preview Only)
  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (parseFloat(item.quantity || 0) * parseFloat(item.rate || 0)), 0)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 animate-page-enter pb-20">
      {/* Hide Header in Print */}
      <div className="print:hidden">
        <ModuleHeader title="Smart FSR Generator" subtitle="Generate Field Service Reports automatically from Work Orders." />
      </div>
      
      {/* Configuration Section (Hidden in Print) */}
      <div className="card p-6 print:hidden border-l-4 border-jio-blue-500 mb-6 bg-jio-blue-50 dark:bg-[#1a1a24]">
        <h3 className="font-bold mb-4 flex items-center"><Search size={18} className="mr-2" /> FSR Setup</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Select Work Order (PDF Data)</label>
            <select 
              value={selectedWo} 
              onChange={(e) => setSelectedWo(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:border-jio-blue-500"
            >
              <option value="">-- Select Work Order --</option>
              {workOrders.map(wo => (
                <option key={wo.id} value={wo.id}>{wo.wo_number}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
             <button onClick={handlePrint} className="btn-primary py-2 px-6 shadow-md w-full md:w-auto h-10">
              <Printer size={16} className="mr-2" /> Print FSR
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------
          PRINTABLE FSR TEMPLATE
      --------------------------------------------------------- */}
      <div className="bg-white text-black p-4 md:p-8 shadow-xl max-w-[210mm] mx-auto print:shadow-none print:p-0 print:m-0 text-[11px] leading-tight font-sans">
        
        {/* FSR Header Table */}
        <table className="w-full border-collapse border border-black table-fixed mb-0">
          <tbody>
            <tr>
              <th colSpan={3} className="border border-black p-1 text-center font-bold uppercase text-sm tracking-wide">
                FIELD SERVICE REPORT
              </th>
            </tr>
            <tr>
              <td className="border border-black p-1 align-top"><strong className="mr-1 block">RO Name :</strong> 
                <input type="text" name="roName" value={fsrData.roName} onChange={handleFsrChange} className="w-full outline-none bg-transparent" />
              </td>
              <td className="border border-black p-1 align-top"><strong className="mr-1 block">IM number reference :</strong> 
                <input type="text" name="imNumber" value={fsrData.imNumber} onChange={handleFsrChange} className="w-full outline-none bg-transparent" />
              </td>
              <td className="border border-black p-1 align-top"><strong className="mr-1 block">Time of Reporting :</strong> 
                <input type="time" name="timeReporting" value={fsrData.timeReporting} onChange={handleFsrChange} className="w-full outline-none bg-transparent" />
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1 align-top"><strong className="mr-1 block">RO Address :</strong> 
                <input type="text" name="roAddress" value={fsrData.roAddress} onChange={handleFsrChange} className="w-full outline-none bg-transparent" />
              </td>
              <td className="border border-black p-1 align-top"><strong className="mr-1 block">Equipment :</strong> 
                <input type="text" name="equipment" value={fsrData.equipment} onChange={handleFsrChange} className="w-full outline-none bg-transparent" />
              </td>
              <td className="border border-black p-1 align-top"><strong className="mr-1 block">Date of Reporting :</strong> 
                <input type="date" name="dateReporting" value={fsrData.dateReporting} onChange={handleFsrChange} className="w-full outline-none bg-transparent" />
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1 align-top"><strong className="mr-1 block">RO Code :</strong> 
                <input type="text" name="roCode" value={fsrData.roCode} onChange={handleFsrChange} className="w-full outline-none bg-transparent uppercase" />
              </td>
              <td className="border border-black p-1 align-top"><strong className="mr-1 block">Vendor Code :</strong> 
                <input type="text" name="vendorCode" value={fsrData.vendorCode} onChange={handleFsrChange} className="w-full outline-none bg-transparent" />
              </td>
              <td className="border border-black p-1 align-top"><strong className="mr-1 block">Time of Completion :</strong> 
                <input type="time" name="timeCompletion" value={fsrData.timeCompletion} onChange={handleFsrChange} className="w-full outline-none bg-transparent" />
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1 align-top"><strong className="mr-1 block">RO type (CO/DO) :</strong> 
                <input type="text" name="roType" value={fsrData.roType} onChange={handleFsrChange} className="w-full outline-none bg-transparent" />
              </td>
              <td className="border border-black p-1 align-top"><strong className="mr-1 block">Vendor Name :</strong> 
                <input type="text" name="vendorName" value={fsrData.vendorName} onChange={handleFsrChange} className="w-full outline-none bg-transparent" />
              </td>
              <td className="border border-black p-1 align-top"><strong className="mr-1 block">Date of Completion :</strong> 
                <input type="date" name="dateCompletion" value={fsrData.dateCompletion} onChange={handleFsrChange} className="w-full outline-none bg-transparent" />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Dynamic Items Table */}
        <table className="w-full border-collapse border-x border-black mb-0">
          <thead>
            <tr>
              <th className="border border-black p-1 text-center w-12 font-bold">Sl. NO</th>
              <th className="border border-black p-1 text-left font-bold">Description of Material / Service</th>
              <th className="border border-black p-1 text-center w-24 font-bold">Unit</th>
              <th className="border border-black p-1 text-center w-24 font-bold">Measurements</th>
              
              {/* HIDDEN IN PRINT - For preview and calculation only */}
              <th className="border border-black p-1 text-center w-24 font-bold print:hidden bg-yellow-100">Item Code</th>
              <th className="border border-black p-1 text-right w-24 font-bold print:hidden bg-yellow-100">Rate</th>
              <th className="border border-black p-1 text-right w-24 font-bold print:hidden bg-yellow-100">Total</th>
              <th className="border border-black p-1 text-center w-10 font-bold print:hidden bg-red-100"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="align-top">
                <td className="border border-black px-1 text-center pt-1">{index + 1}</td>
                <td className="border border-black px-1">
                  <textarea 
                    value={item.description} 
                    onChange={(e) => handleItemChange(item.id, 'description', e.target.value)} 
                    className="w-full outline-none bg-transparent resize-none min-h-[40px] uppercase pt-1" 
                  />
                </td>
                <td className="border border-black px-1">
                   <input type="text" value={item.unit} onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)} className="w-full outline-none bg-transparent text-center pt-1" placeholder="e.g. M" />
                </td>
                <td className="border border-black px-1">
                  <input type="number" value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)} className="w-full outline-none bg-transparent text-center pt-1" placeholder="Qty" />
                </td>

                {/* HIDDEN IN PRINT */}
                <td className="border border-black px-1 print:hidden bg-yellow-50">
                  <input type="text" value={item.itemCode} onChange={(e) => handleItemChange(item.id, 'itemCode', e.target.value)} className="w-full outline-none bg-transparent text-center font-mono pt-1" placeholder="Code" />
                </td>
                <td className="border border-black px-1 print:hidden bg-yellow-50 text-right pt-1">
                  {parseFloat(item.rate).toLocaleString('en-IN')}
                </td>
                <td className="border border-black px-1 print:hidden bg-yellow-50 text-right font-bold pt-1 text-jio-blue-700">
                  {(parseFloat(item.quantity || 0) * parseFloat(item.rate || 0)).toLocaleString('en-IN')}
                </td>
                <td className="border border-black px-1 print:hidden bg-red-50 text-center pt-1">
                  <button onClick={() => removeItemRow(item.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
                </td>
              </tr>
            ))}
            
            {/* Action Row & Preview Total (Hidden in Print) */}
            <tr className="print:hidden">
              <td colSpan={4} className="border border-black p-2 bg-gray-50 text-left">
                <button onClick={addItemRow} className="text-jio-blue-600 font-bold flex items-center hover:underline"><Plus size={14} className="mr-1" /> Add Row</button>
              </td>
              <td colSpan={2} className="border border-black p-2 bg-yellow-100 text-right font-bold">Preview Total:</td>
              <td className="border border-black p-2 bg-yellow-200 text-right font-bold text-lg text-green-700">₹{calculateTotal().toLocaleString('en-IN')}</td>
              <td className="border border-black bg-gray-50"></td>
            </tr>

            {/* Empty filler rows for printed FSR appearance */}
            {[...Array(Math.max(0, 15 - items.length))].map((_, i) => (
              <tr key={`filler-${i}`} className="h-6 print:table-row hidden">
                <td className="border border-black"></td>
                <td className="border border-black"></td>
                <td className="border border-black"></td>
                <td className="border border-black"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Work Description Box */}
        <div className="border border-black p-1 min-h-[60px] flex flex-col">
          <div className="font-bold mb-1">WORK DESCRIPTION:</div>
          <textarea 
            name="workDescription"
            value={fsrData.workDescription}
            onChange={handleFsrChange}
            className="flex-1 w-full outline-none bg-transparent resize-none uppercase"
          />
        </div>

        {/* Footer Remarks & Signatures */}
        <table className="w-full border-collapse border-x border-b border-black table-fixed">
          <tbody>
            <tr>
              <td className="border border-black p-1 w-1/2 align-top h-14">
                <strong className="block mb-1">Service Engineer Remarks</strong>
                <textarea name="engineerRemarks" value={fsrData.engineerRemarks} onChange={handleFsrChange} className="w-full h-full outline-none bg-transparent resize-none text-xs" />
              </td>
              <td className="border border-black p-1 w-1/2 align-top">
                <strong className="block mb-1">RO Operator / Key Person Remarks</strong>
                <textarea name="operatorRemarks" value={fsrData.operatorRemarks} onChange={handleFsrChange} className="w-full h-full outline-none bg-transparent resize-none text-xs" />
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1">
                <strong className="mr-1">Service Engineer Name:</strong> 
                <input type="text" name="engineerName" value={fsrData.engineerName} onChange={handleFsrChange} className="outline-none bg-transparent w-48" />
              </td>
              <td className="border border-black p-1">
                <strong className="mr-1">RO Operator / Key Person Name:</strong> 
                <input type="text" name="operatorName" value={fsrData.operatorName} onChange={handleFsrChange} className="outline-none bg-transparent w-48" />
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1">
                <strong className="mr-1">Mobile Number:</strong> 
                <input type="text" name="engineerMobile" value={fsrData.engineerMobile} onChange={handleFsrChange} className="outline-none bg-transparent w-48" />
              </td>
              <td className="border border-black p-1">
                <strong className="mr-1">RO Mobile Number:</strong> 
                <input type="text" name="operatorMobile" value={fsrData.operatorMobile} onChange={handleFsrChange} className="outline-none bg-transparent w-48" />
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1 align-top h-28 relative">
                <strong>Signature with company seal:</strong>
              </td>
              <td className="border border-black p-1 align-top h-28 relative">
                <strong>Signature with date & RO Seal:</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

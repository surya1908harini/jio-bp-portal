import { supabase } from './supabase'
import * as XLSX from 'xlsx'

// ──────────────────────────────────────────────
// Export any dataset to Excel
// ──────────────────────────────────────────────
export function exportToExcel(data, filename = 'export.xlsx', sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

// ──────────────────────────────────────────────
// Parse uploaded Excel / CSV file → JSON rows
// ──────────────────────────────────────────────
export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data  = new Uint8Array(e.target.result)
        const wb    = XLSX.read(data, { type: 'array', cellDates: true })
        const ws    = wb.Sheets[wb.SheetNames[0]]
        const rows  = XLSX.utils.sheet_to_json(ws, { defval: '' })
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ──────────────────────────────────────────────
// Upload PDF to Supabase Storage
// ──────────────────────────────────────────────
export async function uploadPdf(file, folder = 'general') {
  const ext      = file.name.split('.').pop()
  const filename = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await supabase.storage
    .from('portal-docs')
    .upload(filename, file, { contentType: file.type, upsert: false })

  if (error) throw error

  const { data: urlData } = supabase.storage
    .from('portal-docs')
    .getPublicUrl(data.path)

  return urlData.publicUrl
}

// ──────────────────────────────────────────────
// Delete PDF from Supabase Storage
// ──────────────────────────────────────────────
export async function deletePdf(publicUrl) {
  // Extract path from public URL
  const url     = new URL(publicUrl)
  const parts   = url.pathname.split('/portal-docs/')
  if (parts.length < 2) return
  const path = parts[1]
  await supabase.storage.from('portal-docs').remove([path])
}

// ──────────────────────────────────────────────
// Format currency (INR)
// ──────────────────────────────────────────────
export function formatINR(amount) {
  if (amount === null || amount === undefined || amount === '') return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)
}

// ──────────────────────────────────────────────
// Format date display (DD/MM/YYYY)
// ──────────────────────────────────────────────
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const str = String(dateStr).trim()
    const d = new Date(str)
    if (isNaN(d.getTime())) return dateStr
    const day   = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year  = d.getFullYear()
    return `${day}/${month}/${year}`
  } catch (err) {
    return String(dateStr)
  }
}

// ──────────────────────────────────────────────
// Derive financial year from date (auto-detect)
// ──────────────────────────────────────────────
export function getFinancialYear(date = new Date()) {
  const d  = new Date(date)
  const m  = d.getMonth() // 0-indexed; April = 3
  const y  = d.getFullYear()
  const fy = m >= 3 ? y : y - 1
  return `${fy}-${String(fy + 1).slice(2)}`
}

// Current FY auto-detected
export const CURRENT_FY = getFinancialYear()

export const FINANCIAL_YEARS = ['2023-24', '2024-25', '2025-26', '2026-27']

export const JMS_STATUSES = ['Pending A1', 'Pending A2', 'Pending QSD', 'Pending A3', 'Released by A3']
export const PAYMENT_STATUSES = [
  'Pending',
  'GST Payment Only Received',
  'Net Amount Received',
  'Full Payment Received',
]

// ──────────────────────────────────────────────
// Parse contract validity & calculate days remaining
// ──────────────────────────────────────────────
export function parseValidity(validityStr) {
  if (!validityStr) return { startDate: null, endDate: null, daysRemaining: null, totalDays: null, status: 'unknown' }

  try {
    const str = String(validityStr).trim()
    // Match YYYY-MM-DD
    let rawDates = str.match(/\d{4}-\d{2}-\d{2}/g)

    // If no YYYY-MM-DD found, try DD-MM-YYYY or DD/MM/YYYY
    if (!rawDates) {
      const ddmmyyyy = str.match(/\d{2}[-/]\d{2}[-/]\d{4}/g)
      if (ddmmyyyy) {
        rawDates = ddmmyyyy.map(d => {
          const parts = d.split(/[-/]/)
          return `${parts[2]}-${parts[1]}-${parts[0]}` // convert to YYYY-MM-DD
        })
      }
    }

    if (!rawDates || rawDates.length === 0) {
      return { startDate: null, endDate: null, daysRemaining: null, totalDays: null, status: 'unknown' }
    }

    const startDate = new Date(rawDates[0])
    const endDate   = rawDates.length > 1 ? new Date(rawDates[1]) : new Date(rawDates[0])

    if (isNaN(endDate.getTime())) {
      return { startDate: null, endDate: null, daysRemaining: null, totalDays: null, status: 'unknown' }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const diffMs = endDate.getTime() - today.getTime()
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    const durationMs = endDate.getTime() - startDate.getTime()
    const totalDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24))

    let status = 'active'
    if (daysRemaining < 0) {
      status = 'expired'
    } else if (daysRemaining <= 30) {
      status = 'critical'
    } else if (daysRemaining <= 90) {
      status = 'expiring_soon'
    }

    return { startDate, endDate, daysRemaining, totalDays, status, dates: rawDates }
  } catch (err) {
    return { startDate: null, endDate: null, daysRemaining: null, totalDays: null, status: 'unknown' }
  }
}

export function formatValidityRange(validityStr) {
  if (!validityStr) return '—'
  try {
    const { dates } = parseValidity(validityStr)
    if (!dates || dates.length === 0) return String(validityStr)
    const formatted = dates.map(d => formatDate(d))
    return formatted.length > 1 ? `${formatted[0]} - ${formatted[1]}` : formatted[0]
  } catch (err) {
    return String(validityStr)
  }
}

// ──────────────────────────────────────────────
// Derive financial year for budget entries based on contract validity expiry year
// Expiry 2024 -> FY 23-24 (2023-24)
// Expiry 2025 -> FY 24-25 (2024-25)
// Expiry 2026 -> FY 25-26 (2025-26)
// Expiry 2027 -> FY 26-27 (2026-27)
// ──────────────────────────────────────────────
export function getBudgetRecordFy(r) {
  if (!r) return '2024-25'
  try {
    const { endDate, startDate } = parseValidity(r.validity_of_contract)
    const targetDate = endDate || startDate
    if (targetDate && !isNaN(targetDate.getTime())) {
      const expiryYear = targetDate.getFullYear()
      const startYear = expiryYear - 1
      const shortExpiry = String(expiryYear).slice(2)
      return `${startYear}-${shortExpiry}`
    }
  } catch (e) {
    // fallback
  }
  return r.financial_year || '2024-25'
}

// ──────────────────────────────────────────────
// Auto-Sync Full Amount Received Date & GST Amount Received Date
// For invoices issued on/after 01.04.2026 (FY 2026-27 onwards):
// If full amount date is given but GST date is blank -> GST date = full date
// Conversely if GST date is given but full amount date is blank -> full date = GST date
// ──────────────────────────────────────────────
export function applyGstDateAutoSync(record) {
  if (!record) return record
  const synced = { ...record }
  synced.payment_status = derivePaymentStatus(synced)
  return synced
}

// ──────────────────────────────────────────────
// Derive Payment Status automatically from date fields:
// 1. Full Payment Received Date only -> 'Net Amount Received'
// 2. GST Payment Received Date only -> 'GST Payment Only Received'
// 3. Both Full & GST Dates entered -> 'Full Payment Received'
// 4. Neither entered -> 'Pending' (or existing status)
// ──────────────────────────────────────────────
export function derivePaymentStatus(record) {
  if (!record) return 'Pending'
  const fullDate = (record.full_amount_received_date || record.amount_received_date) ? String(record.full_amount_received_date || record.amount_received_date).trim() : ''
  const gstDate  = record.gst_amount_received_date ? String(record.gst_amount_received_date).trim() : ''

  if (fullDate && gstDate) {
    return 'Full Payment Received'
  } else if (fullDate && !gstDate) {
    return 'Net Amount Received'
  } else if (!fullDate && gstDate) {
    return 'GST Payment Only Received'
  }
  return record.payment_status || 'Pending'
}


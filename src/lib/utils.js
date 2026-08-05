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
// Format date display
// ──────────────────────────────────────────────
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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

  // Match YYYY-MM-DD or DD-MM-YYYY dates
  const dates = String(validityStr).match(/\d{4}-\d{2}-\d{2}/g) || String(validityStr).match(/\d{2}[-/]\d{2}[-/]\d{4}/g)
  if (!dates || dates.length === 0) {
    return { startDate: null, endDate: null, daysRemaining: null, totalDays: null, status: 'unknown' }
  }

  const startDate = new Date(dates[0])
  const endDate   = dates.length > 1 ? new Date(dates[1]) : new Date(dates[0])

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

  return { startDate, endDate, daysRemaining, totalDays, status, dates }
}

// ──────────────────────────────────────────────
// Derive financial year for budget entries from validity end date
// ──────────────────────────────────────────────
export function getBudgetRecordFy(r) {
  if (!r) return '2024-25'
  const { endDate, startDate } = parseValidity(r.validity_of_contract)
  if (endDate && !isNaN(endDate.getTime())) {
    return getFinancialYear(endDate)
  }
  if (startDate && !isNaN(startDate.getTime())) {
    return getFinancialYear(startDate)
  }
  return r.financial_year || '2024-25'
}


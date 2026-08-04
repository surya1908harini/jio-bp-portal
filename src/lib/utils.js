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

export const JMS_STATUSES = ['Pending', 'A1', 'A2', 'QSD', 'A3', 'Invoiced']
export const PAYMENT_STATUSES = [
  'Pending',
  'GST Payment Only Received',
  'Net Amount Received',
  'Full Payment Received',
]

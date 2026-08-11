/**
 * Direct Supabase database operations — no backend required.
 * All CRUD for JMS, Invoice, Budget goes through Supabase client.
 * RLS policies handle security on the DB side.
 */
import { supabase } from './supabase'
import { FINANCIAL_YEARS, applyGstDateAutoSync } from './utils'

const NUMERIC_KEYS = new Set([
  'total', 'igst', 'cgst', 'sgst', 'grand_total', 'tds',
  'gst_amount_deduction', 'gst_tds_2pct_iocl', 'sd_retention',
  'tcs_credit_note', 'received_bill_amount', 'net_amount',
  'fo_total_budget', 'total_consumed', 'a3_released_amount',
  'pending_amount', 'invoiced_amount', 'balance_available'
])

// ── helper: clean budget record fields to remove view-computed fields before DB insert/update ──
const BUDGET_ALLOWED_KEYS = new Set([
  'operation',
  'description',
  'arc_number',
  'work_order_number',
  'validity_of_contract',
  'fo_total_budget',
  'payment_timeframe_days',
  'status',
  'pdf_url',
  'created_by',
  'financial_year'
])

function parseBudgetMetadata(r) {
  if (!r) return r
  let timeframe = r.payment_timeframe_days
  let status = r.status

  const desc = r.description || ''

  if (!timeframe) {
    const tfMatch = desc.match(/\[Timeframe:\s*(\d+)\s*days\]/i)
    if (tfMatch) timeframe = Number(tfMatch[1])
  }

  if (!status) {
    const stMatch = desc.match(/\[WO Status:\s*([^\]]+)\]/i)
    if (stMatch) status = stMatch[1].trim()
  }

  return {
    ...r,
    payment_timeframe_days: timeframe ? Number(timeframe) : 30,
    status: status || 'Active',
  }
}

function encodeBudgetMetadata(payload) {
  let desc = payload.description || ''
  const tf = payload.payment_timeframe_days || 30
  const st = payload.status || 'Active'

  desc = desc.replace(/\[Timeframe:\s*\d+\s*days\]/gi, '').replace(/\[WO Status:\s*[^\]]+\]/gi, '').trim()
  const metaTag = `[Timeframe: ${tf} days] [WO Status: ${st}]`
  const finalDesc = desc ? `${desc} ${metaTag}` : metaTag

  return {
    ...payload,
    description: finalDesc,
    payment_timeframe_days: Number(tf),
    status: st,
  }
}

function cleanBudgetRecord(obj) {
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    if (!BUDGET_ALLOWED_KEYS.has(k)) continue
    if (v === '' || v === null || v === undefined) continue

    if (NUMERIC_KEYS.has(k)) {
      if (typeof v === 'string') {
        const cleanedStr = v.replace(/,/g, '').trim()
        if (cleanedStr === '' || cleanedStr === '.' || cleanedStr === '-' || isNaN(Number(cleanedStr))) continue
        result[k] = Number(cleanedStr)
      } else if (typeof v === 'number') {
        if (isNaN(v)) continue
        result[k] = v
      }
      continue
    }

    if (v instanceof Date) {
      result[k] = v.toISOString().split('T')[0]
    } else if (typeof v === 'string') {
      const trimmed = v.trim()
      if (trimmed === '.' || trimmed === '') continue
      result[k] = trimmed
    } else {
      result[k] = v
    }
  }
  return result
}

// ── helper: format dates & strip empty/null values before insert/update ──
function clean(obj) {
  const synced = { ...obj }
  if (synced.amount_received_date && !synced.full_amount_received_date) {
    synced.full_amount_received_date = synced.amount_received_date
  }
  delete synced.amount_received_date
  delete synced.expected_payment_date
  delete synced.payment_timeframe_days
  delete synced.inv_posting_date
  delete synced.status_display

  const result = {}
  for (const [k, v] of Object.entries(synced)) {
    if (k === 'fy') continue // ignore invalid 'fy' property not present in schema
    if (v === '' || v === null || v === undefined) continue

    if (NUMERIC_KEYS.has(k)) {
      if (typeof v === 'string') {
        const cleanedStr = v.replace(/,/g, '').trim()
        if (cleanedStr === '' || cleanedStr === '.' || cleanedStr === '-' || isNaN(Number(cleanedStr))) continue
        result[k] = Number(cleanedStr)
      } else if (typeof v === 'number') {
        if (isNaN(v)) continue
        result[k] = v
      }
      continue
    }

    if (v instanceof Date) {
      result[k] = v.toISOString().split('T')[0]
    } else if (typeof v === 'string') {
      const trimmed = v.trim()
      if (trimmed === '.' || trimmed === '') continue
      result[k] = trimmed
    } else {
      result[k] = v
    }
  }
  return result
}

function cleanJms(obj) {
  const synced = { ...obj }
  const statusStr = String(synced.status || '').toLowerCase()
  if (statusStr.includes('cancel')) {
    if (!String(synced.work_description || '').includes('[Cancelled:')) {
      synced.work_description = `[Cancelled: ${synced.status || 'Cancelled / Deleted'}] ${synced.work_description || ''}`.trim()
    }
    synced.status = 'Pending' // Satisfies PostgreSQL jms_records_status_check constraint!
  } else {
    // Map UI statuses to DB status codes
    const map = {
      'Pending A1': 'A1', 'A1': 'A1',
      'Pending A2': 'A2', 'A2': 'A2',
      'Pending QSD': 'QSD', 'QSD': 'QSD',
      'Pending A3': 'A3', 'A3': 'A3',
      'Released by A3': 'Invoiced', 'Invoiced': 'Invoiced',
    }
    synced.status = map[synced.status] || synced.status || 'Pending'
  }

  const VALID_JMS_STATUSES = new Set(['A1', 'A2', 'QSD', 'A3', 'Invoiced', 'Pending'])
  if (!VALID_JMS_STATUSES.has(synced.status)) {
    synced.status = 'Pending'
  }

  const cleaned = clean(synced)
  delete cleaned.payment_status // Explicitly strip payment_status for jms_records so schema cache error is IMPOSSIBLE!
  delete cleaned.payment_date
  return cleaned
}

function cleanInvoice(obj) {
  const synced = applyGstDateAutoSync({ ...obj })
  const statusStr = String(synced.payment_status || synced.status || '').toLowerCase()
  if (statusStr.includes('cancel')) {
    if (!String(synced.work_description || '').includes('[Cancelled:')) {
      synced.work_description = `[Cancelled: ${synced.payment_status || 'Invoice Cancelled by some issues'}] ${synced.work_description || ''}`.trim()
    }
    synced.payment_status = 'Pending' // Satisfies PostgreSQL check constraint!
  }
  const VALID_PAYMENT_STATUSES = new Set(['Pending', 'GST Payment Only Received', 'Net Amount Received', 'Full Payment Received'])
  if (!VALID_PAYMENT_STATUSES.has(synced.payment_status)) {
    synced.payment_status = 'Pending'
  }
  const cleaned = clean(synced)
  delete cleaned.arc_number // Explicitly strip arc_number so schema cache error for invoice_records is IMPOSSIBLE!
  delete cleaned.status
  return cleaned
}

// ── helper: fetch all pages because Supabase (PostgREST) caps results at 1000 rows per request ──
async function fetchPagedData(baseQueryFn) {
  let allRows = []
  let from = 0
  const step = 1000
  let hasMore = true
  while (hasMore) {
    const query = baseQueryFn().range(from, from + step - 1)
    const { data, error } = await query
    if (error) throw error
    if (data && data.length > 0) {
      allRows = allRows.concat(data)
      if (data.length < step) {
        hasMore = false
      } else {
        from += step
      }
    } else {
      hasMore = false
    }
  }
  return allRows
}

// ═══════════════════════════════════════════════════════════
// JMS RECORDS
// ═══════════════════════════════════════════════════════════
export const jmsDb = {
  list: async (fy) => {
    return fetchPagedData(() =>
      supabase
        .from('jms_records')
        .select('*')
        .eq('financial_year', fy)
        .order('created_at', { ascending: false })
    )
  },

  listAll: async () => {
    return fetchPagedData(() =>
      supabase
        .from('jms_records')
        .select('*')
        .order('created_at', { ascending: false })
    )
  },

  create: async (payload, userId) => {
    const { data, error } = await supabase
      .from('jms_records')
      .insert(cleanJms({ ...payload, created_by: userId }))
      .select()
      .single()
    if (error) throw error
    return data
  },

  update: async (id, payload) => {
    const { data, error } = await supabase
      .from('jms_records')
      .update(cleanJms(payload))
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  delete: async (id) => {
    const { error } = await supabase.from('jms_records').delete().eq('id', id)
    if (error) throw error
  },

  bulkInsert: async (rows, userId) => {
    const cleaned = rows.map(r => cleanJms({ ...r, created_by: userId }))
    const { error } = await supabase.from('jms_records').insert(cleaned)
    if (error) throw error
    return cleaned.length
  },
}

// ═══════════════════════════════════════════════════════════
// INVOICE RECORDS
// ═══════════════════════════════════════════════════════════
export const invoiceDb = {
  list: async (fy) => {
    return fetchPagedData(() =>
      supabase
        .from('invoice_records')
        .select('*')
        .eq('financial_year', fy)
        .order('created_at', { ascending: false })
    )
  },

  listAll: async () => {
    return fetchPagedData(() =>
      supabase
        .from('invoice_records')
        .select('*')
        .order('created_at', { ascending: false })
    )
  },

  create: async (payload, userId) => {
    const cleaned = cleanInvoice({ ...payload, created_by: userId })
    let { data, error } = await supabase
      .from('invoice_records')
      .insert(cleaned)
      .select()
      .single()
    if (error && error.message?.includes('schema cache')) {
      delete cleaned.arc_number
      delete cleaned.status
      const retry = await supabase
        .from('invoice_records')
        .insert(cleaned)
        .select()
        .single()
      data = retry.data
      error = retry.error
    }
    if (error) throw error
    return data
  },

  update: async (id, payload) => {
    const cleaned = cleanInvoice(payload)
    let { data, error } = await supabase
      .from('invoice_records')
      .update(cleaned)
      .eq('id', id)
      .select()
      .single()
    if (error && error.message?.includes('schema cache')) {
      delete cleaned.arc_number
      delete cleaned.status
      const retry = await supabase
        .from('invoice_records')
        .update(cleaned)
        .eq('id', id)
        .select()
        .single()
      data = retry.data
      error = retry.error
    }
    if (error) throw error
    return data
  },

  delete: async (id) => {
    const { error } = await supabase.from('invoice_records').delete().eq('id', id)
    if (error) throw error
  },

  bulkInsert: async (rows, userId) => {
    const cleaned = rows.map(r => cleanInvoice({ ...r, created_by: userId }))
    const { error } = await supabase.from('invoice_records').insert(cleaned)
    if (error) throw error
    return cleaned.length
  },
}

// ═══════════════════════════════════════════════════════════
// BUDGET RECORDS  (reads from budget_summary view)
// ═══════════════════════════════════════════════════════════

async function fetchAndPatchBudgetRecords(baseQueryFn) {
  const [budgetRecords, jmsRecords] = await Promise.all([
    fetchPagedData(baseQueryFn),
    jmsDb.listAll()
  ])
  
  const cancelledMap = {}
  jmsRecords.forEach(j => {
    const desc = String(j.work_description || '')
    const isCancelled = desc.includes('[Cancelled:') || String(j.status || '').toLowerCase().includes('cancel')
    if (isCancelled && j.work_order_number) {
      const woKey = String(j.work_order_number).trim().toLowerCase()
      cancelledMap[woKey] = (cancelledMap[woKey] || 0) + (j.net_amount || 0)
    }
  })

  return budgetRecords.map(b => {
    const woKey = String(b.work_order_number || '').trim().toLowerCase()
    const deduction = cancelledMap[woKey] || 0
    const total_consumed = Math.max(0, (b.total_consumed || 0) - deduction)
    const balance_available = (b.fo_total_budget || 0) - total_consumed
    return { ...b, total_consumed, balance_available }
  })
}

export const budgetDb = {
  list: async (fy) => {
    const records = await fetchAndPatchBudgetRecords(() =>
      supabase
        .from('budget_summary')
        .select('*')
        .eq('financial_year', fy)
        .order('created_at', { ascending: false })
    )
    return records.map(parseBudgetMetadata)
  },

  listAll: async () => {
    const records = await fetchAndPatchBudgetRecords(() =>
      supabase
        .from('budget_summary')
        .select('*')
        .order('financial_year')
    )
    return records.map(parseBudgetMetadata)
  },

  create: async (payload, userId) => {
    const encoded = encodeBudgetMetadata({ ...payload, created_by: userId })
    const cleaned = cleanBudgetRecord(encoded)
    let { data, error } = await supabase
      .from('budget_records')
      .insert(cleaned)
      .select()
      .single()
    
    if (error && (error.message?.includes('payment_timeframe_days') || error.message?.includes('schema cache'))) {
      delete cleaned.payment_timeframe_days
      delete cleaned.status
      const retry = await supabase
        .from('budget_records')
        .insert(cleaned)
        .select()
        .single()
      data = retry.data
      error = retry.error
    }
    if (error) throw error
    return parseBudgetMetadata(data)
  },

  update: async (id, payload) => {
    const encoded = encodeBudgetMetadata(payload)
    const cleaned = cleanBudgetRecord(encoded)
    let { data, error } = await supabase
      .from('budget_records')
      .update(cleaned)
      .eq('id', id)
      .select()
      .single()

    if (error && (error.message?.includes('payment_timeframe_days') || error.message?.includes('schema cache'))) {
      delete cleaned.payment_timeframe_days
      delete cleaned.status
      const retry = await supabase
        .from('budget_records')
        .update(cleaned)
        .eq('id', id)
        .select()
        .single()
      data = retry.data
      error = retry.error
    }
    if (error) throw error
    return parseBudgetMetadata(data)
  },

  delete: async (id) => {
    const { error } = await supabase.from('budget_records').delete().eq('id', id)
    if (error) throw error
  },

  bulkInsert: async (rows, userId) => {
    const cleaned = rows.map(r => cleanBudgetRecord({ ...r, created_by: userId }))
    const { error } = await supabase.from('budget_records').insert(cleaned)
    if (error) throw error
    return cleaned.length
  },
}

// ═══════════════════════════════════════════════════════════
// PURCHASE BILL RECORDS
// ═══════════════════════════════════════════════════════════
const LOCAL_PURCHASE_BILLS_KEY = 'portal_purchase_bills_v1'

function getLocalPurchaseBills() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_PURCHASE_BILLS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveLocalPurchaseBills(list) {
  try {
    localStorage.setItem(LOCAL_PURCHASE_BILLS_KEY, JSON.stringify(list))
  } catch {}
}

export const purchaseBillDb = {
  listAll: async () => {
    try {
      const data = await fetchPagedData(() =>
        supabase
          .from('purchase_bills')
          .select('*')
          .order('created_at', { ascending: false })
      )
      if (Array.isArray(data)) {
        if (data.length > 0) saveLocalPurchaseBills(data)
        return data
      }
    } catch (e) {
      console.warn('Supabase purchase_bills select fallback to local storage:', e)
    }
    return getLocalPurchaseBills()
  },

  create: async (payload, userId) => {
    const cleaned = {
      trade_name: payload.trade_name || '',
      supplier_gstin: payload.supplier_gstin || '',
      inv_number: payload.inv_number || '',
      inv_date: payload.inv_date || '',
      taxable_value: Number(payload.taxable_value || 0),
      cgst: Number(payload.cgst || 0),
      sgst: Number(payload.sgst || 0),
      invoice_value: Number(payload.invoice_value || 0),
      hb_rb: payload.hb_rb || '',
      remarks: payload.remarks || 'BILL RECEIVED',
      financial_year: payload.financial_year || getFinancialYear(payload.inv_date || new Date()),
      created_by: userId
    }

    try {
      const { data, error } = await supabase
        .from('purchase_bills')
        .insert(cleaned)
        .select()
        .single()
      if (!error && data) {
        const local = getLocalPurchaseBills()
        saveLocalPurchaseBills([data, ...local])
        return data
      }
    } catch (e) {
      console.warn('Supabase purchase_bills insert fallback:', e)
    }

    const localRecord = { id: `pb-${Date.now()}`, ...cleaned, created_at: new Date().toISOString() }
    const local = getLocalPurchaseBills()
    const updated = [localRecord, ...local]
    saveLocalPurchaseBills(updated)
    return localRecord
  },

  update: async (id, payload) => {
    const cleaned = {
      trade_name: payload.trade_name || '',
      supplier_gstin: payload.supplier_gstin || '',
      inv_number: payload.inv_number || '',
      inv_date: payload.inv_date || '',
      taxable_value: Number(payload.taxable_value || 0),
      cgst: Number(payload.cgst || 0),
      sgst: Number(payload.sgst || 0),
      invoice_value: Number(payload.invoice_value || 0),
      hb_rb: payload.hb_rb || '',
      remarks: payload.remarks || 'BILL RECEIVED',
      financial_year: payload.financial_year || getFinancialYear(payload.inv_date || new Date())
    }

    try {
      const { data, error } = await supabase
        .from('purchase_bills')
        .update(cleaned)
        .eq('id', id)
        .select()
        .single()
      if (!error && data) {
        const local = getLocalPurchaseBills().map(r => r.id === id ? data : r)
        saveLocalPurchaseBills(local)
        return data
      }
    } catch (e) {
      console.warn('Supabase purchase_bills update fallback:', e)
    }

    const local = getLocalPurchaseBills().map(r => r.id === id ? { ...r, ...cleaned } : r)
    saveLocalPurchaseBills(local)
    return { id, ...cleaned }
  },

  delete: async (id) => {
    try {
      await supabase.from('purchase_bills').delete().eq('id', id)
    } catch (e) {}
    const local = getLocalPurchaseBills().filter(r => String(r.id) !== String(id))
    saveLocalPurchaseBills(local)
  },

  bulkInsert: async (rows, userId) => {
    let count = 0
    for (const r of rows) {
      await purchaseBillDb.create(r, userId)
      count++
    }
    return count
  }
}

// ============================================================
// HOME PAGE SETTINGS DB
// ============================================================
export const homeDb = {
  getSettings: async () => {
    const { data, error } = await supabase
      .from('home_settings')
      .select('*')
      .limit(1)
      .single()
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching home settings:', error)
    }
    return data || {
      pending_title: 'PENDING WORKS IN TYPE MANUAL',
      pending_desc: 'Review and update pending manual assignments effortlessly through the integrated task flow.',
      notification_title: 'NOTIFICATION FOR OFFICE WORK',
      notification_desc: 'EX (WIFI DUE DATE 29/MM/YYYY)',
      pending_works_list: [],
      notifications_list: [],
      links: []
    }
  },

  updateSettings: async (payload) => {
    // We assume there's always one row with ID '00000000-0000-0000-0000-000000000001'
    const id = '00000000-0000-0000-0000-000000000001'
    const { data, error } = await supabase
      .from('home_settings')
      .upsert({ id, ...payload, updated_at: new Date() })
      .select()
      .single()
    if (error) throw error
    return data
  }
}


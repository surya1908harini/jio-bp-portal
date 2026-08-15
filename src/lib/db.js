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
  'pending_amount', 'invoiced_amount', 'balance_available', 'received_gst_amount'
])

// PDF Fallback Helper
const PDF_FALLBACK_KEY = 'portal_pdf_fallback_map'
function getPdfFallbackMap() {
  try { return JSON.parse(localStorage.getItem(PDF_FALLBACK_KEY)) || {} } catch (e) { return {} }
}
function setPdfFallback(id, url) {
  const map = getPdfFallbackMap()
  if (url === null) delete map[id]
  else map[id] = url
  localStorage.setItem(PDF_FALLBACK_KEY, JSON.stringify(map))
}
function applyPdfFallback(rows) {
  const map = getPdfFallbackMap()
  return rows.map(r => {
    // If the column exists in Supabase, it will be either a string or null.
    // If it is completely missing, it will be undefined.
    // We only fallback if it's undefined (missing column) to avoid zombie PDFs
    // reappearing after a successful delete (which sets it to null).
    const finalUrl = r.pdf_url !== undefined ? r.pdf_url : map[r.id]
    return { ...r, pdf_url: finalUrl }
  })
}

// ── helper: clean budget record fields to remove view-computed fields before DB insert/update ──
const BUDGET_ALLOWED_KEYS = new Set([
  'operation',
  'description',
  'arc_number',
  'work_order_number',
  'validity_of_contract',
  'fo_total_budget',
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
    if (v === '' || (v === null && k !== 'pdf_url') || v === undefined) continue

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
    if (v === '' || (v === null && k !== 'pdf_url') || v === undefined) continue

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
    const data = await fetchPagedData(() =>
      supabase
        .from('jms_records')
        .select('*')
        .order('created_at', { ascending: false })
    )
    return applyPdfFallback(data)
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
    let cleaned = cleanJms(payload)
    let { data, error } = await supabase
      .from('jms_records')
      .update(cleaned)
      .eq('id', id)
      .select()
      .single()

    if (error && (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.message?.includes('pdf_url'))) {
      if ('pdf_url' in cleaned) {
        setPdfFallback(id, cleaned.pdf_url)
        delete cleaned.pdf_url
        if (Object.keys(cleaned).length > 0) {
          const retry = await supabase.from('jms_records').update(cleaned).eq('id', id).select().single()
          data = retry.data
          error = retry.error
        } else {
          error = null
          data = payload
        }
      }
    }

    if (error) throw error
    return data
  },

  delete: async (id) => {
    const { error } = await supabase.from('jms_records').delete().eq('id', id)
    if (error) throw error
  },

  bulkInsert: async (rows, userId) => {
    const existing = await jmsDb.listAll()
    const existingMap = new Map(existing.map(r => [r.jms_no, r.id]))

    const toUpdate = []
    const toInsert = []

    rows.forEach(r => {
      const c = cleanJms({ ...r, created_by: userId })
      if (c.jms_no && existingMap.has(c.jms_no)) {
        c.id = existingMap.get(c.jms_no)
        toUpdate.push(c)
      } else {
        delete c.id
        toInsert.push(c)
      }
    })

    if (toUpdate.length > 0) {
      const { error } = await supabase.from('jms_records').upsert(toUpdate)
      if (error) throw error
    }
    if (toInsert.length > 0) {
      const { error } = await supabase.from('jms_records').insert(toInsert)
      if (error) throw error
    }
    return toUpdate.length + toInsert.length
  },
}

// ═══════════════════════════════════════════════════════════
// INVOICE RECORDS
// ═══════════════════════════════════════════════════════════
export const invoiceDb = {
  list: async (fy) => {
    const data = await fetchPagedData(() =>
      supabase
        .from('invoice_records')
        .select('*')
        .eq('financial_year', fy)
        .order('created_at', { ascending: false })
    )
    return applyPdfFallback(data)
  },

  listAll: async () => {
    const data = await fetchPagedData(() =>
      supabase
        .from('invoice_records')
        .select('*')
        .order('created_at', { ascending: false })
    )
    return applyPdfFallback(data)
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
    
    if (error && (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.message?.includes('pdf_url'))) {
      if ('pdf_url' in cleaned) {
        setPdfFallback(id, cleaned.pdf_url)
        delete cleaned.pdf_url
      }
      delete cleaned.arc_number
      delete cleaned.status
      delete cleaned.received_gst_amount
      delete cleaned.retention_received_date
      
      if (Object.keys(cleaned).length > 0) {
        const retry = await supabase
          .from('invoice_records')
          .update(cleaned)
          .eq('id', id)
          .select()
          .single()
        data = retry.data
        error = retry.error
      } else {
        error = null
        data = payload
      }
    }
    if (error) throw error
    return data
  },

  delete: async (id) => {
    const { error } = await supabase.from('invoice_records').delete().eq('id', id)
    if (error) throw error
  },

  bulkInsert: async (rows, userId) => {
    const existing = await invoiceDb.listAll()
    const existingMap = new Map(existing.map(r => [r.inv_number, r.id]))

    const toUpdate = []
    const toInsert = []

    rows.forEach(r => {
      const c = cleanInvoice({ ...r, created_by: userId })
      if (c.inv_number && existingMap.has(c.inv_number)) {
        c.id = existingMap.get(c.inv_number)
        toUpdate.push(c)
      } else {
        delete c.id
        toInsert.push(c)
      }
    })

    if (toUpdate.length > 0) {
      const { error } = await supabase.from('invoice_records').upsert(toUpdate)
      if (error) throw error
    }
    if (toInsert.length > 0) {
      const { error } = await supabase.from('invoice_records').insert(toInsert)
      if (error) throw error
    }
    return toUpdate.length + toInsert.length
  },
}

// ═══════════════════════════════════════════════════════════
// BUDGET RECORDS  (reads from budget_summary view)
// ═══════════════════════════════════════════════════════════

async function fetchAndPatchBudgetRecords(baseQueryFn) {
  const rawRecordsPromise = supabase.from('budget_records').select('id, pdf_url').then(res => res.data).catch(() => null)

  const [budgetRecords, jmsRecords, rawRecords] = await Promise.all([
    fetchPagedData(baseQueryFn),
    jmsDb.listAll(),
    rawRecordsPromise
  ])
  
  const rawPdfMap = {}
  if (rawRecords) {
    rawRecords.forEach(r => { rawPdfMap[r.id] = r.pdf_url })
  }

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
    
    // Patch pdf_url from raw table since budget_summary view might be outdated
    const pdf_url = rawPdfMap[b.id] !== undefined ? rawPdfMap[b.id] : b.pdf_url

    return { ...b, total_consumed, balance_available, pdf_url }
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
    return applyPdfFallback(records).map(parseBudgetMetadata)
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
    if (error) {
      if (error.code === '23505' || error.message?.includes('budget_records_work_order_number_key')) {
        throw new Error(`Work Order '${cleaned.work_order_number}' already exists!`)
      }
      throw error
    }
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

    if (error && (error.message?.includes('payment_timeframe_days') || error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.message?.includes('pdf_url'))) {
      if ('pdf_url' in cleaned && error.message?.includes('pdf_url')) {
        setPdfFallback(id, cleaned.pdf_url)
        delete cleaned.pdf_url
      }
      if (error.message?.includes('payment_timeframe_days') || error.message?.includes('schema cache')) {
        delete cleaned.payment_timeframe_days
      }
      delete cleaned.status
      
      if (Object.keys(cleaned).length > 0) {
        const retry = await supabase
          .from('budget_records')
          .update(cleaned)
          .eq('id', id)
          .select()
          .single()
        data = retry.data
        error = retry.error
      } else {
        error = null
        data = payload
      }
    }
    if (error) throw error
    return parseBudgetMetadata(data)
  },

  delete: async (id) => {
    const { error } = await supabase.from('budget_records').delete().eq('id', id)
    if (error) throw error
  },

  syncMissingFromJms: async (userId) => {
    const [budgetList, jmsList] = await Promise.all([
      budgetDb.listAll(),
      jmsDb.listAll()
    ])
    
    const existingWorkOrders = new Set(
      budgetList.map(b => String(b.work_order_number || '').trim().toLowerCase())
    )
    
    const missingJms = jmsList.filter(j => {
      const wo = String(j.work_order_number || '').trim().toLowerCase()
      return wo && !existingWorkOrders.has(wo)
    })
    
    let count = 0
    for (const j of missingJms) {
      const payload = {
        operation: 'Auto-Sync',
        work_order_number: j.work_order_number,
        description: j.work_description || 'Synced from JMS',
        fo_total_budget: j.net_amount || 0,
        financial_year: j.financial_year,
      }
      try {
        await budgetDb.create(payload, userId)
        count++
      } catch (e) {
        console.error('Failed to sync JMS record:', j.work_order_number, e)
      }
    }
    return count
  },

  bulkInsert: async (rows, userId) => {
    const existing = await budgetDb.listAll()
    const getBudgetKey = (r) => String(r.work_order_number || '').toLowerCase().trim()
    const existingMap = new Map(existing.map(r => [getBudgetKey(r), r.id]))

    const toUpdate = []
    const toInsert = []

    rows.forEach(r => {
      // Ensure financial_year is never empty/undefined to prevent PostgREST mixed-column null constraint errors
      r.financial_year = r.financial_year || '2024-25'
      const encoded = encodeBudgetMetadata({ ...r, created_by: userId })
      const c = cleanBudgetRecord(encoded)
      
      delete c.payment_timeframe_days
      delete c.status

      const bKey = getBudgetKey(c)
      if (c.work_order_number && existingMap.has(bKey)) {
        c.id = existingMap.get(bKey)
        toUpdate.push(c)
      } else {
        delete c.id
        toInsert.push(c)
      }
    })

    if (toUpdate.length > 0) {
      const { error } = await supabase.from('budget_records').upsert(toUpdate)
      if (error) throw error
    }
    if (toInsert.length > 0) {
      const { error } = await supabase.from('budget_records').insert(toInsert)
      if (error) throw error
    }
    return toUpdate.length + toInsert.length
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
      igst: Number(payload.igst || 0),
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
      if (error) {
        if (error.message && error.message.includes('igst')) {
          console.warn('IGST column missing in Supabase. Attempting fallback insert without IGST...')
          const fallbackCleaned = { ...cleaned }
          delete fallbackCleaned.igst
          const { data: fbData, error: fbError } = await supabase.from('purchase_bills').insert(fallbackCleaned).select().single()
          if (!fbError && fbData) {
            const local = getLocalPurchaseBills()
            saveLocalPurchaseBills([fbData, ...local])
            return fbData
          }
        }
        throw error
      }
      if (data) {
        const local = getLocalPurchaseBills()
        saveLocalPurchaseBills([data, ...local])
        return data
      }
    } catch (e) {
      console.warn('Supabase purchase_bills insert fallback:', e)
      if (e.message && e.message.includes('igst')) {
        alert("CRITICAL: The 'igst' column is missing in your Supabase 'purchase_bills' table! Please add it as a numeric column.")
      }
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
      igst: Number(payload.igst || 0),
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
      if (error) {
        if (error.message && error.message.includes('igst')) {
          console.warn('IGST column missing in Supabase. Attempting fallback update without IGST...')
          const fallbackCleaned = { ...cleaned }
          delete fallbackCleaned.igst
          const { data: fbData, error: fbError } = await supabase.from('purchase_bills').update(fallbackCleaned).eq('id', id).select().single()
          if (!fbError && fbData) {
            const local = getLocalPurchaseBills().map(r => r.id === id ? fbData : r)
            saveLocalPurchaseBills(local)
            return fbData
          }
        }
        throw error
      }
      if (data) {
        const local = getLocalPurchaseBills().map(r => r.id === id ? data : r)
        saveLocalPurchaseBills(local)
        return data
      }
    } catch (e) {
      console.warn('Supabase purchase_bills update fallback:', e)
      if (e.message && e.message.includes('igst')) {
        alert("CRITICAL: The 'igst' column is missing in your Supabase 'purchase_bills' table! Please add it as a numeric column.")
      }
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
    const existing = await purchaseBillDb.listAll()
    const getPBKey = (r) => `${r.inv_number}_${r.trade_name}`.toLowerCase().trim()
    const existingMap = new Map(existing.map(r => [getPBKey(r), r.id]))

    let count = 0
    for (const r of rows) {
      const pbKey = getPBKey(r)
      if (r.inv_number && existingMap.has(pbKey)) {
        await purchaseBillDb.update(existingMap.get(pbKey), { ...r, created_by: userId })
      } else {
        await purchaseBillDb.create(r, userId)
      }
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
    let dbData = null
    try {
      const { data, error } = await supabase
        .from('home_settings')
        .select('*')
        .limit(1)
        .single()
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching home settings:', error)
      }
      dbData = data
    } catch (e) {
      console.warn('Supabase fetch failed for home_settings, using fallback')
    }

    // Try to load fallback from local storage
    let localDates = null
    let localLinks = null
    try {
      localDates = JSON.parse(localStorage.getItem('portal_fallback_due_dates'))
      localLinks = JSON.parse(localStorage.getItem('portal_fallback_links'))
    } catch (e) {}

    return {
      ...(dbData || {}),
      due_dates: dbData?.due_dates || localDates || [
        { id: 1, title: 'WiFi Bill', date: '29th', color: 'red' },
        { id: 2, title: 'GSTR-1 Filing', date: '11th', color: 'orange' },
        { id: 3, title: 'GSTR-3B Filing', date: '20th', color: 'blue' },
        { id: 4, title: 'PF Challan', date: '15th', color: 'green' }
      ],
      links: dbData?.links || localLinks || [],
      login_video_url: dbData?.login_video_url || 'https://cdn.pixabay.com/video/2021/08/18/85429-590001095_large.mp4'
    }
  },

  updateSettings: async (payload) => {
    const id = '00000000-0000-0000-0000-000000000001'
    let { data, error } = await supabase
      .from('home_settings')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    // Fallback if schema doesn't match
    if (error && (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.message?.includes('due_dates') || error.message?.includes('links'))) {
      const fallbackPayload = { ...payload }
      
      if (fallbackPayload.due_dates) {
        localStorage.setItem('portal_fallback_due_dates', JSON.stringify(fallbackPayload.due_dates))
        delete fallbackPayload.due_dates
      }
      if (fallbackPayload.links) {
        localStorage.setItem('portal_fallback_links', JSON.stringify(fallbackPayload.links))
        delete fallbackPayload.links
      }

      if (Object.keys(fallbackPayload).length > 0) {
        const retry = await supabase
          .from('home_settings')
          .update(fallbackPayload)
          .eq('id', id)
          .select()
          .single()
        data = retry.data
        error = retry.error
      } else {
        error = null
        data = payload
      }
    }

    if (error && error.code !== 'PGRST116') throw error
    return data || payload
  }
}

// ── PF Clearance DB (Local Storage Fallback for now) ──
const LOCAL_PF_CLEARANCE_KEY = 'portal_pf_clearance_v1'

function getLocalPfClearance() {
  try {
    const data = localStorage.getItem(LOCAL_PF_CLEARANCE_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    return []
  }
}

export const pfDb = {
  listAll: async () => {
    // In future, you can try fetching from Supabase 'pf_records' here
    return getLocalPfClearance()
  },

  insert: async (payload, userId) => {
    const localRecord = { 
      id: `pf-${Date.now()}`, 
      ...payload, 
      created_by: userId, 
      created_at: new Date().toISOString() 
    }
    const local = getLocalPfClearance()
    localStorage.setItem(LOCAL_PF_CLEARANCE_KEY, JSON.stringify([localRecord, ...local]))
    return localRecord
  },

  update: async (id, payload) => {
    const local = getLocalPfClearance()
    const updated = local.map(r => String(r.id) === String(id) ? { ...r, ...payload } : r)
    localStorage.setItem(LOCAL_PF_CLEARANCE_KEY, JSON.stringify(updated))
    return payload
  },

  delete: async (id) => {
    const local = getLocalPfClearance()
    const updated = local.filter(r => String(r.id) !== String(id))
    localStorage.setItem(LOCAL_PF_CLEARANCE_KEY, JSON.stringify(updated))
    return true
  }
}

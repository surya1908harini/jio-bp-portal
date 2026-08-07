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
  const synced = applyGstDateAutoSync({ ...obj })
  if (synced.amount_received_date && !synced.full_amount_received_date) {
    synced.full_amount_received_date = synced.amount_received_date
  }
  delete synced.amount_received_date // Remove old column key so PostgREST schema cache error is prevented!
  delete synced.expected_payment_date // Remove computed key so PostgREST schema cache error is prevented!
  delete synced.payment_timeframe_days // Remove computed key so PostgREST schema cache error is prevented!

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
      .insert(clean({ ...payload, created_by: userId }))
      .select()
      .single()
    if (error) throw error
    return data
  },

  update: async (id, payload) => {
    const { data, error } = await supabase
      .from('jms_records')
      .update(clean(payload))
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
    const cleaned = rows.map(r => clean({ ...r, created_by: userId }))
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
    const { data, error } = await supabase
      .from('invoice_records')
      .insert(clean({ ...payload, created_by: userId }))
      .select()
      .single()
    if (error) throw error
    return data
  },

  update: async (id, payload) => {
    const { data, error } = await supabase
      .from('invoice_records')
      .update(clean(payload))
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  delete: async (id) => {
    const { error } = await supabase.from('invoice_records').delete().eq('id', id)
    if (error) throw error
  },

  bulkInsert: async (rows, userId) => {
    const cleaned = rows.map(r => clean({ ...r, created_by: userId }))
    const { error } = await supabase.from('invoice_records').insert(cleaned)
    if (error) throw error
    return cleaned.length
  },
}

// ═══════════════════════════════════════════════════════════
// BUDGET RECORDS  (reads from budget_summary view)
// ═══════════════════════════════════════════════════════════
export const budgetDb = {
  list: async (fy) => {
    const records = await fetchPagedData(() =>
      supabase
        .from('budget_summary')
        .select('*')
        .eq('financial_year', fy)
        .order('created_at', { ascending: false })
    )
    return records.map(parseBudgetMetadata)
  },

  listAll: async () => {
    const records = await fetchPagedData(() =>
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

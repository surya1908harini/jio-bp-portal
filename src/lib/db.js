/**
 * Direct Supabase database operations — no backend required.
 * All CRUD for JMS, Invoice, Budget goes through Supabase client.
 * RLS policies handle security on the DB side.
 */
import { supabase } from './supabase'
import { FINANCIAL_YEARS } from './utils'

// ── helper: format dates & strip empty/null values before insert/update ──
function clean(obj) {
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === null || v === undefined) continue
    if (v instanceof Date) {
      result[k] = v.toISOString().split('T')[0]
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
    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allRows.push(...data)
      if (data.length < step) {
        hasMore = false
      } else {
        from += step
      }
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
        .order('financial_year')
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

  bulkDelete: async (ids) => {
    const { error } = await supabase
      .from('jms_records')
      .delete()
      .in('id', ids)
    if (error) throw error
    return ids.length
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
        .order('financial_year')
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
    return fetchPagedData(() =>
      supabase
        .from('budget_summary')
        .select('*')
        .eq('financial_year', fy)
        .order('created_at', { ascending: false })
    )
  },

  listAll: async () => {
    return fetchPagedData(() =>
      supabase
        .from('budget_summary')
        .select('*')
        .order('financial_year')
    )
  },

  create: async (payload, userId) => {
    const { data, error } = await supabase
      .from('budget_records')
      .insert(clean({ ...payload, created_by: userId }))
      .select()
      .single()
    if (error) throw error
    return data
  },

  update: async (id, payload) => {
    const { data, error } = await supabase
      .from('budget_records')
      .update(clean(payload))
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  delete: async (id) => {
    const { error } = await supabase.from('budget_records').delete().eq('id', id)
    if (error) throw error
  },

  bulkInsert: async (rows, userId) => {
    const cleaned = rows.map(r => clean({ ...r, created_by: userId }))
    const { error } = await supabase.from('budget_records').insert(cleaned)
    if (error) throw error
    return cleaned.length
  },
}

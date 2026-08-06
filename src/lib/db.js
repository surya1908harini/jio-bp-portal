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
    if (k === 'fy') continue // ignore invalid 'fy' property not present in schema
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
    const cleaned = cleanBudgetRecord({ ...payload, created_by: userId })
    const { data, error } = await supabase
      .from('budget_records')
      .insert(cleaned)
      .select()
      .single()
    if (error) throw error
    return data
  },

  update: async (id, payload) => {
    const cleaned = cleanBudgetRecord(payload)
    const { data, error } = await supabase
      .from('budget_records')
      .update(cleaned)
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

  bulkInsert: async (rows, userId, activeFy) => {
    const cleaned = rows.map(r => {
      const { fy, ...rest } = r
      const fyVal = r.financial_year || (activeFy && activeFy !== 'overall' ? activeFy : undefined)
      return cleanBudgetRecord({ ...rest, ...(fyVal ? { financial_year: fyVal } : {}), created_by: userId })
    })
    const { error } = await supabase.from('budget_records').insert(cleaned)
    if (error) throw error
    return cleaned.length
  },

  syncMissingFromJms: async (userId) => {
    const { data: jmsRows, error: jmsErr } = await supabase.from('jms_records').select('work_order_number, financial_year, net_amount')
    const { data: budgetRows, error: bgErr } = await supabase.from('budget_records').select('work_order_number')

    if (jmsErr) throw jmsErr
    if (bgErr) throw bgErr

    const budgetWos = new Set(budgetRows?.map(b => String(b.work_order_number).trim()).filter(Boolean))
    const missingMap = new Map()

    jmsRows?.forEach(j => {
      const wo = String(j.work_order_number || '').trim()
      if (wo && !budgetWos.has(wo)) {
        if (!missingMap.has(wo)) {
          missingMap.set(wo, {
            work_order_number: wo,
            financial_year: j.financial_year || '2024-25',
            operation: 'JMS Work Order',
            description: 'Auto-synced from JMS records',
            fo_total_budget: Number(j.net_amount || 0),
            created_by: userId,
          })
        } else {
          missingMap.get(wo).fo_total_budget += Number(j.net_amount || 0)
        }
      }
    })

    const newEntries = Array.from(missingMap.values())
    if (newEntries.length === 0) return 0

    const { error } = await supabase.from('budget_records').insert(newEntries)
    if (error) throw error
    return newEntries.length
  },
}

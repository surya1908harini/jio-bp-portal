/**
 * Master Data Helper & Supabase Synchronization
 */
import { supabase } from './supabase'

const MASTERS_STORAGE_KEY = 'portal_master_records_v1'

export const DEFAULT_MASTERS = {
  officers_a1: [
    { id: 'off-a1-1', name: 'R. K. Sharma' },
    { id: 'off-a1-2', name: 'S. K. Verma' },
  ],
  officers_a2: [
    { id: 'off-a2-1', name: 'M. P. Singh' },
    { id: 'off-a2-2', name: 'V. K. Gupta' },
  ],
  officers_qsd: [
    { id: 'off-qsd-1', name: 'A. K. Roy' },
    { id: 'off-qsd-2', name: 'P. N. Das' },
  ],
  officers_a3: [
    { id: 'off-a3-1', name: 'G. S. Yadav' },
    { id: 'off-a3-2', name: 'T. R. Nair' },
  ],
  sites: [
    { id: 'site-1', name: 'CHENNAI', location: 'TAMIL NADU' },
    { id: 'site-2', name: 'PONDICHERRY', location: 'PONDICHERRY' },
    { id: 'site-3', name: 'SALEM', location: 'TAMIL NADU' },
    { id: 'site-4', name: 'VIRALIMALAI', location: 'TAMIL NADU' },
  ],
  work_orders: [
    { id: 'wo-1', work_order_number: '4100001234', arc_number: 'ARC-2024-01', description: 'Maintenance & Service Work Order' },
  ]
}

export function loadMasters() {
  try {
    const raw = localStorage.getItem(MASTERS_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error('Failed to load local masters:', e)
  }
  return DEFAULT_MASTERS
}

export function saveMasters(data) {
  try {
    localStorage.setItem(MASTERS_STORAGE_KEY, JSON.stringify(data))
    window.dispatchEvent(new Event('masters_updated'))
  } catch (e) {
    console.error('Failed to save masters:', e)
  }
}

export function seedMastersFromRecords(jmsList = [], invoiceList = [], budgetList = []) {
  const current = loadMasters()
  let changed = false

  const a1Set = new Set(current.officers_a1.map(o => o.name.trim().toLowerCase()))
  const a2Set = new Set(current.officers_a2.map(o => o.name.trim().toLowerCase()))
  const qsdSet = new Set(current.officers_qsd.map(o => o.name.trim().toLowerCase()))
  const a3Set = new Set(current.officers_a3.map(o => o.name.trim().toLowerCase()))
  const siteSet = new Set(current.sites.map(s => s.name.trim().toLowerCase()))
  const woSet = new Set(current.work_orders.map(w => w.work_order_number.trim().toLowerCase()))

  jmsList.forEach(j => {
    if (j.a1_name && j.a1_name.trim() && !a1Set.has(j.a1_name.trim().toLowerCase())) {
      current.officers_a1.push({ id: `auto-a1-${Date.now()}-${Math.random()}`, name: j.a1_name.trim() })
      a1Set.add(j.a1_name.trim().toLowerCase())
      changed = true
    }
    if (j.a2_name && j.a2_name.trim() && !a2Set.has(j.a2_name.trim().toLowerCase())) {
      current.officers_a2.push({ id: `auto-a2-${Date.now()}-${Math.random()}`, name: j.a2_name.trim() })
      a2Set.add(j.a2_name.trim().toLowerCase())
      changed = true
    }
    if (j.qsd_name && j.qsd_name.trim() && !qsdSet.has(j.qsd_name.trim().toLowerCase())) {
      current.officers_qsd.push({ id: `auto-qsd-${Date.now()}-${Math.random()}`, name: j.qsd_name.trim() })
      qsdSet.add(j.qsd_name.trim().toLowerCase())
      changed = true
    }
    if (j.a3_name && j.a3_name.trim() && !a3Set.has(j.a3_name.trim().toLowerCase())) {
      current.officers_a3.push({ id: `auto-a3-${Date.now()}-${Math.random()}`, name: j.a3_name.trim() })
      a3Set.add(j.a3_name.trim().toLowerCase())
      changed = true
    }
    if (j.site && j.site.trim() && !siteSet.has(j.site.trim().toLowerCase())) {
      current.sites.push({ id: `auto-site-${Date.now()}-${Math.random()}`, name: j.site.trim(), location: '' })
      siteSet.add(j.site.trim().toLowerCase())
      changed = true
    }
    if (j.work_order_number && j.work_order_number.trim() && !woSet.has(j.work_order_number.trim().toLowerCase())) {
      current.work_orders.push({
        id: `auto-wo-${Date.now()}-${Math.random()}`,
        work_order_number: j.work_order_number.trim(),
        arc_number: j.arc_number ? j.arc_number.trim() : '',
        description: j.work_description ? j.work_description.trim() : ''
      })
      woSet.add(j.work_order_number.trim().toLowerCase())
      changed = true
    }
  })

  budgetList.forEach(b => {
    if (b.work_order_number && b.work_order_number.trim() && !woSet.has(b.work_order_number.trim().toLowerCase())) {
      current.work_orders.push({
        id: `auto-bwo-${Date.now()}-${Math.random()}`,
        work_order_number: b.work_order_number.trim(),
        arc_number: b.arc_number ? b.arc_number.trim() : '',
        description: b.description ? b.description.trim() : ''
      })
      woSet.add(b.work_order_number.trim().toLowerCase())
      changed = true
    }
  })

  if (changed) {
    saveMasters(current)
  }
  return current
}

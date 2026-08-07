import { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { jmsDb, invoiceDb, budgetDb } from '../lib/db'
import { supabase } from '../lib/supabase'
import { formatINR, formatDate, parseValidity } from '../lib/utils'
import NotificationDetailModal from './NotificationDetailModal'
import {
  LayoutDashboard, FileText, Receipt, PieChart, Settings,
  ChevronRight, ChevronDown, LogOut, Menu, X, Shield, User, Search, Bell, AlertTriangle, Clock, DollarSign, ArrowRight, CheckCheck, Trash2, CheckCircle2
} from 'lucide-react'

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'JMS', icon: FileText, path: '/jms' },
  { label: 'Invoices', icon: Receipt, path: '/invoices' },
  { label: 'Budget', icon: PieChart, path: '/budget' },
  { label: 'SEARCH', icon: Search, path: '/search' },
  { label: 'Notifications', icon: Bell, path: '/notifications', badgeKey: 'notif' },
]

function NavItem({ item, collapsed, unreadCount }) {
  const location = useLocation()
  const isActive = location.pathname.startsWith(item.path)

  return (
    <Link
      to={item.path}
      className={`sidebar-link flex items-center justify-between ${isActive ? 'active' : ''}`}
      title={item.label}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <item.icon size={18} className="flex-shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </div>
      {!collapsed && item.badgeKey === 'notif' && unreadCount > 0 && (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 shadow-sm animate-pulse">
          {unreadCount}
        </span>
      )}
    </Link>
  )
}

export default function Layout() {
  const { user, role, isAdmin, signOut } = useAuth()
  const qc = useQueryClient()

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifTab, setNotifTab] = useState('unread') // 'unread' or 'read'
  const [selectedNotif, setSelectedNotif] = useState(null)

  // Per-User persistent read notifications key
  const storageKey = `mmc_read_notifs_${user?.id || 'guest'}`

  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]')
    } catch (e) {
      return []
    }
  })
  const notifRef = useRef(null)

  const navigate = useNavigate()
  const location = useLocation()

  // Realtime Supabase Auto-Sync Channel for instant notifications sync between User and Admin
  useEffect(() => {
    const channel = supabase
      .channel('realtime-portal-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jms_records' }, () => {
        qc.invalidateQueries(['jms'])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        qc.invalidateQueries(['invoices'])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_records' }, () => {
        qc.invalidateQueries(['budget'])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])

  // Persist read notifications per user account
  const markAsRead = (id) => {
    setReadNotifIds(prev => {
      if (prev.includes(id)) return prev
      const updated = [...prev, id]
      localStorage.setItem(storageKey, JSON.stringify(updated))
      return updated
    })
  }

  const markAllAsRead = (allIds) => {
    setReadNotifIds(prev => {
      const updated = Array.from(new Set([...prev, ...allIds]))
      localStorage.setItem(storageKey, JSON.stringify(updated))
      return updated
    })
  }

  const clearReadHistory = () => {
    setReadNotifIds([])
    localStorage.removeItem(storageKey)
  }

  // Fetch live DB data for notifications
  const { data: jmsList = [] }     = useQuery({ queryKey: ['jms', 'all'],     queryFn: () => jmsDb.listAll() })
  const { data: invoiceList = [] } = useQuery({ queryKey: ['invoices', 'all'], queryFn: () => invoiceDb.listAll() })
  const { data: budgetList = [] }  = useQuery({ queryKey: ['budget', 'all'],   queryFn: () => budgetDb.listAll() })

  // Calculate Realtime Actionable Notifications (Automatically excluded when work is finished!)
  const allNotifications = useMemo(() => {
    const list = []
    const now = new Date()

    // 1. Long Payment Pending Invoices (> 15 days) — EXCLUDED automatically when payment_status === 'Full Payment Received'
    invoiceList.forEach(inv => {
      const isPaid = inv.payment_status === 'Full Payment Received'
      if (!isPaid) {
        const invDate = inv.inv_date ? new Date(inv.inv_date) : (inv.created_at ? new Date(inv.created_at) : null)
        const daysPending = invDate ? Math.floor((now - invDate) / (1000 * 60 * 60 * 24)) : 0
        if (daysPending >= 15 || !inv.payment_status) {
          const invNo = inv.inv_number || String(inv.id)
          list.push({
            id: `inv-${inv.id}`,
            category: 'invoice',
            title: `Payment Pending: INV #${invNo}`,
            sub: `Amount: ${formatINR(inv.grand_total)} · Pending for ${daysPending > 0 ? `${daysPending} days` : 'review'}`,
            days: daysPending,
            severity: daysPending > 45 ? 'high' : 'medium',
            link: `/invoices?search=${encodeURIComponent(invNo)}`,
            record: inv,
            icon: DollarSign,
            color: 'text-rose-400 bg-rose-950/80 border-rose-800/60'
          })
        }
      }
    })

    // 2. Budget Contracts Expiring Soon (≤ 90 days or Expired) — EXCLUDED automatically when contract validity > 90 days
    budgetList.forEach(b => {
      const { daysRemaining, status } = parseValidity(b.validity_of_contract)
      if (daysRemaining !== null && daysRemaining <= 90) {
        const isExpired = daysRemaining <= 0
        const woNo = b.work_order_number || String(b.id)
        list.push({
          id: `bud-${b.id}`,
          category: 'budget',
          title: isExpired ? `Contract Expired: WO #${woNo}` : `Budget Expiring: WO #${woNo}`,
          sub: `${b.operation || 'Contract'} · ${isExpired ? 'Validity Ended' : `${daysRemaining} days remaining`}`,
          days: daysRemaining,
          severity: isExpired ? 'high' : daysRemaining <= 30 ? 'medium' : 'low',
          link: `/budget?search=${encodeURIComponent(woNo)}`,
          record: b,
          icon: AlertTriangle,
          color: isExpired ? 'text-rose-400 bg-rose-950/80 border-rose-800/60' : 'text-amber-400 bg-amber-950/80 border-amber-800/60'
        })
      }
    })

    // 3. Stage-by-Stage JMS Pending Calculation — EXCLUDED automatically when status === 'Released by A3' or 'Invoiced'
    jmsList.forEach(j => {
      const isFinished = j.status === 'Released by A3' || j.status === 'Invoiced'
      if (isFinished) return

      const st = String(j.status || '').trim().toLowerCase()
      let prevReleaseDate = null
      let stageName = 'Pending A1'

      if (st.includes('a3')) {
        stageName = 'Pending A3'
        prevReleaseDate = j.qsd_release_date || j.a2_release_date || j.a1_release_date || j.jms_create_date || j.created_at
      } else if (st.includes('qsd')) {
        stageName = 'Pending QSD'
        prevReleaseDate = j.a2_release_date || j.a1_release_date || j.jms_create_date || j.created_at
      } else if (st.includes('a2')) {
        stageName = 'Pending A2'
        prevReleaseDate = j.a1_release_date || j.jms_create_date || j.created_at
      } else {
        stageName = 'Pending A1'
        prevReleaseDate = j.jms_create_date || j.created_at
      }

      if (!prevReleaseDate) return
      const refDate = new Date(prevReleaseDate)
      if (isNaN(refDate.getTime())) return

      const daysPending = Math.floor((now - refDate) / (1000 * 60 * 60 * 24))

      if (daysPending > 10) {
        const jmsNo = j.jms_no || j.work_order_number || String(j.id)
        list.push({
          id: `jms-${j.id}`,
          category: 'jms',
          title: `Long ${stageName}: JMS #${j.jms_no || 'Record'}`,
          sub: `WO #${j.work_order_number || 'N/A'} · Pending in ${stageName} for ${daysPending} days (Since ${formatDate(prevReleaseDate)})`,
          days: daysPending,
          severity: daysPending > 30 ? 'high' : 'medium',
          link: `/jms?search=${encodeURIComponent(jmsNo)}`,
          record: j,
          icon: Clock,
          color: 'text-purple-400 bg-purple-950/80 border-purple-800/60'
        })
      }
    })

    return list.sort((a, b) => {
      if (a.severity === 'high' && b.severity !== 'high') return -1
      if (a.severity !== 'high' && b.severity === 'high') return 1
      return b.days - a.days
    })
  }, [jmsList, invoiceList, budgetList])

  // Automatically prune resolved notification IDs from readNotifIds
  useEffect(() => {
    const validIds = new Set(allNotifications.map(n => n.id))
    setReadNotifIds(prev => {
      const filtered = prev.filter(id => validIds.has(id))
      if (filtered.length !== prev.length) {
        localStorage.setItem(storageKey, JSON.stringify(filtered))
        return filtered
      }
      return prev
    })
  }, [allNotifications, storageKey])

  // Split Notifications into Unread & Read lists
  const unreadNotifications = useMemo(() => {
    return allNotifications.filter(n => !readNotifIds.includes(n.id))
  }, [allNotifications, readNotifIds])

  const readNotifications = useMemo(() => {
    return allNotifications.filter(n => readNotifIds.includes(n.id))
  }, [allNotifications, readNotifIds])

  // Close notification menu on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (!globalSearch.trim()) return
    navigate(`/jms?search=${encodeURIComponent(globalSearch)}`)
  }

  const handleNotificationClick = (item) => {
    markAsRead(item.id)
    setNotifOpen(false)
    setSelectedNotif(item)
  }

  const sidebar = (
    <aside className={`flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'} min-h-screen shadow-xl z-20`}>
      {/* Brand Top Header */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-slate-800 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-purple-600/30">
              M
            </div>
            <div>
              <p className="text-sm font-extrabold text-white leading-tight tracking-tight">MMC</p>
              <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider leading-tight">Contractor Suite</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          {collapsed ? <Menu size={18} /> : <X size={18} />}
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {NAV.map(item => (
          <NavItem key={item.label} item={item} collapsed={collapsed} unreadCount={unreadNotifications.length} />
        ))}
        {isAdmin && (
          <Link
            to="/admin"
            className={`sidebar-link ${location.pathname === '/admin' ? 'active' : ''}`}
            title="Admin Panel"
          >
            <Settings size={18} />
            {!collapsed && <span>Admin Panel</span>}
          </Link>
        )}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-800 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2.5 mb-2 px-2">
            <img src="/mmc_logo.jpg" alt="MMC Logo" className={`w-8 h-8 rounded-xl object-cover ring-2 ${isAdmin ? 'ring-purple-500' : 'ring-pink-500'}`} />
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.email?.split('@')[0] || 'User'}</p>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                {isAdmin ? 'MMC Admin' : (role ?? 'user')}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className="sidebar-link w-full text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
        >
          <LogOut size={18} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  )

  const activeList = notifTab === 'unread' ? unreadNotifications : readNotifications

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 antialiased">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">{sidebar}</div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div className="flex-shrink-0">{sidebar}</div>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="hidden md:flex items-center justify-between px-6 h-16 bg-slate-900/90 border-b border-slate-800 shrink-0 backdrop-blur-md z-10 shadow-sm relative">
          {/* Left Brand Title */}
          <div className="flex items-center gap-2.5">
            <span className="text-base font-extrabold text-purple-400 tracking-tight">MM CONTRACTOR</span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">PORTAL</span>
          </div>

          {/* Center Pill Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative w-96">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search work orders, invoices, JMS..."
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-full bg-slate-800 border border-slate-700/60 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </form>

          {/* Right Profile Avatar Pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 pl-3">
              <img src="/mmc_logo.jpg" alt="Avatar" className="w-9 h-9 rounded-full object-cover ring-2 ring-purple-500 shadow-sm" />
              <div className="text-left hidden lg:block">
                <p className="text-xs font-bold text-white leading-tight">
                  {user?.email?.split('@')[0] || 'MMC User'}
                </p>
                <p className="text-[10px] font-semibold text-purple-400 leading-tight">
                  {isAdmin ? 'MMC Director' : 'Contractor User'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 bg-slate-900 border-b border-slate-800">
          <button onClick={() => setMobileOpen(true)} className="text-slate-300">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-purple-600 text-white font-extrabold text-xs flex items-center justify-center">M</div>
            <p className="text-sm font-extrabold text-white">MMC</p>
          </div>
          <div className="w-5" />
        </header>

        {/* Main Outlet */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-in">
          <Outlet context={{
            allNotifications,
            unreadNotifications,
            readNotifications,
            markAsRead,
            markAllAsRead,
            clearReadHistory,
            setSelectedNotif,
            notifCount: unreadNotifications.length
          }} />
        </main>
      </div>

      {/* On-screen Notification Record Summary Modal */}
      <NotificationDetailModal
        notif={selectedNotif}
        onClose={() => setSelectedNotif(null)}
        onNavigate={(link) => navigate(link)}
      />
    </div>
  )
}

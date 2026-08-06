import { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { jmsDb, invoiceDb, budgetDb } from '../lib/db'
import { formatINR, formatDate, parseValidity } from '../lib/utils'
import {
  LayoutDashboard, FileText, Receipt, PieChart, Settings,
  ChevronRight, ChevronDown, LogOut, Menu, X, Shield, User, Search, Bell, AlertTriangle, Clock, DollarSign, ArrowRight, CheckCheck
} from 'lucide-react'

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'JMS', icon: FileText, path: '/jms' },
  { label: 'Invoices', icon: Receipt, path: '/invoices' },
  { label: 'Budget', icon: PieChart, path: '/budget' },
]

function NavItem({ item, collapsed }) {
  const location = useLocation()
  const isActive = location.pathname.startsWith(item.path)

  return (
    <Link
      to={item.path}
      className={`sidebar-link ${isActive ? 'active' : ''}`}
      title={item.label}
    >
      <item.icon size={18} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )
}

export default function Layout() {
  const { user, role, isAdmin, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mmc_read_notifications') || '[]')
    } catch (e) {
      return []
    }
  })
  const notifRef = useRef(null)

  const navigate = useNavigate()
  const location = useLocation()

  // Persist read notifications to localStorage
  const markAsRead = (id) => {
    setReadNotifIds(prev => {
      if (prev.includes(id)) return prev
      const updated = [...prev, id]
      localStorage.setItem('mmc_read_notifications', JSON.stringify(updated))
      return updated
    })
  }

  const markAllAsRead = (allIds) => {
    setReadNotifIds(prev => {
      const updated = Array.from(new Set([...prev, ...allIds]))
      localStorage.setItem('mmc_read_notifications', JSON.stringify(updated))
      return updated
    })
  }

  // Fetch live DB data for notifications
  const { data: jmsList = [] }     = useQuery({ queryKey: ['jms', 'all'],     queryFn: () => jmsDb.listAll() })
  const { data: invoiceList = [] } = useQuery({ queryKey: ['invoices', 'all'], queryFn: () => invoiceDb.listAll() })
  const { data: budgetList = [] }  = useQuery({ queryKey: ['budget', 'all'],   queryFn: () => budgetDb.listAll() })

  // Calculate Realtime Actionable Notifications
  const allNotifications = useMemo(() => {
    const list = []
    const now = new Date()

    // 1. Long Payment Pending Invoices
    invoiceList.forEach(inv => {
      if (inv.payment_status !== 'Full Payment Received') {
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
            icon: DollarSign,
            color: 'text-rose-400 bg-rose-950/80 border-rose-800/60'
          })
        }
      }
    })

    // 2. Budget Contracts Expiring Soon
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
          icon: AlertTriangle,
          color: isExpired ? 'text-rose-400 bg-rose-950/80 border-rose-800/60' : 'text-amber-400 bg-amber-950/80 border-amber-800/60'
        })
      }
    })

    // 3. Long Days Pending JMS Records
    jmsList.forEach(j => {
      const isReleased = j.status === 'Released by A3' || j.status === 'Invoiced'
      if (!isReleased) {
        const jmsDate = j.jms_create_date ? new Date(j.jms_create_date) : (j.created_at ? new Date(j.created_at) : null)
        const daysPending = jmsDate ? Math.floor((now - jmsDate) / (1000 * 60 * 60 * 24)) : 0
        if (daysPending >= 10) {
          const jmsNo = j.jms_no || j.work_order_number || String(j.id)
          list.push({
            id: `jms-${j.id}`,
            category: 'jms',
            title: `Long Pending JMS #${j.jms_no || 'Record'}`,
            sub: `WO #${j.work_order_number || 'N/A'} · Stage "${j.status || 'Pending A1'}" for ${daysPending} days`,
            days: daysPending,
            severity: daysPending > 30 ? 'high' : 'medium',
            link: `/jms?search=${encodeURIComponent(jmsNo)}`,
            icon: Clock,
            color: 'text-purple-400 bg-purple-950/80 border-purple-800/60'
          })
        }
      }
    })

    return list.sort((a, b) => {
      if (a.severity === 'high' && b.severity !== 'high') return -1
      if (a.severity !== 'high' && b.severity === 'high') return 1
      return b.days - a.days
    })
  }, [jmsList, invoiceList, budgetList])

  // Filter unread notifications
  const unreadNotifications = useMemo(() => {
    return allNotifications.filter(n => !readNotifIds.includes(n.id))
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
    navigate(item.link)
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
          <NavItem key={item.label} item={item} collapsed={collapsed} />
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

          {/* Right Profile & Notifications Controls */}
          <div className="flex items-center gap-3 relative" ref={notifRef}>
            {/* Bell Icon with Unread Badge */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(o => !o)}
                className="w-9 h-9 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700 transition-colors relative"
                title="System Notifications"
              >
                <Bell size={17} />
                {unreadNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-slate-900 animate-pulse">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>

              {/* Notification Drawer Dropdown */}
              {notifOpen && (
                <div className="absolute right-0 top-12 w-96 max-h-[480px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-50 animate-fade-in flex flex-col">
                  <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell size={16} className="text-purple-400" />
                      <h3 className="text-sm font-extrabold text-white">System Alerts</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadNotifications.length > 0 && (
                        <button
                          onClick={() => markAllAsRead(allNotifications.map(n => n.id))}
                          className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-950 px-2 py-0.5 rounded-lg border border-purple-800/60 transition-colors"
                        >
                          <CheckCheck size={12} /> Mark all read
                        </button>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                        {unreadNotifications.length} Unread
                      </span>
                    </div>
                  </div>

                  <div className="overflow-y-auto p-3 space-y-2 flex-1">
                    {allNotifications.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400">
                        ✨ No pending alerts or contract expiry issues!
                      </div>
                    ) : (
                      allNotifications.map(item => {
                        const Icon = item.icon
                        const isRead = readNotifIds.includes(item.id)
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleNotificationClick(item)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 group ${
                              isRead
                                ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                                : 'bg-slate-800/80 border-slate-700/80 hover:border-purple-500/60 shadow-md'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${item.color}`}>
                              <Icon size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className={`text-xs font-bold truncate transition-colors ${isRead ? 'text-slate-400' : 'text-white group-hover:text-purple-300'}`}>
                                  {item.title}
                                </p>
                                <span className="text-[9px] font-mono text-slate-400 shrink-0 ml-1">
                                  {item.days > 0 ? `${item.days}d` : 'Urgent'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-2">
                                {item.sub}
                              </p>
                            </div>
                            {!isRead && (
                              <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0 mt-1" title="Unread" />
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="p-3 bg-slate-950 border-t border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 font-medium">Click any alert to open exact record</span>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar Pill */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
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
          <Outlet />
        </main>
      </div>
    </div>
  )
}

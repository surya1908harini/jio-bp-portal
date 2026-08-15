import { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { jmsDb, invoiceDb, budgetDb } from '../lib/db'
import { supabase } from '../lib/supabase'
import { formatINR, formatDate, parseValidity, applyInvoiceDateAndStatusRules } from '../lib/utils'
import NotificationDetailModal from './NotificationDetailModal'
import useScrollReveal from '../hooks/useScrollReveal'
import {
  LayoutDashboard, FileText, Receipt, PieChart, Settings, Database, ShoppingBag, Layers, ClipboardCheck,
  ChevronRight, ChevronDown, LogOut, Menu, X, Shield, User, Search, Bell, AlertTriangle, Clock, DollarSign, ArrowRight, CheckCheck, Trash2, CheckCircle2, Edit2, Home, Banknote, Sun, Moon, Activity
} from 'lucide-react'
import toast from 'react-hot-toast'

const PRIMARY_NAV = [
  { label: 'Home', icon: Home, path: '/home' },
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'JMS', icon: FileText, path: '/jms' },
  { label: 'Invoices', icon: Receipt, path: '/invoices' },
  { label: 'Payments', icon: Banknote, path: '/payments' },
  { label: 'Purchase Bill', icon: ShoppingBag, path: '/purchase-bills' },
  { label: 'Budget', icon: PieChart, path: '/budget' },
  { label: 'OPERATION WARD', icon: Activity, path: '/bulk-operations', adminOnly: true },
  { label: 'PF Clearance', icon: ClipboardCheck, path: '/pf-clearance' },
]

const SECONDARY_NAV = [
  { label: 'Master Data', icon: Database, path: '/masters', adminOnly: true },
  { label: 'Admin Panel', icon: Settings, path: '/admin', adminOnly: true },
]

export default function Layout() {
  const { user, role, isAdmin, signOut, updateProfileName } = useAuth()
  const qc = useQueryClient()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])
  
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
  const profileRef = useRef(null)

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
    const idsToMark = Array.isArray(allIds) ? allIds : allNotifications.map(n => n.id)
    setReadNotifIds(prev => {
      const updated = Array.from(new Set([...prev, ...idsToMark]))
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
      const syncedInv = applyInvoiceDateAndStatusRules(inv)
      const isPaid = syncedInv.payment_status === 'Full Payment Received'
      if (!isPaid) {
        const invDate = syncedInv.inv_date ? new Date(syncedInv.inv_date) : (syncedInv.created_at ? new Date(syncedInv.created_at) : null)
        const daysPending = invDate ? Math.floor((now - invDate) / (1000 * 60 * 60 * 24)) : 0
        if (daysPending >= 15 || !syncedInv.payment_status) {
          const invNo = syncedInv.inv_number || String(syncedInv.id)
          list.push({
            id: `inv-${syncedInv.id}`,
            category: 'invoice',
            title: `Payment Pending: INV #${invNo}`,
            sub: `Amount: ${formatINR(syncedInv.grand_total)} · Pending for ${daysPending > 0 ? `${daysPending} days` : 'review'}`,
            days: daysPending,
            severity: daysPending > 45 ? 'high' : 'medium',
            link: `/invoices?search=${encodeURIComponent(invNo)}`,
            record: syncedInv,
            icon: DollarSign,
            color: 'text-rose-400 bg-rose-950/80 border-rose-800/60'
          })
        }
      }
    })

    // 2. Expiring Budgets (< 30 days) — NO EXCLUSION needed (Budgets always expire unless extended)
    budgetList.forEach(b => {
      if (b.validity) {
        const endDate = parseValidity(b.validity)?.end
        if (endDate) {
          const daysLeft = Math.floor((endDate - now) / (1000 * 60 * 60 * 24))
          if (daysLeft >= 0 && daysLeft <= 30) {
            list.push({
              id: `budget-${b.id}`,
              category: 'budget',
              title: `Budget Expiring: ${b.site}`,
              sub: `Valid till: ${formatDate(endDate)} (${daysLeft} days left)`,
              days: daysLeft,
              severity: daysLeft <= 7 ? 'high' : 'medium',
              link: `/budget?search=${encodeURIComponent(b.site)}`,
              record: b,
              icon: AlertTriangle,
              color: 'text-amber-400 bg-amber-950/80 border-amber-800/60'
            })
          }
        }
      }
    })

    // 3. Stalled JMS Records (> 10 days) — EXCLUDED automatically when status is 'Released by A3' or 'Cancelled / Deleted'
    jmsList.forEach(j => {
      if (j.status === 'Released by A3' || j.status === 'Cancelled / Deleted' || j.status === 'Released A3') return 
      
      let stageName = ''
      let prevReleaseDate = null
      
      if (j.status === 'Pending QSD') {
        stageName = 'Pending QSD'
        prevReleaseDate = j.a1_date || j.jms_create_date || j.created_at
      } else if (j.status === 'Pending A3') {
        stageName = 'Pending A3'
        prevReleaseDate = j.qsd_date || j.a1_date || j.jms_create_date || j.created_at
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
          color: 'text-blue-400 bg-blue-950/80 border-blue-800/60'
        })
      }
    })

    // 4. Deleted Records Notifications (JMS and Invoices)
    try {
      const deletedLogs = JSON.parse(localStorage.getItem('deleted_records_log') || '[]')
      deletedLogs.forEach(del => {
        list.push({
          id: del.id,
          category: del.type === 'jms' ? 'jms' : 'invoice',
          title: del.title,
          sub: del.sub,
          days: 0,
          severity: 'high',
          link: del.type === 'jms' ? '/jms' : '/invoices',
          record: del,
          icon: Trash2,
          color: 'text-rose-400 bg-rose-950/80 border-rose-800/60'
        })
      })
    } catch (e) {}

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

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Automatically handle scroll reveal animations on route changes
  useScrollReveal()

  const handleNotificationClick = (item) => {
    markAsRead(item.id)
    setNotifOpen(false)
    setSelectedNotif(item)
  }

  const handleNameEdit = async (e) => {
    e.stopPropagation()
    const currentName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
    const newName = window.prompt("Edit your display name:", currentName)
    if (newName && newName.trim() !== currentName) {
      try {
        await updateProfileName(newName.trim())
        toast.success("Profile name updated!")
      } catch (err) {
        toast.error("Failed to update name: " + err.message)
      }
    }
  }

  const activeList = notifTab === 'unread' ? unreadNotifications : readNotifications
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'MMC User'

  return (
    <div className="flex h-screen overflow-hidden bg-brand-bg dark:bg-[#151521] text-brand-text antialiased font-sans">
      
      {/* ── Left Sidebar (Desktop) ── */}
      <aside className={`hidden lg:flex flex-col bg-brand-sidebar dark:bg-[#1e1e2d] border-r border-brand-border dark:border-gray-800 shrink-0 z-20 transition-all duration-300 ${sidebarCollapsed ? 'w-[80px]' : 'w-[260px]'}`}>
        
        {/* Brand Header */}
        <div className="p-4 border-b border-brand-border dark:border-gray-800 flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 cursor-pointer h-10" onClick={() => navigate('/home')}>
               <div className="w-8 h-8 rounded bg-orange-500 flex items-center justify-center font-black text-white">MM</div>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-2 text-gray-500 dark:text-white dark:text-white hover:text-orange-500 rounded-lg hover:bg-gray-200 mx-auto transition-colors">
            <Menu size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          
          {/* User Profile Area */}
          {!sidebarCollapsed && (
            <div className="p-4 pb-2">
              <div className="flex items-center gap-3 mb-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={handleNameEdit}>
                <img src="/mmc_logo.jpg" alt="User" className="w-10 h-10 rounded-xl object-cover shadow-sm border border-gray-200 dark:border-gray-800" />
                <div>
                  <h3 className="mb-0 text-sm font-bold text-gray-900 dark:text-white">{userName}</h3>
                  <span className="text-xs text-gray-500 dark:text-white dark:text-white">{isAdmin ? 'Administrator' : role || 'User'}</span>
                </div>
              </div>
            </div>
          )}

          {/* List Menu Navigation */}
          <div className="px-3 flex-1 flex flex-col gap-1 mt-4">
            {[...PRIMARY_NAV, ...SECONDARY_NAV].filter(i => !i.adminOnly || isAdmin).map(item => {
              const isActive = location.pathname.startsWith(item.path)
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`flex items-center rounded-xl transition-all duration-200 ${
                    sidebarCollapsed ? 'justify-center p-3' : 'px-4 py-3 gap-3'
                  } ${
                    isActive 
                      ? 'bg-orange-50 text-orange-600 font-bold' 
                      : 'text-gray-600 dark:text-white dark:text-white hover:bg-gray-100 dark:bg-gray-800 hover:text-orange-500 font-semibold'
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  {!sidebarCollapsed && (
                    <span className="text-sm">{item.label}</span>
                  )}
                </Link>
              )
            })}
          </div>

          {/* Bottom Actions */}
          <div className="p-4 mt-auto border-t border-gray-200 dark:border-gray-800">
            <button onClick={() => { setProfileDropdownOpen(false); signOut() }} className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-gray-500 dark:text-white dark:text-white hover:text-rose-600 hover:bg-rose-50 transition-all ${sidebarCollapsed ? 'px-0' : 'px-4'}`} title="Sign Out">
              <LogOut size={18} /> 
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>

        </div>
      </aside>

      {/* ── Mobile Sidebar Drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden flex">
          <aside className="w-[280px] bg-brand-sidebar dark:bg-[#1e1e2d] text-gray-800 dark:text-white h-full flex flex-col shadow-2xl animate-slide-right">
            <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-orange-500 flex items-center justify-center font-black text-white">MM</div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-gray-400 dark:text-white hover:text-gray-900 dark:text-white p-1 rounded hover:bg-gray-100 dark:bg-gray-800">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="grid grid-cols-2 gap-3">
                {[...PRIMARY_NAV, ...SECONDARY_NAV].filter(i => !i.adminOnly || isAdmin).map(item => {
                  const isActive = location.pathname.startsWith(item.path)
                  return (
                    <Link
                      key={item.label}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className="flex flex-col items-center justify-center text-center group"
                    >
                      <div className={`w-full aspect-square flex flex-col items-center justify-center rounded-2xl mb-1 transition-all border ${
                        isActive ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-white dark:bg-[#1e1e2d] text-gray-600 dark:text-white dark:text-white border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:bg-[#151521] hover:text-orange-500'
                      }`}>
                        <item.icon size={24} className="mb-2" />
                        <span className="text-[11px] font-semibold">{item.label}</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
               <button onClick={() => signOut()} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 transition-colors">
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </aside>
          <div className="flex-1 bg-gray-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-brand-bg dark:bg-[#151521] relative">
        
        {/* ── Top Header ── */}
        <header className="py-2 px-4 md:px-6 flex flex-wrap items-center justify-between shrink-0 bg-transparent z-10 min-h-[60px]">
          <div className="flex items-center gap-3 w-1/4">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden text-gray-500 dark:text-white dark:text-white hover:text-orange-500 p-1.5 rounded-lg hover:bg-white dark:bg-[#1e1e2d] shadow-sm border border-transparent hover:border-gray-200 dark:border-gray-800">
              <Menu size={20} />
            </button>
            
            <h1 className="text-lg md:text-xl font-extrabold text-gray-900 dark:text-white mb-0 hidden sm:block">
              {location.pathname === '/home' ? 'Home' : 
               location.pathname.includes('/dashboard') ? 'Dashboard' :
               location.pathname.includes('/jms') ? 'JMS Management' :
               location.pathname.includes('/invoices') ? 'Invoices Management' :
               location.pathname.includes('/pf-clearance') ? 'PF Clearance' :
               location.pathname.includes('/purchase-bills') ? 'Purchase Bills' :
               location.pathname.includes('/budget') ? 'Budget Analysis' :
               location.pathname.includes('/payments') ? 'Payments' : 
               location.pathname.includes('/bulk-operations') ? 'OPERATION WARD' : 'Portal'}
            </h1>
          </div>

          {/* Portal Target for Centered Tabs */}
          <div id="topbar-center" className="flex-1 flex justify-center items-center overflow-hidden px-2"></div>

          <div className="flex items-center justify-end gap-2 md:gap-4 w-1/4 ml-auto">
            

            
            {/* Portal Target for Page-Specific Actions (Filters) */}
            <div id="topbar-actions" className="flex items-center gap-2"></div>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 text-gray-500 dark:text-white dark:text-white hover:text-orange-500 hover:bg-white dark:bg-[#1e1e2d] rounded-full transition-colors"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {location.pathname === '/home' && (
              <>
                <div className="w-px h-6 bg-gray-300 hidden md:block mx-1"></div>

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className={`p-2 rounded-full transition-all relative ${
                  notifOpen 
                    ? 'bg-orange-500 text-white shadow-md' 
                    : 'text-gray-500 dark:text-white dark:text-white hover:text-orange-500 hover:bg-white dark:bg-[#1e1e2d]'
                }`}
              >
                <Bell size={18} />
                {unreadNotifications.length > 0 && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-brand-bg animate-pulse" />
                )}
              </button>

              {/* Notification Dropdown */}
              {notifOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-[#1e1e2d] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden animate-fade-in z-50">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-800/50 bg-white dark:bg-[#1e1e2d] flex items-center justify-between">
                    <h3 className="font-extrabold text-gray-900 dark:text-white text-base">Notifications</h3>
                    {unreadNotifications.length > 0 && (
                      <button onClick={() => markAllAsRead()} className="text-[11px] font-bold text-orange-500 hover:text-orange-500Dark bg-orange-500/10 px-2 py-1 rounded-md transition-colors">
                        Mark all as read
                      </button>
                    )}
                  </div>
                  
                  <div className="flex border-b border-gray-100 dark:border-gray-800/50 bg-gray-50 dark:bg-[#151521]/50">
                    <button
                      onClick={() => setNotifTab('unread')}
                      className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${notifTab === 'unread' ? 'text-orange-500 border-b-2 border-orange-500 bg-white dark:bg-[#1e1e2d]' : 'text-gray-400 dark:text-white hover:text-gray-600 dark:text-white dark:text-white hover:bg-gray-100 dark:bg-gray-800'}`}
                    >
                      Unread ({unreadNotifications.length})
                    </button>
                    <button
                      onClick={() => setNotifTab('read')}
                      className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${notifTab === 'read' ? 'text-orange-500 border-b-2 border-orange-500 bg-white dark:bg-[#1e1e2d]' : 'text-gray-400 dark:text-white hover:text-gray-600 dark:text-white dark:text-white hover:bg-gray-100 dark:bg-gray-800'}`}
                    >
                      Read ({readNotifications.length})
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {activeList.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 dark:text-white text-xs italic">
                        No {notifTab} notifications.
                      </div>
                    ) : (
                      activeList.map(item => {
                        const Icon = item.icon
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleNotificationClick(item)}
                            className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border border-transparent ${
                              notifTab === 'unread' ? 'bg-blue-50/30 hover:bg-blue-50 hover:border-blue-100' : 'hover:bg-gray-50 dark:bg-[#151521] hover:border-gray-100 dark:border-gray-800/50'
                            }`}
                          >
                            <div className={`p-2 rounded-lg shrink-0 ${item.color ? item.color.replace('bg-', 'bg-opacity-10 text-opacity-100 ') : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-white dark:text-white'}`}>
                              <Icon size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                               <h4 className="text-xs font-bold text-gray-900 dark:text-white line-clamp-1">{item.title}</h4>
                              <p className="text-[10px] text-gray-500 dark:text-white dark:text-white mt-1 line-clamp-2 leading-relaxed">{item.sub}</p>
                              <span className="text-[9px] font-bold uppercase text-orange-500 mt-2 block">
                                {item.severity === 'high' ? 'CRITICAL' : 'NOTICE'}
                              </span>
                            </div>
                            {notifTab === 'unread' && (
                              <button onClick={(e) => { e.stopPropagation(); markAsRead(item.id) }} className="p-1.5 text-gray-400 dark:text-white hover:text-orange-500 rounded-md hover:bg-white dark:bg-[#1e1e2d] border border-transparent hover:border-gray-200 dark:border-gray-800 transition-colors shadow-sm" title="Mark as read">
                                <CheckCheck size={14} />
                              </button>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  {notifTab === 'read' && readNotifications.length > 0 && (
                    <div className="p-2 border-t border-gray-100 dark:border-gray-800/50 bg-gray-50 dark:bg-[#151521]/50">
                      <button onClick={clearReadHistory} className="w-full py-2 text-[11px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                        <Trash2 size={12} /> Clear History
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Top Right Profile Toggle (if desired, or search) */}
            <div className="hidden md:flex relative w-48 xl:w-64 ml-2">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search size={14} className="text-gray-400 dark:text-white" />
              </div>
              <input type="text" placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1e1e2d] border border-gray-200 dark:border-gray-800 rounded-full text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all shadow-sm placeholder-gray-400" />
            </div>
            </>
            )}

          </div>
        </header>

        {/* ── Main Outlet ── */}
        <main key={location.pathname} className="flex-1 overflow-y-auto p-4 md:p-8 animate-page-enter scroll-smooth">
          <div className="w-full max-w-screen-2xl mx-auto">
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
          </div>
        </main>
      </div>

      <NotificationDetailModal
        notif={selectedNotif}
        onClose={() => setSelectedNotif(null)}
        onNavigate={(link) => navigate(link)}
      />
    </div>
  )
}

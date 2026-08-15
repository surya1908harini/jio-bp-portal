import { useState, useMemo } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import {
  Bell, Clock, DollarSign, AlertTriangle, Filter, Search, CheckCheck, Trash2, CheckCircle2,
  ExternalLink, Eye, ArrowRight, ShieldAlert, Check
} from 'lucide-react'
import ModuleHeader from '../components/ModuleHeader'
import toast from 'react-hot-toast'
import { formatDate } from '../lib/utils'

export default function NotificationPage() {
  const navigate = useNavigate()
  const context = useOutletContext() || {}

  const {
    allNotifications = [],
    unreadNotifications = [],
    readNotifications = [],
    markAsRead = () => {},
    markAllAsRead = () => {},
    clearReadHistory = () => {},
    setSelectedNotif = () => {}
  } = context

  const [activeTab, setActiveTab] = useState('unread') // 'unread' or 'read'
  const [categoryFilter, setCategoryFilter] = useState('all') // 'all', 'jms', 'invoice', 'budget'
  const [searchQuery, setSearchQuery] = useState('')

  const activeList = useMemo(() => {
    return activeTab === 'unread' ? unreadNotifications : readNotifications
  }, [activeTab, unreadNotifications, readNotifications])

  const filteredNotifications = useMemo(() => {
    return activeList.filter(n => {
      if (categoryFilter !== 'all' && n.category !== categoryFilter) return false

      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const title = (n.title || '').toLowerCase()
        const sub = (n.sub || '').toLowerCase()
        const wo = (n.record?.work_order_number || '').toLowerCase()
        const jms = (n.record?.jms_no || '').toLowerCase()
        const inv = (n.record?.inv_number || '').toLowerCase()
        return title.includes(q) || sub.includes(q) || wo.includes(q) || jms.includes(q) || inv.includes(q)
      }
      return true
    })
  }, [activeList, categoryFilter, searchQuery])

  const highPriorityCount = useMemo(() => {
    return allNotifications.filter(n => n.severity === 'high').length
  }, [allNotifications])

  const CATEGORIES = [
    { key: 'all',     label: 'All Notifications', icon: Bell },
    { key: 'jms',     label: 'JMS Approvals',     icon: Clock },
    { key: 'invoice', label: 'Invoices & Payments', icon: DollarSign },
    { key: 'budget',  label: 'Budget Validity',   icon: AlertTriangle },
  ]

  const handleOpenDetail = (notif) => {
    if (activeTab === 'unread') {
      markAsRead(notif.id)
    }
    setSelectedNotif(notif)
  }

  const handleNavigate = (e, link, id) => {
    e.stopPropagation()
    if (activeTab === 'unread') {
      markAsRead(id)
    }
    navigate(link)
  }

  return (
    <div className="space-y-6">
      {/* Header Banner & Executive Stat Cards */}
      <ModuleHeader
        title="Notification Center"
        subtitle="Real-time alerts, JMS pending approvals (>10d), payment delays (>15d), and contract validity notices."
        actions={
          <div className="flex gap-2 flex-wrap">
            {activeTab === 'unread' && unreadNotifications.length > 0 && (
              <button
                onClick={() => { markAllAsRead(allNotifications.map(n => n.id)); toast.success('All notifications marked as read') }}
                className="btn-ghost"
              >
                <CheckCheck size={14} className="text-emerald-400" /> Mark All as Read
              </button>
            )}
            {activeTab === 'read' && readNotifications.length > 0 && (
              <button
                onClick={() => { clearReadHistory(); toast.success('Read history cleared') }}
                className="btn-ghost"
              >
                <Trash2 size={14} className="text-rose-400" /> Clear History
              </button>
            )}
          </div>
        }
        stats={[
          { icon: Bell,          label: 'Total Active Alerts', value: allNotifications.length, sub: 'Actionable items', color: 'orange' },
          { icon: ShieldAlert,   label: 'High Priority',      value: highPriorityCount, sub: 'Requires attention', color: 'cyan' },
          { icon: Clock,         label: 'Unread Alerts',       value: unreadNotifications.length, sub: 'New notifications', color: 'amber' },
          { icon: CheckCircle2,  label: 'Read History',        value: readNotifications.length, sub: 'Archived items', color: 'green' },
        ]}
      />

      {/* Primary Tab Bar: Unread vs Read History */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex  p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 backdrop-blur-md">
          <button
            onClick={() => setActiveTab('unread')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'unread'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                : 'text-gray-500 dark:text-white dark:text-white hover:text-white hover:bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800/60'
            }`}
          >
            <Bell size={14} />
            Unread Notifications
            {unreadNotifications.length > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-gray-500 dark:text-white dark:text-white">
                {unreadNotifications.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('read')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'read'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                : 'text-gray-500 dark:text-white dark:text-white hover:text-white hover:bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800/60'
            }`}
          >
            <CheckCircle2 size={14} />
            Read History
            {readNotifications.length > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800 text-gray-700 dark:text-white">
                {readNotifications.length}
              </span>
            )}
          </button>
        </div>

        {/* Global Search inside Notification Page */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search alerts by WO, JMS, Inv..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 py-2 text-xs"
          />
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-white dark:text-white" />
        </div>
      </div>

      {/* Category Pills Filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs font-semibold text-gray-500 dark:text-white dark:text-white mr-2 flex items-center gap-1">
          <Filter size={12} /> Filter Category:
        </span>
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => setCategoryFilter(c.key)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              categoryFilter === c.key
                ? 'bg-jio-blue-600 text-white shadow-md'
                : ' text-gray-500 dark:text-white dark:text-white border border-gray-200 dark:border-gray-800 hover:bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800 hover:text-gray-900 dark:text-white'
            }`}
          >
            <c.icon size={13} />
            {c.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white dark:bg-[#1e1e2d] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800/80 flex items-center justify-center text-gray-500 dark:text-white dark:text-white">
              <CheckCircle2 size={28} className="text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {activeTab === 'unread' ? 'All caught up! No unread notifications.' : 'No read notifications in history.'}
            </p>
            <p className="text-xs text-gray-500 dark:text-white dark:text-white max-w-sm">
              {activeTab === 'unread'
                ? 'When a JMS stage approval is pending >10 days, invoice payment is overdue, or budget contract is expiring, alerts will appear here automatically.'
                : 'Items marked as read or cleared will appear in your archived history.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map(n => {
            const IconComponent = n.icon || Bell
            const isHigh = n.severity === 'high'

            return (
              <div
                key={n.id}
                onClick={() => handleOpenDetail(n)}
                className={`bg-white dark:bg-[#1e1e2d] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer transition-all hover:border-orange-500/50 hover: group ${
                  isHigh ? 'border-l-4 border-l-rose-500 bg-rose-950/10' : ''
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {/* Category Icon */}
                  <div className={`p-2.5 rounded-xl border flex-shrink-0 mt-0.5 ${n.color || 'bg-orange-950/80 text-orange-400 border-orange-800/60'}`}>
                    <IconComponent size={18} />
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white group-hover:text-orange-300 transition-colors">
                        {n.title}
                      </h3>
                      {isHigh && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase tracking-wider">
                          URGENT
                        </span>
                      )}
                      {n.days !== undefined && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800 text-gray-700 dark:text-white border border-gray-200 dark:border-gray-800">
                          {n.days > 0 ? `${n.days} days` : 'Expiring'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-white dark:text-white leading-relaxed truncate">
                      {n.sub}
                    </p>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenDetail(n) }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800 text-gray-700 dark:text-white hover:bg-orange-600 hover:text-white transition-all flex items-center gap-1.5"
                  >
                    <Eye size={13} /> View Details
                  </button>

                  <button
                    onClick={(e) => handleNavigate(e, n.link, n.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-jio-blue-600/80 text-white hover:bg-jio-blue-600 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    Go to Record <ArrowRight size={13} />
                  </button>

                  {activeTab === 'unread' ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAsRead(n.id); toast.success('Marked as read') }}
                      className="p-1.5 rounded-xl text-gray-500 dark:text-white dark:text-white hover:text-emerald-400 hover:bg-emerald-950/40 transition-colors"
                      title="Mark as read"
                    >
                      <Check size={15} />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAsRead(n.id); toast.success('Moved back to unread') }}
                      className="p-1.5 rounded-xl text-gray-500 dark:text-white dark:text-white hover:text-amber-400 hover:bg-amber-950/40 transition-colors"
                      title="Move back to unread"
                    >
                      <Bell size={15} />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

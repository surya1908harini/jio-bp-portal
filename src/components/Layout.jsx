import { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, FileText, Receipt, PieChart, Settings,
  ChevronRight, ChevronDown, LogOut, Menu, X, Shield, User
} from 'lucide-react'
import { FINANCIAL_YEARS } from '../lib/utils'

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    label: 'JMS', icon: FileText, path: '/jms'
  },
  {
    label: 'Invoices', icon: Receipt, path: '/invoices'
  },
  {
    label: 'Budget', icon: PieChart, path: '/budget'
  },
]

function NavItem({ item, collapsed }) {
  const location = useLocation()
  const [open, setOpen] = useState(() =>
    item.children?.some(c => location.pathname.startsWith(c.path)) ?? false
  )
  const isActive = item.path
    ? location.pathname === item.path
    : location.pathname.startsWith(item.basePath)

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-full sidebar-link justify-between ${isActive ? 'active' : ''}`}
        >
          <span className="flex items-center gap-3">
            <item.icon size={18} />
            {!collapsed && <span>{item.label}</span>}
          </span>
          {!collapsed && (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        </button>
        {open && !collapsed && (
          <div className="ml-7 mt-1 space-y-0.5 border-l border-jio-blue-800/50 pl-3">
            {item.children.map(child => (
              <Link
                key={child.path}
                to={child.path}
                className={`block px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  location.pathname === child.path
                    ? 'text-white bg-jio-blue-700/60'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link to={item.path} className={`sidebar-link ${isActive ? 'active' : ''}`}>
      <item.icon size={18} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )
}

export default function Layout() {
  const { user, role, isAdmin, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebar = (
    <aside className={`flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300
      ${collapsed ? 'w-16' : 'w-64'} min-h-screen`}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-slate-800 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-jio-blue-600 via-jio-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs tracking-wider shadow-lg border border-jio-blue-400/30">
              MMC
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight tracking-wide">MMC</p>
              <p className="text-[10px] text-slate-400 leading-tight">MM Contractor</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          {collapsed ? <Menu size={16} /> : <X size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(item => (
          <NavItem key={item.label} item={item} collapsed={collapsed} />
        ))}
        {isAdmin && (
          <Link to="/admin" className={`sidebar-link ${location.pathname === '/admin' ? 'active' : ''}`}>
            <Settings size={18} />
            {!collapsed && <span>Admin Panel</span>}
          </Link>
        )}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-slate-800 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2.5 mb-2 px-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isAdmin ? 'bg-gradient-to-br from-jio-red-600 to-rose-800 shadow-md border border-jio-red-500/40' : 'bg-jio-blue-700'}`}>
              {isAdmin ? <Shield size={16} className="text-white" /> : <User size={15} className="text-white" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.email}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isAdmin ? 'bg-jio-red-950/80 text-jio-red-400 border border-jio-red-700/50' : 'bg-jio-blue-950/80 text-jio-blue-400 border border-jio-blue-700/50'}`}>
                  {isAdmin ? 'MMC Admin' : (role ?? 'user')}
                </span>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className="sidebar-link w-full text-jio-red-400 hover:text-jio-red-300 hover:bg-jio-red-900/20"
        >
          <LogOut size={18} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">{sidebar}</div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div className="flex-shrink-0">{sidebar}</div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 bg-slate-900 border-b border-slate-800">
          <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-jio-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-[10px]">MMC</div>
            <p className="text-sm font-bold text-white">MMC</p>
          </div>
          <div className="w-5" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

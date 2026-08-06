import { useState } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, FileText, Receipt, PieChart, Settings,
  ChevronRight, ChevronDown, LogOut, Menu, X, Shield, User, Search, Bell
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
  const navigate = useNavigate()
  const location = useLocation()

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (!globalSearch.trim()) return
    navigate(`/jms?search=${encodeURIComponent(globalSearch)}`)
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
        <header className="hidden md:flex items-center justify-between px-6 h-16 bg-slate-900/90 border-b border-slate-800 shrink-0 backdrop-blur-md z-10 shadow-sm">
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

          {/* Right Profile Controls */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer relative">
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-pink-500 ring-2 ring-slate-900" />
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

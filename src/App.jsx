import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import JmsPage from './pages/JmsPage'
import InvoicePage from './pages/InvoicePage'
import BudgetPage from './pages/BudgetPage'
import NotificationPage from './pages/NotificationPage'
import SearchEnginePage from './pages/SearchEnginePage'
import PurchaseBillPage from './pages/PurchaseBillPage'
import AdminPage from './pages/AdminPage'
import MasterPage from './pages/MasterPage'
import ErrorBoundary from './components/ErrorBoundary'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-jio-blue-500 border-t-transparent rounded-full animate-spin" /></div>
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return null
  return isAdmin ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
  const { user } = useAuth()

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          {/* JMS */}
          <Route path="jms"          element={<JmsPage />} />
          <Route path="jms/:fy"      element={<JmsPage />} />

          {/* Invoices */}
          <Route path="invoices"     element={<InvoicePage />} />
          <Route path="invoices/:fy" element={<InvoicePage />} />

          {/* Purchase Bills */}
          <Route path="purchase-bills"     element={<PurchaseBillPage />} />
          <Route path="purchase-bills/:fy" element={<PurchaseBillPage />} />

          {/* Budget */}
          <Route path="budget"       element={<BudgetPage />} />
          <Route path="budget/:fy"   element={<BudgetPage />} />

          {/* Notifications */}
          <Route path="notifications" element={<NotificationPage />} />

          {/* Search Engine */}
          <Route path="search"        element={<SearchEnginePage />} />

          {/* Master Data Settings (Admin Only) */}
          <Route path="masters"       element={<AdminRoute><MasterPage /></AdminRoute>} />

          {/* Admin */}
          <Route path="admin"        element={<AdminRoute><AdminPage /></AdminRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}

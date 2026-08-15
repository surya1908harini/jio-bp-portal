import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Shield, UserPlus, Trash2, Users, RefreshCw, Lock, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '../lib/utils'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import ModuleHeader from '../components/ModuleHeader'
import HomeSettings from '../components/HomeSettings'

export default function AdminPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState('user')
  const [inviting,    setInviting]    = useState(false)
  const [activeTab,   setActiveTab]   = useState('users')

  // Fetch all user roles via supabase directly
  const { data: roles, isLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id, user_id, role, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries(['admin-roles']); toast.success('Role updated') },
  })

  const updateNameMutation = useMutation({
    mutationFn: async ({ id, newUserId }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ user_id: newUserId })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries(['admin-roles']); toast.success('User name updated') },
  })

  const deleteRoleMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('user_roles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries(['admin-roles']); toast.success('User removed') },
  })

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail) return
    setInviting(true)
    try {
      const { error } = await supabase.from('user_roles').insert({
        user_id: inviteEmail,
        role: inviteRole,
      })
      if (error) throw error
      toast.success(`Role '${inviteRole}' assigned to ${inviteEmail}`)
      setInviteOpen(false)
      setInviteEmail('')
      qc.invalidateQueries(['admin-roles'])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setInviting(false)
    }
  }

  const columns = [
    { key: 'user_id',   header: 'User ID / Email', render: r => (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-gray-700 dark:text-white font-semibold">{r.user_id}</span>
        {r.user_id !== user?.id && (
          <button 
            onClick={() => {
              const newName = window.prompt("Edit User Name/Email:", r.user_id)
              if (newName && newName.trim() !== r.user_id) {
                updateNameMutation.mutate({ id: r.id, newUserId: newName.trim() })
              }
            }}
            className="p-1 hover:bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800 rounded text-gray-500 dark:text-white dark:text-white hover:text-white"
            title="Edit Name"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
        )}
      </div>
    ) },
    { key: 'role',      header: 'Assigned Role',
      render: r => r.user_id === user?.id
        ? <span className="badge badge-a3">You · {r.role}</span>
        : (
          <select
            value={r.role}
            onChange={e => updateRoleMutation.mutate({ userId: r.user_id, role: e.target.value })}
            className="select-field w-auto text-xs py-1"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        )
    },
    { key: 'created_at', header: 'Added Date', render: r => formatDate(r.created_at) },
    {
      key: '_actions', header: 'Actions', sortable: false,
      render: r => r.user_id === user?.id ? (
        <span className="text-xs text-gray-500 dark:text-white dark:text-white">(You)</span>
      ) : (
        <button onClick={() => { if (window.confirm('Remove this user?')) deleteRoleMutation.mutate(r.id) }}
          className="p-1.5 rounded-lg hover:bg-jio-red-900/50 text-jio-red-400 hover:text-white transition-colors">
          <Trash2 size={14} />
        </button>
      )
    },
  ]

  const adminCount = roles?.filter(r => r.role === 'admin').length || 0
  const userCount  = roles?.filter(r => r.role === 'user').length || 0

  return (
    <div className="space-y-6">
      {/* Header Banner & Executive Stat Cards */}
      <ModuleHeader
        title="Admin Control Center"
        subtitle="Manage system permissions, user roles, security access & portal configurations"
        actions={
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => qc.invalidateQueries(['admin-roles'])} className="btn-ghost"><RefreshCw size={14} /> Refresh</button>
            <button onClick={() => setInviteOpen(true)} className="btn-primary"><UserPlus size={14} /> Invite User</button>
          </div>
        }
        stats={[
          { icon: Users, label: 'Total Registered Users', value: roles?.length ?? 0, sub: 'Active Accounts', color: 'orange' },
          { icon: Shield, label: 'Active Admins', value: adminCount, sub: 'Full System Access', color: 'green' },
          { icon: Lock, label: 'Standard Users', value: userCount, sub: 'Portal Viewers', color: 'amber' },
          { icon: CheckCircle2, label: 'System Status', value: 'Healthy', sub: 'Supabase RLS Active', color: 'cyan' },
        ]}
      />

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'users' ? 'bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800 text-white border-b-2 border-orange-500' : 'text-gray-500 dark:text-white dark:text-white hover:text-gray-900 dark:text-white'}`}
        >
          User Roles
        </button>
        <button
          onClick={() => setActiveTab('home_settings')}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'home_settings' ? 'bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800 text-white border-b-2 border-orange-500' : 'text-gray-500 dark:text-white dark:text-white hover:text-gray-900 dark:text-white'}`}
        >
          Home Page Settings
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className="bg-white dark:bg-[#1e1e2d] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 p-5 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-jio-blue-400" />
            <h2 className="text-sm font-semibold text-white">System Users ({roles?.length ?? 0})</h2>
          </div>
          <DataTable columns={columns} data={roles ?? []} loading={isLoading} emptyMessage="No users found" />
        </div>
      ) : (
        <HomeSettings />
      )}

      {/* Invite Modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite New User" icon={<UserPlus size={18} className="text-orange-400" />}>
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-white dark:text-white mb-1.5">Email Address</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              required placeholder="user@example.com" className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-white dark:text-white mb-1.5">Role</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="select-field">
              <option value="user">User (read-only)</option>
              <option value="admin">Admin (full access)</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-800">
            <button type="button" onClick={() => setInviteOpen(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={inviting} className="btn-primary">
              {inviting ? 'Sending…' : <><UserPlus size={14} /> Send Invite</>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

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

export default function AdminPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState('user')
  const [inviting,    setInviting]    = useState(false)

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
    { key: 'user_id',   header: 'User ID / Email', render: r => <span className="font-mono text-xs text-slate-300 font-semibold">{r.user_id}</span> },
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
        <span className="text-xs text-slate-600">—</span>
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
          { icon: Users, label: 'Total Registered Users', value: roles?.length ?? 0, sub: 'Active Accounts', color: 'purple' },
          { icon: Shield, label: 'Active Admins', value: adminCount, sub: 'Full System Access', color: 'green' },
          { icon: Lock, label: 'Standard Users', value: userCount, sub: 'Portal Viewers', color: 'amber' },
          { icon: CheckCircle2, label: 'System Status', value: 'Healthy', sub: 'Supabase RLS Active', color: 'cyan' },
        ]}
      />

      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-jio-blue-400" />
          <h2 className="text-sm font-semibold text-white">System Users ({roles?.length ?? 0})</h2>
        </div>
        <DataTable columns={columns} data={roles ?? []} loading={isLoading} emptyMessage="No users found" />
      </div>

      {/* Invite Modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite User" size="max-w-md">
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              required placeholder="user@example.com" className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="select-field">
              <option value="user">User (read-only)</option>
              <option value="admin">Admin (full access)</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-700">
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

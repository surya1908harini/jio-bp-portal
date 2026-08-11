import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Link as LinkIcon, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { homeDb } from '../lib/db'

export default function HomeSettings() {
  const qc = useQueryClient()
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ['home-settings'],
    queryFn: () => homeDb.getSettings()
  })

  const [form, setForm] = useState({
    pending_title: '',
    pending_desc: '',
    notification_title: '',
    notification_desc: '',
    notifications_list: [],
    links: []
  })

  useEffect(() => {
    if (settings) {
      setForm({
        pending_title: settings.pending_title || '',
        pending_desc: settings.pending_desc || '',
        notification_title: settings.notification_title || '',
        notification_desc: settings.notification_desc || '',
        notifications_list: Array.isArray(settings.notifications_list) ? settings.notifications_list : [],
        links: Array.isArray(settings.links) ? settings.links : []
      })
    }
  }, [settings])

  const mutation = useMutation({
    mutationFn: (payload) => homeDb.updateSettings(payload),
    onSuccess: () => {
      toast.success('Home page settings updated')
      qc.invalidateQueries(['home-settings'])
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update settings')
    }
  })

  const handleSave = () => {
    mutation.mutate(form)
  }

  const addLink = () => {
    setForm(prev => ({
      ...prev,
      links: [...prev.links, { name: '', url: '' }]
    }))
  }

  const addNotification = () => {
    setForm(prev => ({
      ...prev,
      notifications_list: [...prev.notifications_list, { text: '' }]
    }))
  }

  const updateLink = (index, field, value) => {
    const newLinks = [...form.links]
    newLinks[index][field] = value
    setForm(prev => ({ ...prev, links: newLinks }))
  }

  const removeLink = (index) => {
    const newLinks = [...form.links]
    newLinks.splice(index, 1)
    setForm(prev => ({ ...prev, links: newLinks }))
  }

  const updateNotification = (index, value) => {
    const newList = [...form.notifications_list]
    newList[index].text = value
    setForm(prev => ({ ...prev, notifications_list: newList }))
  }

  const removeNotification = (index) => {
    const newList = [...form.notifications_list]
    newList.splice(index, 1)
    setForm(prev => ({ ...prev, notifications_list: newList }))
  }

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading settings...</div>

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Pending Works Section */}
        <div className="glass-card p-6 border-orange-500/20">
          <h3 className="text-lg font-bold text-orange-400 mb-4 flex items-center gap-2">
            Pending Works Block
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Title</label>
              <input
                type="text"
                value={form.pending_title}
                onChange={e => setForm(p => ({ ...p, pending_title: e.target.value }))}
                className="input-field border-slate-700/50 focus:border-orange-500"
                placeholder="e.g. PENDING WORKS IN TYPE MANUAL"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Description</label>
              <textarea
                value={form.pending_desc}
                onChange={e => setForm(p => ({ ...p, pending_desc: e.target.value }))}
                className="input-field min-h-[80px] border-slate-700/50 focus:border-orange-500"
                placeholder="Description below the title"
              />
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="glass-card p-6 border-red-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
              Notifications Block
            </h3>
            <button onClick={addNotification} className="btn-ghost py-1 px-2 text-xs">
              <Plus size={14} /> Add Notification
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Title</label>
              <input
                type="text"
                value={form.notification_title}
                onChange={e => setForm(p => ({ ...p, notification_title: e.target.value }))}
                className="input-field border-slate-700/50 focus:border-red-500"
                placeholder="e.g. NOTIFICATION FOR OFFICE WORK"
              />
            </div>
            
            <div className="pt-2 border-t border-slate-700/50 mt-4">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notification Items</label>
              {form.notifications_list.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-xs border border-dashed border-slate-700 rounded-lg">
                  No notifications. Click "Add Notification"
                </div>
              ) : (
                <div className="space-y-2">
                  {form.notifications_list.map((notif, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={notif.text}
                        onChange={e => updateNotification(idx, e.target.value)}
                        placeholder="e.g. WIFI DUE DATE 29/MM/YYYY"
                        className="input-field py-1.5 text-sm"
                      />
                      <button
                        onClick={() => removeNotification(idx)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* External Links Section */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <LinkIcon size={18} className="text-orange-400" /> External Portal Links
          </h3>
          <button onClick={addLink} className="btn-ghost py-1.5 px-3 text-xs">
            <Plus size={14} /> Add Link
          </button>
        </div>

        {form.links.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-slate-700 rounded-xl">
            No links added yet. Click "Add Link" to create one.
          </div>
        ) : (
          <div className="space-y-3">
            {form.links.map((link, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                <input
                  type="text"
                  value={link.name}
                  onChange={e => updateLink(idx, 'name', e.target.value)}
                  placeholder="Link Name (e.g. Employee Portal)"
                  className="input-field py-2 text-sm w-full sm:w-1/3"
                />
                <input
                  type="url"
                  value={link.url}
                  onChange={e => updateLink(idx, 'url', e.target.value)}
                  placeholder="URL (e.g. https://...)"
                  className="input-field py-2 text-sm w-full sm:w-flex-1"
                />
                <button
                  onClick={() => removeLink(idx)}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="btn-primary min-w-[140px] bg-gradient-to-r from-orange-500 to-red-600 shadow-orange-500/20"
        >
          {mutation.isPending ? 'Saving...' : <><Save size={16} /> Save Settings</>}
        </button>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Link as LinkIcon, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { homeDb } from '../lib/db'
import { uploadVideo } from '../lib/utils'

export default function HomeSettings() {
  const qc = useQueryClient()
  const [uploadingVideo, setUploadingVideo] = useState(false)
  
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
    links: [],
    login_video_url: ''
  })

  useEffect(() => {
    if (settings) {
      setForm({
        pending_title: settings.pending_title || '',
        pending_desc: settings.pending_desc || '',
        notification_title: settings.notification_title || '',
        notification_desc: settings.notification_desc || '',
        notifications_list: Array.isArray(settings.notifications_list) ? settings.notifications_list : [],
        links: Array.isArray(settings.links) ? settings.links : [],
        login_video_url: settings.login_video_url || 'https://cdn.pixabay.com/video/2021/08/18/85429-590001095_large.mp4'
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

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a valid video file')
      return
    }

    try {
      setUploadingVideo(true)
      const url = await uploadVideo(file)
      const newForm = { ...form, login_video_url: url }
      setForm(newForm)
      
      // Auto-save to DB
      mutation.mutate(newForm)
      toast.success('Video uploaded and saved successfully!')
    } catch (err) {
      toast.error('Failed to upload video: ' + err.message)
    } finally {
      setUploadingVideo(false)
    }
  }

  if (isLoading) return <div className="p-8 text-center text-gray-500 dark:text-white dark:text-white">Loading settings...</div>

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Due Dates Management Section */}
        <div className="glass-card p-6 border-orange-500/20 col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-orange-400 flex items-center gap-2">
              Due Dates & Reminders
            </h3>
            <button onClick={() => setForm(p => ({ ...p, due_dates: [...(p.due_dates || []), { id: Date.now(), title: '', date: '', color: 'blue' }] }))} className="btn-ghost py-1 px-2 text-xs">
              <Plus size={14} /> Add Reminder
            </button>
          </div>
          <div className="space-y-4">
            {(!form.due_dates || form.due_dates.length === 0) ? (
              <div className="text-center py-4 text-slate-500 text-xs border border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
                No due dates configured. Click "Add Reminder"
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {form.due_dates.map((due, idx) => (
                  <div key={due.id || idx} className={`flex flex-col gap-2 p-3 rounded-xl border bg-${due.color}-50 dark:bg-${due.color}-500/10 border-${due.color}-100 dark:border-${due.color}-500/20 relative group`}>
                    <input
                      type="text"
                      value={due.title}
                      onChange={e => {
                        const newDates = [...form.due_dates];
                        newDates[idx].title = e.target.value;
                        setForm(p => ({ ...p, due_dates: newDates }));
                      }}
                      placeholder="e.g. WiFi Bill"
                      className="input-field py-1 px-2 text-sm bg-white/50 dark:bg-[#1e1e2d]/50 font-semibold"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={due.date}
                        onChange={e => {
                          const newDates = [...form.due_dates];
                          newDates[idx].date = e.target.value;
                          setForm(p => ({ ...p, due_dates: newDates }));
                        }}
                        placeholder="e.g. 29th"
                        className="input-field py-1 px-2 text-xs bg-white/50 dark:bg-[#1e1e2d]/50 flex-1 font-bold"
                      />
                      <select
                        value={due.color}
                        onChange={e => {
                          const newDates = [...form.due_dates];
                          newDates[idx].color = e.target.value;
                          setForm(p => ({ ...p, due_dates: newDates }));
                        }}
                        className="select-field py-1 px-2 text-xs bg-white/50 dark:bg-[#1e1e2d]/50 w-24"
                      >
                        <option value="red">Red</option>
                        <option value="orange">Orange</option>
                        <option value="blue">Blue</option>
                        <option value="green">Green</option>
                        <option value="purple">Purple</option>
                        <option value="cyan">Cyan</option>
                      </select>
                    </div>
                    <button
                      onClick={() => {
                        const newDates = [...form.due_dates];
                        newDates.splice(idx, 1);
                        setForm(p => ({ ...p, due_dates: newDates }));
                      }}
                      className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-red-200"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Settings Section */}
      <div className="glass-card p-6 border-slate-500/20">
        <h3 className="text-lg font-bold text-gray-500 dark:text-white dark:text-white mb-4 flex items-center gap-2">
          Global App Settings
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-white dark:text-white uppercase tracking-wider mb-1">Login Page Background Video URL</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={form.login_video_url}
                onChange={e => setForm(p => ({ ...p, login_video_url: e.target.value }))}
                className="input-field border-gray-200 dark:border-gray-800/50 focus:border-slate-400 flex-1"
                placeholder="e.g. https://cdn.pixabay.com/video/.../video.mp4"
              />
              <div className="relative">
                <input 
                  type="file" 
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  disabled={uploadingVideo}
                />
                <button 
                  type="button" 
                  className="w-full sm:w-auto px-4 py-2 bg-gray-50 dark:bg-[#151521] hover:bg-slate-700 text-gray-500 dark:text-white dark:text-white text-sm font-semibold rounded-lg transition-colors border border-gray-200 dark:border-gray-800"
                  disabled={uploadingVideo}
                >
                  {uploadingVideo ? 'Uploading...' : 'Upload Video File'}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Provide a direct link or click "Upload Video File" to host it here (max 50MB typically).</p>
          </div>
        </div>
      </div>

      {/* External Links Section */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <LinkIcon size={18} className="text-orange-400" /> External Portal Links
          </h3>
          <button onClick={addLink} className="btn-ghost py-1.5 px-3 text-xs">
            <Plus size={14} /> Add Link
          </button>
        </div>

        {form.links.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
            No links added yet. Click "Add Link" to create one.
          </div>
        ) : (
          <div className="space-y-3">
            {form.links.map((link, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-[#1e1e2d] p-3 rounded-xl border border-gray-200 dark:border-gray-800/50">
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

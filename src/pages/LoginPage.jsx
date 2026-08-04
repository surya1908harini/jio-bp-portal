import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [loading,    setLoading]    = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isRegister) {
        if (password !== confirmPw) {
          toast.error('Passwords do not match')
          setLoading(false)
          return
        }
        if (password.length < 6) {
          toast.error('Password must be at least 6 characters')
          setLoading(false)
          return
        }
        await signUp(email, password)
        toast.success('Account created! You are now logged in.')
      } else {
        await signIn(email, password)
        toast.success('Welcome back!')
      }
    } catch (err) {
      toast.error(err.message || (isRegister ? 'Registration failed' : 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsRegister(!isRegister)
    setPassword('')
    setConfirmPw('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
      {/* Animated background blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-jio-blue-800/20 blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-jio-red-900/20 blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-jio mx-auto flex items-center justify-center mb-4 shadow-lg glow-blue">
            <span className="text-white font-black text-2xl">J</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Jio-bp Portal</h1>
          <p className="text-slate-400 text-sm">MM Contractor — Supplier First Portal</p>
        </div>

        {/* Form card */}
        <div className="glass-card p-8">
          {/* Login / Register tabs */}
          <div className="flex gap-1 p-1 bg-slate-800 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setPassword(''); setConfirmPw('') }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                !isRegister
                  ? 'bg-jio-blue-700 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setPassword(''); setConfirmPw('') }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                isRegister
                  ? 'bg-jio-blue-700 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          <h2 className="text-lg font-semibold text-white mb-5">
            {isRegister ? 'Create a new account' : 'Sign in to your account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@mmcontractor.com"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="input-field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm password (register only) */}
            {isRegister && (
              <div className="animate-fade-in">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password</label>
                <input
                  id="confirm-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="input-field"
                />
              </div>
            )}

            <button
              id="login-btn"
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isRegister ? (
                <><UserPlus size={18} /> Create Account</>
              ) : (
                <><LogIn size={18} /> Sign In</>
              )}
            </button>
          </form>

          {/* Toggle link */}
          <p className="text-center text-sm text-slate-500 mt-5">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={toggleMode}
              className="text-jio-blue-400 hover:text-jio-blue-300 font-semibold transition-colors"
            >
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          © 2024 MM Contractor · Powered by Jio-bp Supplier First
        </p>
      </div>
    </div>
  )
}

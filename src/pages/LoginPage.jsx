import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { homeDb } from '../lib/db'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [loading,    setLoading]    = useState(false)

  // Fetch Settings for Background Video
  const { data: settings } = useQuery({
    queryKey: ['home-settings'],
    queryFn: () => homeDb.getSettings()
  })
  
  const videoUrl = settings?.login_video_url || 'https://cdn.pixabay.com/video/2021/08/18/85429-590001095_large.mp4'

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
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden  font-sans">
      
      {/* Background Video */}
      <video 
        key={videoUrl}
        src={videoUrl}
        autoPlay 
        loop 
        muted 
        playsInline 
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-60"
      />

      {/* Simple Color Overlay for Trenox Theme */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-orange-600/30 via-black/40 to-black/80" />

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-8 flex flex-col-reverse lg:flex-row items-center justify-between gap-12 lg:gap-24 h-full">
        
        {/* Left Side: Login Card (White) */}
        <div className="w-full max-w-md bg-white dark:bg-[#1e1e2d] rounded-[2rem] p-8 sm:p-12 shadow-2xl border border-gray-100 dark:border-gray-800/50">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
            {isRegister ? 'Create Account' : 'Sign In'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 font-medium">
            Please {isRegister ? 'register' : 'Login'} to continue to your account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="Email Address"
                className="w-full px-4 py-3.5 bg-gray-50 dark:bg-[#151521] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all font-medium"
              />
            </div>

            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Password"
                className="w-full px-4 py-3.5 bg-gray-50 dark:bg-[#151521] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all font-medium pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {isRegister && (
              <div className="relative animate-fade-in">
                <input
                  id="confirm-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  required
                  placeholder="Confirm Password"
                  className="w-full px-4 py-3.5 bg-gray-50 dark:bg-[#151521] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all font-medium"
                />
              </div>
            )}

            {!isRegister && (
              <div className="flex items-center justify-between mt-2 mb-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-[#151521] text-orange-500 focus:ring-orange-500 focus:ring-offset-0 transition-all cursor-pointer" />
                  </div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Remember Me</span>
                </label>
                <a href="#" className="text-sm font-medium text-orange-500 hover:text-orange-600 transition-colors">
                  Forgot password?
                </a>
              </div>
            )}

            <button
              id="login-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold rounded-xl shadow-lg shadow-orange-500/30 transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isRegister ? (
                'Register'
              ) : (
                'Login'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800/50">
            <div className="flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100 dark:border-gray-800/50"></div>
              </div>
              <div className="relative px-4 bg-white dark:bg-[#1e1e2d]">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Or login with</span>
              </div>
            </div>
            
            <div className="flex justify-center gap-4">
              <button className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-[#151521] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-bold text-lg shadow-sm">G</button>
              <button className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-[#151521] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-bold text-lg shadow-sm">M</button>
              <button className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-[#151521] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-bold text-lg shadow-sm">in</button>
            </div>

            <p className="mt-8 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button onClick={toggleMode} className="text-orange-500 hover:text-orange-600 font-bold transition-colors">
                {isRegister ? 'Sign In here' : 'Register now'}
              </button>
            </p>
          </div>
        </div>

        {/* Right Side: Text & Branding */}
        <div className="w-full lg:w-1/2 text-center lg:text-left text-white mb-8 lg:mb-0 flex flex-col items-center lg:items-start">
          <div className="mb-10 bg-white dark:bg-[#1e1e2d]/95 p-6 rounded-3xl shadow-2xl inline-block border border-white/20 backdrop-blur-md">
            <img 
              src="/mm-logo.png" 
              alt="MM Contractor" 
              className="h-20 md:h-24 object-contain"
            />
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight uppercase">
            Welcome to MM Contractor
          </h1>
          <p className="text-lg text-gray-700 dark:text-white font-medium max-w-lg mx-auto lg:mx-0 leading-relaxed">
            Log in now using your details to seamless connectivity in the MM Contractor Portal.
          </p>
        </div>

      </div>
    </div>
  )
}

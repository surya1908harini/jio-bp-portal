import { useNavigate } from 'react-router-dom'
import { ArrowRight, Link as LinkIcon, Bell, ClipboardList, IndianRupee, FileText, PieChart, ExternalLink } from 'lucide-react'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden selection:bg-purple-500/30">
      
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 sm:py-12 flex flex-col min-h-screen">
        
        {/* Header */}
        <header className="flex flex-col items-center justify-center mb-12 animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 p-0.5 shadow-xl shadow-purple-900/20 mb-6">
            <div className="w-full h-full bg-[#0a0a0f] rounded-[14px] flex items-center justify-center">
              <span className="text-3xl font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                MM
              </span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2 text-center">
            MM CONTRACTOR PORTAL
          </h1>
          <p className="text-slate-400 text-sm sm:text-base font-medium tracking-wide">
            Enterprise Management Dashboard
          </p>
        </header>

        {/* Main Content Grid */}
        <main className="flex-1 w-full max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-slide-up">
          
          {/* Top Section (2 Blocks) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group rounded-3xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-8 shadow-2xl hover:border-purple-500/50 hover:bg-slate-900/80 transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[200px] cursor-default">
              <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
                <ClipboardList size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">PENDING WORKS IN TYPE MANUAL</h3>
              <p className="text-slate-400 text-sm">Review and update pending manual assignments</p>
            </div>

            <div className="group rounded-3xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-8 shadow-2xl hover:border-blue-500/50 hover:bg-slate-900/80 transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[200px] cursor-default">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                <Bell size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">NOTIFICATION FOR OFFICE WORK</h3>
              <p className="text-slate-400 text-sm">EX (WIFI DUE DATE 29/MM/YYYY)</p>
            </div>
          </div>

          {/* Middle Section (3 Blocks) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col items-center text-center hover:bg-slate-800/60 transition-colors">
              <PieChart className="text-emerald-400 mb-3" size={20} />
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Current Month GST 1</h4>
              <p className="text-sm font-semibold text-white">TOTAL BY IGST / CGST / SGST</p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col items-center text-center hover:bg-slate-800/60 transition-colors">
              <FileText className="text-amber-400 mb-3" size={20} />
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Current Month JMS</h4>
              <p className="text-sm font-semibold text-white">COUNT AND AMOUNT</p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col items-center text-center hover:bg-slate-800/60 transition-colors">
              <IndianRupee className="text-pink-400 mb-3" size={20} />
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Current Month Invoice</h4>
              <p className="text-sm font-semibold text-white">COUNT AND AMOUNT</p>
            </div>
          </div>

          {/* Bottom Section (Links Block) */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-8 shadow-xl">
            <div className="flex items-center justify-center gap-2 mb-6">
              <LinkIcon className="text-purple-400" size={20} />
              <h3 className="text-lg font-bold text-white uppercase tracking-widest">ADD LINKS WITH NAME</h3>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Placeholders for links to be added later */}
              {[1, 2, 3, 4].map((i) => (
                <a key={i} href="#" className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-purple-500/30 transition-all group">
                  <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-purple-400 group-hover:scale-110 transition-all mb-3">
                    <ExternalLink size={16} />
                  </div>
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Portal Link {i}</span>
                </a>
              ))}
            </div>
          </div>
        </main>

        {/* Action Footer */}
        <footer className="mt-16 flex justify-center pb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <button
            onClick={() => navigate('/login')}
            className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full font-black text-sm tracking-widest uppercase shadow-[0_0_40px_-10px_rgba(147,51,234,0.5)] hover:shadow-[0_0_60px_-15px_rgba(147,51,234,0.7)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-3 overflow-hidden"
          >
            <span className="relative z-10 text-white">ENTER MMC ACCOUNTS PAGE</span>
            <ArrowRight className="relative z-10 text-white group-hover:translate-x-1 transition-transform" size={18} />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </button>
        </footer>

      </div>
    </div>
  )
}

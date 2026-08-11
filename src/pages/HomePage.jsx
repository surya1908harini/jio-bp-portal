import { useNavigate } from 'react-router-dom'
import { ArrowRight, Link as LinkIcon, Bell, ClipboardList, IndianRupee, FileText, PieChart, ExternalLink, ChevronRight } from 'lucide-react'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#030303] text-white overflow-x-hidden selection:bg-orange-500/30 relative font-sans">
      
      {/* ── Background Glowing Effects (Trenox Style) ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center">
        {/* Giant glowing orange/red swoosh line simulation */}
        <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[60%] rounded-[100%] border-[3px] border-orange-500/20 blur-[2px] transform -rotate-12" />
        <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[60%] rounded-[100%] border-[1px] border-orange-400/40 blur-[1px] transform -rotate-12 shadow-[0_0_80px_10px_rgba(249,115,22,0.3)]" />
        
        {/* Core glowing orbs */}
        <div className="absolute top-0 right-1/4 w-[40rem] h-[40rem] bg-orange-600/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-0 left-1/4 w-[40rem] h-[40rem] bg-red-600/10 rounded-full blur-[120px] mix-blend-screen" />
      </div>

      {/* ── Top Navbar ── */}
      <nav className="relative z-20 w-full max-w-5xl mx-auto mt-6 px-4">
        <div className="flex items-center justify-between bg-white/5 border border-white/10 backdrop-blur-md rounded-full px-6 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center font-black text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]">
              MM
            </div>
            <span className="font-bold tracking-widest text-sm">CONTRACTOR</span>
          </div>
          
          <button
            onClick={() => navigate('/login')}
            className="px-5 py-2 bg-white text-black text-sm font-bold rounded-full hover:bg-slate-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.3)]"
          >
            Login
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-16 sm:py-24 flex flex-col min-h-[calc(100vh-100px)]">
        
        {/* ── Hero Header ── */}
        <header className="flex flex-col items-center justify-center mb-20 animate-fade-in text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm cursor-default hover:bg-white/10 transition-colors">
            <span className="text-xs text-slate-300">Introducing MM Portal</span>
            <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
              <ArrowRight size={12} className="text-orange-400" />
            </div>
          </div>
          
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
            Manage Your <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-orange-400 via-red-500 to-pink-500 bg-clip-text text-transparent">
              Enterprise Work
            </span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl font-medium tracking-wide leading-relaxed">
            Customize your business journey effortlessly with our dashboard, backed by a suite of powerful tools at your fingertips.
          </p>
        </header>

        {/* ── Main Content Grid ── */}
        <main className="flex-1 w-full space-y-8 animate-slide-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
          
          {/* Top Section (2 Blocks) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group relative rounded-3xl border border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl p-8 hover:border-orange-500/40 transition-all duration-500 flex flex-col items-start justify-center min-h-[220px] cursor-default overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10 w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-6 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_20px_rgba(249,115,22,0.15)]">
                <ClipboardList size={26} />
              </div>
              <h3 className="relative z-10 text-xl font-bold text-white mb-3 tracking-wide">PENDING WORKS IN TYPE MANUAL</h3>
              <p className="relative z-10 text-slate-400 text-sm leading-relaxed">Review and update pending manual assignments effortlessly through the integrated task flow.</p>
            </div>

            <div className="group relative rounded-3xl border border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl p-8 hover:border-orange-500/40 transition-all duration-500 flex flex-col items-start justify-center min-h-[220px] cursor-default overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10 w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-6 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
                <Bell size={26} />
              </div>
              <h3 className="relative z-10 text-xl font-bold text-white mb-3 tracking-wide">NOTIFICATION FOR OFFICE WORK</h3>
              <p className="relative z-10 text-slate-400 text-sm leading-relaxed">Stay updated with critical alerts. <br/>EX: <span className="text-orange-400 font-semibold">WIFI DUE DATE 29/MM/YYYY</span></p>
            </div>
          </div>

          {/* Middle Section (3 Blocks) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="group relative rounded-3xl border border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl p-6 flex flex-col hover:border-orange-500/30 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-[40px] rounded-full group-hover:bg-orange-500/20 transition-colors duration-500" />
              <div className="relative z-10 flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-orange-400 border border-white/5">
                  <PieChart size={18} />
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">GST TOTALS</span>
              </div>
              <h4 className="relative z-10 text-sm font-bold text-white mb-1">Current Month GST 1</h4>
              <p className="relative z-10 text-xs text-slate-400 font-medium tracking-wide">TOTAL BY IGST / CGST / SGST</p>
            </div>

            <div className="group relative rounded-3xl border border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl p-6 flex flex-col hover:border-orange-500/30 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[40px] rounded-full group-hover:bg-red-500/20 transition-colors duration-500" />
              <div className="relative z-10 flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-red-400 border border-white/5">
                  <FileText size={18} />
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">JMS RECORDS</span>
              </div>
              <h4 className="relative z-10 text-sm font-bold text-white mb-1">Current Month JMS</h4>
              <p className="relative z-10 text-xs text-slate-400 font-medium tracking-wide">COUNT AND AMOUNT</p>
            </div>

            <div className="group relative rounded-3xl border border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl p-6 flex flex-col hover:border-orange-500/30 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[40px] rounded-full group-hover:bg-amber-500/20 transition-colors duration-500" />
              <div className="relative z-10 flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-amber-400 border border-white/5">
                  <IndianRupee size={18} />
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">INVOICES</span>
              </div>
              <h4 className="relative z-10 text-sm font-bold text-white mb-1">Current Month Invoice</h4>
              <p className="relative z-10 text-xs text-slate-400 font-medium tracking-wide">COUNT AND AMOUNT</p>
            </div>
          </div>

          {/* Bottom Section (Links Block) */}
          <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-[#0a0a0f]/80 backdrop-blur-2xl p-8 shadow-2xl overflow-hidden mt-12">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[1px] bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
            
            <div className="flex flex-col items-center justify-center text-center mb-8">
              <h3 className="text-2xl font-bold text-white tracking-tight mb-2">Discover The Perfect Fit</h3>
              <p className="text-slate-400 text-sm">Add Links With Name Below</p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <a key={i} href="#" className="flex flex-col items-center justify-center p-5 rounded-2xl bg-black/40 border border-white/5 hover:bg-white/5 hover:border-orange-500/30 transition-all group relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-orange-400 group-hover:scale-110 group-hover:bg-orange-500/10 transition-all duration-300 mb-4 border border-white/5">
                    <ExternalLink size={18} />
                  </div>
                  <span className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">Portal Link {i}</span>
                </a>
              ))}
            </div>
          </div>
        </main>

        {/* Action Footer */}
        <footer className="mt-16 flex flex-col sm:flex-row justify-center items-center gap-4 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
          
          <button
            onClick={() => navigate('/login')}
            className="group relative px-8 py-4 bg-gradient-to-r from-orange-500 to-red-600 rounded-lg font-bold text-sm tracking-wide text-white shadow-[0_0_30px_-5px_rgba(249,115,22,0.6)] hover:shadow-[0_0_50px_-5px_rgba(249,115,22,0.8)] hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 overflow-hidden"
          >
            <span className="relative z-10">ENTER MMC ACCOUNTS PAGE</span>
            <ChevronRight className="relative z-10 group-hover:translate-x-1 transition-transform" size={18} />
            <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </button>
          
          <button
            className="px-8 py-4 rounded-lg font-bold text-sm tracking-wide text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            Learn More
          </button>
          
        </footer>

      </div>
    </div>
  )
}

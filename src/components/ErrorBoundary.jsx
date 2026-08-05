import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Portal Rendering Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-jio-red-950/80 border border-jio-red-700/60 flex items-center justify-center text-jio-red-400 mb-4 shadow-lg animate-bounce">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong loading this view</h2>
          <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
            {this.state.error?.message || 'An unexpected rendering error occurred. Click below to reload.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw size={15} /> Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

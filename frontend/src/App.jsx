import { useState, useEffect } from 'react'
import { Shield, Activity, Database, CheckCircle2, Server, Cpu, AlertTriangle } from 'lucide-react'

export default function App() {
  const [backendStatus, setBackendStatus] = useState({ status: 'checking', message: 'Checking backend...' })

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setBackendStatus({ status: 'connected', message: data.message || 'Backend Connected' })
      })
      .catch(err => {
        // Also try direct localhost:8000
        fetch('http://127.0.0.1:8000/health')
          .then(res => res.json())
          .then(data => {
            setBackendStatus({ status: 'connected', message: data.message || 'Backend Connected (Direct)' })
          })
          .catch(() => {
            setBackendStatus({ status: 'disconnected', message: 'Backend offline or not running' })
          })
      })
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-white flex items-center gap-2">
              CHAIN<span className="text-indigo-400">SENTINEL</span>
              <span className="text-xs font-mono uppercase bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700/50">
                MVP v0.1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Blockchain Transaction Investigation Platform</p>
          </div>
        </div>

        {/* Backend status indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-800 bg-slate-900 text-xs">
          <span className={`w-2 h-2 rounded-full ${backendStatus.status === 'connected' ? 'bg-emerald-400 animate-pulse' : backendStatus.status === 'checking' ? 'bg-amber-400' : 'bg-rose-500'}`} />
          <span className="text-slate-300 font-mono">{backendStatus.message}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-8">
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6 md:p-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-4">
            <Activity className="w-3.5 h-3.5" />
            Phase 1 & 2 Completed: Infrastructure & Synthetic Dataset
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
            Forensic Blockchain Transaction Analysis
          </h2>
          <p className="text-slate-400 max-w-2xl text-sm leading-relaxed">
            ChainSentinel detects complex transaction topologies, clusters suspicious multi-hop flows, and cryptographically verifies evidence using SHA-256 and Merkle Trees.
          </p>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-mono uppercase tracking-wider">Frontend Engine</span>
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white flex items-center gap-2">
              React + Vite
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-400">
              Tailwind CSS, Cytoscape graph renderer ready, Lucide iconography.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-mono uppercase tracking-wider">Backend Engine</span>
              <Server className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white flex items-center gap-2">
              FastAPI + Python
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-400">
              Pandas analytics, NetworkX graph modeling, SHA-256 Merkle verifier.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-mono uppercase tracking-wider">Simulated Ledger</span>
              <Database className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white flex items-center gap-2">
              Synthetic Dataset
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-400">
              Pre-seeded with Circular, Burst, Rapid Hop, Split, Recomb, and Cluster flows.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500 font-mono">
        ChainSentinel MVP &bull; Ready for Phase 3 Detection Engine
      </footer>
    </div>
  )
}

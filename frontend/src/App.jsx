import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Activity,
  AlertTriangle,
  FolderLock,
  Wallet,
  RefreshCw,
  Plus
} from 'lucide-react';
import {
  getHealth,
  getDatasetInfo,
  getDetectionSummary,
  getAlerts,
  getInvestigations,
  createInvestigation
} from './api';

import DashboardView from './components/DashboardView';
import AlertsView from './components/AlertsView';
import WalletInvestigationView from './components/WalletInvestigationView';
import InvestigationsView from './components/InvestigationsView';
import AlertDetailModal from './components/AlertDetailModal';
import CreateCaseModal from './components/CreateCaseModal';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'alerts' | 'investigate' | 'cases'

  // Backend Health
  const [backendHealth, setBackendHealth] = useState({
    status: 'checking',
    message: 'Connecting to ChainSentinel API...'
  });

  // Global Core Data
  const [summary, setSummary] = useState(null);
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [investigationsCount, setInvestigationsCount] = useState(0);

  // Cross-View Focus State
  const [investigationTargetWallet, setInvestigationTargetWallet] = useState('0x71C8366420A85E1A0F9b123D377De304559B0975');
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [activePatternFilter, setActivePatternFilter] = useState('ALL');

  // Modals State
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);
  const [createCaseDefaults, setCreateCaseDefaults] = useState({
    targetWallet: '',
    alertId: '',
    relatedWallets: []
  });

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initial Data Fetch
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const health = await getHealth();
      setBackendHealth({ status: 'connected', message: health.message || 'Engine Operational' });

      const [sumRes, infoRes, alertsRes, casesRes] = await Promise.all([
        getDetectionSummary(),
        getDatasetInfo().catch(() => null),
        getAlerts({ limit: 100 }),
        getInvestigations().catch(() => ({ investigations: [] })),
      ]);

      setSummary(sumRes);
      setDatasetInfo(infoRes);
      setAlerts(alertsRes.alerts || []);
      setInvestigationsCount(casesRes.investigations?.length || 0);
    } catch (err) {
      console.error('API initialization error:', err);
      setBackendHealth({ status: 'disconnected', message: 'Backend Offline' });
      setError('Cannot connect to ChainSentinel backend at http://127.0.0.1:8000. Ensure the FastAPI service is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Navigate to Wallet Deep Dive
  const handleInvestigateWallet = (walletAddress) => {
    if (walletAddress) {
      setInvestigationTargetWallet(walletAddress);
      setActiveTab('investigate');
    }
  };

  // Navigate to Alerts with Pattern Filter
  const handleNavigateToAlerts = (tab, params = {}) => {
    if (params.pattern) {
      setActivePatternFilter(params.pattern);
    } else {
      setActivePatternFilter('ALL');
    }
    setActiveTab(tab);
  };

  // Open Create Case Modal
  const handleOpenCreateCaseModal = (targetWallet = '', context = {}) => {
    setCreateCaseDefaults({
      targetWallet: targetWallet || investigationTargetWallet,
      alertId: context.alert_id || '',
      relatedWallets: context.related_wallets || context.wallets?.slice(1) || []
    });
    setIsCreateCaseOpen(true);
  };

  // Handle Case Created
  const handleCaseCreated = async (payload) => {
    const created = await createInvestigation(payload);
    setActiveCaseId(created.case_id);
    setInvestigationsCount(prev => prev + 1);
    setActiveTab('cases');
    return created;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Cybersecurity Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 border border-indigo-500/30 rounded-xl text-indigo-400 shadow-inner">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-white flex items-center gap-2">
              CHAIN<span className="text-indigo-400">SENTINEL</span>
              <span className="text-[10px] font-mono uppercase bg-indigo-950/80 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700/60 font-bold">
                Platform Phase 4
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Blockchain Forensic Intelligence & Investigation Cockpit</p>
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5 font-medium ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Dashboard
          </button>

          <button
            type="button"
            onClick={() => {
              setActivePatternFilter('ALL');
              setActiveTab('alerts');
            }}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5 font-medium ${
              activeTab === 'alerts'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Alerts ({alerts.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('investigate')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5 font-medium ${
              activeTab === 'investigate'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" /> Wallet Deep Dive
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cases')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5 font-medium ${
              activeTab === 'cases'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <FolderLock className="w-3.5 h-3.5" /> Cases ({investigationsCount})
          </button>
        </nav>

        {/* Right Status & Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-800 bg-slate-950 text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                backendHealth.status === 'connected'
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse'
                  : backendHealth.status === 'checking'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-300 text-[11px]">{backendHealth.message}</span>
          </div>

          <button
            type="button"
            onClick={() => handleOpenCreateCaseModal()}
            className="hidden lg:flex px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-xl text-xs font-mono font-medium items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Open Case
          </button>

          <button
            type="button"
            onClick={loadInitialData}
            title="Refresh API Data"
            disabled={loading}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-900 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Error Notification Bar */}
      {error && (
        <div className="bg-rose-950/70 border-b border-rose-800 px-6 py-2.5 flex items-center justify-between text-xs text-rose-200 font-mono">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadInitialData}
            className="underline hover:text-white font-medium ml-4 shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-6">
        {/* Full Loading Skeleton */}
        {loading && !summary ? (
          <div className="py-28 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm font-mono text-slate-400">
              Synchronizing with ChainSentinel detection models & synthetic ledger...
            </p>
          </div>
        ) : (
          <>
            {/* VIEW 1: DASHBOARD (Phase 4C) */}
            {activeTab === 'dashboard' && (
              <DashboardView
                summary={summary}
                datasetInfo={datasetInfo}
                alerts={alerts}
                onSelectAlert={(al) => setSelectedAlert(al)}
                onInvestigateWallet={handleInvestigateWallet}
                onNavigateTab={handleNavigateToAlerts}
                onRefresh={loadInitialData}
                loading={loading}
              />
            )}

            {/* VIEW 2: ALERTS EXPLORER (Phase 4C) */}
            {activeTab === 'alerts' && (
              <AlertsView
                alerts={alerts}
                initialPatternFilter={activePatternFilter}
                onSelectAlert={(al) => setSelectedAlert(al)}
                onInvestigateWallet={handleInvestigateWallet}
              />
            )}

            {/* VIEW 3: WALLET INVESTIGATION DEEP DIVE (Phase 4D) */}
            {activeTab === 'investigate' && (
              <WalletInvestigationView
                initialWallet={investigationTargetWallet}
                onCreateCaseForWallet={(wallet, riskProfile) => {
                  handleOpenCreateCaseModal(wallet, {
                    wallets: [wallet],
                    alert_id: riskProfile?.alerts?.[0]?.alert_id || ''
                  });
                }}
              />
            )}

            {/* VIEW 4: INVESTIGATION CASES & DOSSIERS (Phase 4D) */}
            {activeTab === 'cases' && (
              <InvestigationsView
                initialCaseId={activeCaseId}
                onOpenCreateCaseModal={() => handleOpenCreateCaseModal()}
                onInvestigateWallet={handleInvestigateWallet}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <AlertDetailModal
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onInvestigateWallet={handleInvestigateWallet}
        onViewGraph={(wallet) => {
          setInvestigationTargetWallet(wallet);
          setActiveTab('investigate');
        }}
        onCreateCaseFromAlert={(al) => {
          handleOpenCreateCaseModal(al.wallets?.[0] || '', {
            alert_id: al.alert_id,
            related_wallets: al.wallets?.slice(1) || []
          });
        }}
      />

      <CreateCaseModal
        isOpen={isCreateCaseOpen}
        onClose={() => setIsCreateCaseOpen(false)}
        initialTargetWallet={createCaseDefaults.targetWallet}
        initialAlertId={createCaseDefaults.alertId}
        initialRelatedWallets={createCaseDefaults.relatedWallets}
        onCaseCreated={handleCaseCreated}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500 font-mono">
        ChainSentinel &bull; Blockchain Forensic Investigation Platform &bull; Phase 4 Complete
      </footer>
    </div>
  );
}

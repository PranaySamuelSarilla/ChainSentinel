import { useState, useEffect, useCallback } from 'react';
import {
  FolderLock,
  Plus,
  RefreshCw,
  AlertTriangle,
  Lock,
  Unlock,
  Save,
  Check,
  Network,
  ShieldCheck,
  FilePlus2,
  ExternalLink,
  Compass
} from 'lucide-react';
import {
  getInvestigations,
  getInvestigationSummary,
  updateInvestigationStatus,
  updateInvestigationNotes,
  getInvestigationGraph,
  getCaseEvidence,
  getCaseMerkleRoot
} from '../api';
import GraphViewer from './GraphViewer';
import AddEvidenceModal from './AddEvidenceModal';
import EvidenceIntegrityPanel from './EvidenceIntegrityPanel';
import CaseTimeline from './CaseTimeline';

export default function InvestigationsView({
  onOpenCreateCaseModal,
  onInvestigateWallet,
  onTraceFlow,
  initialCaseId = null
}) {
  const [cases, setCases] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedCaseId, setSelectedCaseId] = useState(initialCaseId);
  const [caseSummary, setCaseSummary] = useState(null);
  const [caseGraphData, setCaseGraphData] = useState(null);
  const [showCaseGraph, setShowCaseGraph] = useState(false);

  // Evidence and Merkle states
  const [caseEvidence, setCaseEvidence] = useState([]);
  const [caseMerkleData, setCaseMerkleData] = useState(null);
  const [showAddEvidenceModal, setShowAddEvidenceModal] = useState(false);
  const [evidenceModalType, setEvidenceModalType] = useState('TRANSACTION');
  const [evidenceModalRef, setEvidenceModalRef] = useState('');
  const [evidenceModalContent, setEvidenceModalContent] = useState({});

  // Notes state
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSavedNotice, setNotesSavedNotice] = useState(false);

  // Timeline trigger counter
  const [timelineKey, setTimelineKey] = useState(0);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState(null);

  // Load cases list
  const fetchCases = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await getInvestigations(statusFilter === 'ALL' ? null : statusFilter);
      const items = res.investigations || [];
      setCases(items);
      if (items.length > 0 && !selectedCaseId) {
        setSelectedCaseId(items[0].case_id);
      }
    } catch (err) {
      console.error('Failed to load cases:', err);
      setError(`Failed to retrieve investigation cases: ${err.message}`);
    } finally {
      setLoadingList(false);
    }
  }, [statusFilter, selectedCaseId]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Load evidence and Merkle data
  const fetchEvidenceData = useCallback(async (caseId) => {
    if (!caseId) return;
    try {
      const [evRes, merkleRes] = await Promise.all([
        getCaseEvidence(caseId).catch(() => ({ evidence: [] })),
        getCaseMerkleRoot(caseId).catch(() => null),
      ]);
      setCaseEvidence(evRes.evidence || []);
      setCaseMerkleData(merkleRes);
    } catch (err) {
      console.error('Failed to load evidence records:', err);
    }
  }, []);

  // Load selected case summary
  const fetchSummary = useCallback(async (caseId) => {
    if (!caseId) return;
    setLoadingSummary(true);
    setError(null);
    setShowCaseGraph(false);
    setCaseGraphData(null);
    try {
      const [data] = await Promise.all([
        getInvestigationSummary(caseId),
        fetchEvidenceData(caseId),
      ]);
      setCaseSummary(data);
      setNotesDraft(data.case?.notes || '');
    } catch (err) {
      console.error('Failed to load case summary:', err);
      setError(`Failed to load case summary for ${caseId}: ${err.message}`);
    } finally {
      setLoadingSummary(false);
    }
  }, [fetchEvidenceData]);

  useEffect(() => {
    if (selectedCaseId) {
      fetchSummary(selectedCaseId);
    }
  }, [selectedCaseId, fetchSummary]);

  // Trigger timeline reload
  const triggerTimelineRefresh = () => {
    setTimelineKey((k) => k + 1);
  };

  // Handle Case Status Toggle
  const handleToggleStatus = async () => {
    if (!caseSummary?.case) return;
    const currentStatus = caseSummary.case.status;
    const newStatus = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    setUpdatingStatus(true);
    try {
      await updateInvestigationStatus(caseSummary.case.case_id, newStatus);
      await fetchSummary(caseSummary.case.case_id);
      await fetchCases();
      triggerTimelineRefresh();
    } catch (err) {
      console.error('Status update failed:', err);
      setError(`Failed to update case status: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Notes Save
  const handleSaveNotes = async () => {
    if (!caseSummary?.case) return;
    setSavingNotes(true);
    try {
      await updateInvestigationNotes(caseSummary.case.case_id, notesDraft);
      setNotesSavedNotice(true);
      setTimeout(() => setNotesSavedNotice(false), 2500);
      await fetchSummary(caseSummary.case.case_id);
      triggerTimelineRefresh();
    } catch (err) {
      console.error('Notes save failed:', err);
      setError(`Failed to save analyst notes: ${err.message}`);
    } finally {
      setSavingNotes(false);
    }
  };

  // Handle Case Graph Load
  const handleLoadCaseGraph = async () => {
    if (!caseSummary?.case) return;
    if (caseGraphData) {
      setShowCaseGraph(!showCaseGraph);
      return;
    }
    setLoadingSummary(true);
    try {
      const graphRes = await getInvestigationGraph(caseSummary.case.case_id, 2);
      setCaseGraphData(graphRes);
      setShowCaseGraph(true);
    } catch (err) {
      console.error('Case graph load failed:', err);
      setError(`Failed to load case graph: ${err.message}`);
    } finally {
      setLoadingSummary(false);
    }
  };

  // Quick Action: Anchor an Alert as Evidence
  const handleAnchorAlert = (alert) => {
    setEvidenceModalType('ALERT');
    setEvidenceModalRef(alert.alert_id);
    setEvidenceModalContent({
      alert_id: alert.alert_id,
      pattern: alert.pattern,
      severity: alert.severity,
      total_amount: alert.total_amount,
      explanation: alert.explanation,
      implicated_wallets: alert.wallets,
      transaction_ids: alert.transaction_ids,
    });
    setShowAddEvidenceModal(true);
  };

  // Quick Action: Anchor a Transfer as Evidence
  const handleAnchorTransaction = (tx) => {
    setEvidenceModalType('TRANSACTION');
    setEvidenceModalRef(tx.tx_id);
    setEvidenceModalContent({
      tx_id: tx.tx_id,
      from_wallet: tx.from_wallet,
      to_wallet: tx.to_wallet,
      amount: tx.amount,
      timestamp: tx.timestamp,
      category_label: tx.category_label,
      description: tx.description,
    });
    setShowAddEvidenceModal(true);
  };

  // Quick Action: Anchor Risk Profile as Evidence
  const handleAnchorRisk = () => {
    if (!caseSummary?.target_wallet_risk || !caseSummary?.case) return;
    const r = caseSummary.target_wallet_risk;
    setEvidenceModalType('WALLET_RISK');
    setEvidenceModalRef(caseSummary.case.target_wallet);
    setEvidenceModalContent({
      target_wallet: caseSummary.case.target_wallet,
      risk_score: r.risk_score,
      risk_level: r.risk_level,
      pattern_types: r.pattern_types,
      explanation: r.explanation,
    });
    setShowAddEvidenceModal(true);
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-purple-950/80 text-purple-300 border-purple-700/60';
      case 'HIGH':
        return 'bg-rose-950/80 text-rose-300 border-rose-700/60';
      case 'MEDIUM':
        return 'bg-amber-950/80 text-amber-300 border-amber-700/60';
      case 'LOW':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4.5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FolderLock className="w-5 h-5 text-indigo-400" /> Case Management &amp; Forensic Dossiers
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Full end-to-end investigation workspace: alert triage, wallet telemetry, tamper-evident Merkle records, and chronological audit trails.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            {['ALL', 'OPEN', 'CLOSED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenCreateCaseModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-mono font-medium shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" /> New Case
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={fetchCases} className="underline hover:text-white ml-3">
            Retry
          </button>
        </div>
      )}

      {/* Main Split: Cases List & Selected Case Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Cases List */}
        <div className="space-y-3 lg:col-span-1">
          <div className="text-xs font-mono text-slate-400 flex items-center justify-between px-1">
            <span>Registered Cases ({cases.length})</span>
            {loadingList && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />}
          </div>

          {cases.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 font-mono text-xs space-y-2">
              <FolderLock className="w-6 h-6 mx-auto text-slate-600 mb-1" />
              <p className="text-white font-bold">No investigation cases found.</p>
              <p>Click "New Case" above to open your first investigation.</p>
            </div>
          ) : (
            cases.map((c) => (
              <div
                key={c.case_id}
                onClick={() => setSelectedCaseId(c.case_id)}
                className={`border rounded-xl p-4 cursor-pointer transition-all ${
                  selectedCaseId === c.case_id
                    ? 'bg-slate-900 border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                  <span className="text-indigo-400 font-bold">{c.case_id}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      c.status === 'OPEN'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white mb-1 leading-snug">{c.title}</h4>
                <p className="text-[11px] font-mono text-slate-400 truncate">
                  Target: {c.target_wallet}
                </p>
                <div className="text-[10px] font-mono text-slate-500 mt-2 flex items-center justify-between">
                  <span>{c.alert_ids?.length || 0} linked alerts</span>
                  <span>{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Case Summary Dossier */}
        <div className="lg:col-span-2">
          {loadingSummary ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-24 text-center text-slate-400 font-mono text-xs flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <span>Compiling case dossier &amp; cryptographic audit trail...</span>
            </div>
          ) : caseSummary ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
              {/* Dossier Header */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      {caseSummary.case?.case_id}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        caseSummary.case?.status === 'OPEN'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {caseSummary.case?.status}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Opened: {new Date(caseSummary.case?.created_at).toLocaleString()}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white">{caseSummary.case?.title}</h3>

                  <div className="flex items-center gap-2 pt-1 font-mono text-xs">
                    <span className="text-slate-500">Target Address:</span>
                    <span className="text-slate-300 font-bold">{caseSummary.case?.target_wallet}</span>
                    <button
                      type="button"
                      onClick={() => onInvestigateWallet(caseSummary.case?.target_wallet)}
                      className="text-cyan-400 hover:text-cyan-300 text-[11px] underline ml-1 flex items-center gap-0.5"
                    >
                      Deep Dive <ExternalLink className="w-3 h-3 inline" />
                    </button>
                  </div>
                </div>

                {/* Status Toggle & Graph Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {onTraceFlow && caseSummary.case?.target_wallet && (
                    <button
                      type="button"
                      onClick={() => onTraceFlow(caseSummary.case.target_wallet, caseSummary.case.related_wallets?.[0] || '')}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white rounded-xl text-xs font-mono font-medium transition-colors flex items-center gap-1.5"
                      title="Trace fund flows from this case's target wallet"
                    >
                      <Compass className="w-3.5 h-3.5 text-sky-400" />
                      Trace Flow
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleLoadCaseGraph}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-mono font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Network className="w-3.5 h-3.5 text-cyan-400" />
                    {showCaseGraph ? 'Hide Graph' : 'Case Graph'}
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleStatus}
                    disabled={updatingStatus}
                    className={`px-3.5 py-2 rounded-xl text-xs font-mono font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                      caseSummary.case?.status === 'OPEN'
                        ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80'
                        : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80'
                    }`}
                  >
                    {caseSummary.case?.status === 'OPEN' ? (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Close Case
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5" /> Reopen Case
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Investigation Workflow Lifecycle Stepper */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 font-mono text-[11px]">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                  Workflow Lifecycle State
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { label: '1. Opened', done: true },
                    { label: '2. Alerts Linked', done: (caseSummary.resolved_alerts?.length || 0) > 0 },
                    { label: '3. Evidence Anchored', done: caseEvidence.length > 0 },
                    { label: '4. Merkle Audited', done: caseEvidence.length > 0 },
                    { label: '5. Case Closed', done: caseSummary.case?.status === 'CLOSED' },
                  ].map((step) => (
                    <div
                      key={step.label}
                      className={`p-2 rounded-lg border text-center transition-colors ${
                        step.done
                          ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
                          : 'bg-slate-900/40 border-slate-800 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {step.done ? <Check className="w-3 h-3 text-emerald-400" /> : <div className="w-3 h-3 rounded-full border border-slate-600" />}
                        <span className="font-bold">{step.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Collapsible Case Graph Canvas */}
              {showCaseGraph && caseGraphData && (
                <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-slate-800 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
                    <span>
                      Case Topology Subgraph (Depth 2) &bull; Nodes: {caseGraphData.nodes?.length} &bull; Edges:{' '}
                      {caseGraphData.edges?.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCaseGraph(false)}
                      className="text-[11px] text-slate-500 hover:text-white"
                    >
                      Close Graph ✕
                    </button>
                  </div>
                  <GraphViewer graphData={caseGraphData} height="360px" />
                </div>
              )}

              {/* Target Wallet Risk Profile Card */}
              {caseSummary.target_wallet_risk && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">
                      Target Risk Assessment (from Detection Engine)
                    </span>
                    <button
                      type="button"
                      onClick={handleAnchorRisk}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded text-[10px] font-mono flex items-center gap-1 transition-colors"
                    >
                      <ShieldCheck className="w-3 h-3" /> Anchor Risk as Evidence
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold font-mono text-white">
                        {caseSummary.target_wallet_risk.risk_score}
                        <span className="text-xs text-slate-500 font-normal"> / 100</span>
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${getSeverityBadge(
                          caseSummary.target_wallet_risk.risk_level
                        )}`}
                      >
                        {caseSummary.target_wallet_risk.risk_level} LEVEL
                      </span>
                    </div>

                    <div className="text-right text-xs font-mono text-slate-400">
                      Implicated Topologies: {caseSummary.target_wallet_risk.pattern_types?.join(', ') || 'None'}
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans pt-1">
                    {caseSummary.target_wallet_risk.explanation}
                  </p>
                </div>
              )}

              {/* Evidence Integrity & Merkle Panel (Phase 5 & 6) */}
              <EvidenceIntegrityPanel
                caseId={caseSummary.case?.case_id}
                evidenceList={caseEvidence}
                merkleData={caseMerkleData}
                onRefreshEvidence={() => {
                  fetchEvidenceData(caseSummary.case?.case_id);
                  triggerTimelineRefresh();
                }}
                onOpenAddEvidenceModal={() => {
                  setEvidenceModalType('CUSTOM');
                  setEvidenceModalRef(caseSummary.case?.target_wallet || '');
                  setEvidenceModalContent({ note: 'Investigative artifact' });
                  setShowAddEvidenceModal(true);
                }}
              />

              {/* Case Chronology Timeline (Phase 6) */}
              <CaseTimeline
                key={timelineKey}
                caseId={caseSummary.case?.case_id}
              />

              {/* Analyst Notes Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                    Analyst Case Notes
                  </span>
                  {notesSavedNotice && (
                    <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 animate-in fade-in">
                      <Check className="w-3.5 h-3.5" /> Notes Saved Successfully
                    </span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Record investigative findings, entity attribution, or law enforcement referrals..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-sans resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" /> {savingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>

              {/* Linked Alerts List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                    Resolved Detection Alerts ({caseSummary.resolved_alerts?.length || 0})
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Auto-resolved from engine</span>
                </div>

                {caseSummary.resolved_alerts?.length === 0 ? (
                  <p className="text-xs font-mono text-slate-500 p-3 bg-slate-950 rounded-xl border border-slate-800">
                    No specific alert IDs linked to this case yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {caseSummary.resolved_alerts.map((al) => (
                      <div
                        key={al.alert_id}
                        className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-xs space-y-1 font-mono"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-indigo-300 font-bold">{al.pattern}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.2 rounded border font-bold ${getSeverityBadge(al.severity)}`}>
                              {al.severity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAnchorAlert(al)}
                              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded text-[10px] flex items-center gap-1 transition-colors"
                            >
                              <FilePlus2 className="w-3 h-3" /> Anchor Evidence
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-300 text-[11px] font-sans leading-relaxed">{al.explanation}</p>
                        <div className="text-[10px] text-slate-500 pt-0.5">
                          Alert ID: #{al.alert_id} &bull; Volume: {al.total_amount?.toFixed(2)} ETH
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Associated Target Transactions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                    Associated Ledger Transfers ({caseSummary.wallet_transactions?.length || 0})
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 font-mono text-[11px] pr-1">
                  {caseSummary.wallet_transactions?.map((tx) => (
                    <div
                      key={tx.tx_id}
                      className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/60 flex items-center justify-between"
                    >
                      <div className="truncate mr-4">
                        <span className="text-slate-500">#{tx.tx_id.slice(0, 10)}...</span>{' '}
                        <span className="text-slate-300">{tx.description || tx.category_label}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-indigo-300 font-bold">{tx.amount?.toFixed(2)} ETH</span>
                        <button
                          type="button"
                          onClick={() => handleAnchorTransaction(tx)}
                          title="Anchor this transfer as evidence"
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded text-[10px] flex items-center gap-1 transition-colors"
                        >
                          <FilePlus2 className="w-3 h-3" /> Anchor
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-24 text-center text-slate-500 font-mono text-xs">
              Select an investigation case on the left to inspect its complete forensic dossier.
            </div>
          )}
        </div>
      </div>

      {/* Anchor Evidence Modal */}
      <AddEvidenceModal
        isOpen={showAddEvidenceModal}
        onClose={() => setShowAddEvidenceModal(false)}
        caseId={caseSummary?.case?.case_id}
        initialEvidenceType={evidenceModalType}
        initialSourceRef={evidenceModalRef}
        initialContent={evidenceModalContent}
        onEvidenceAdded={() => {
          if (caseSummary?.case?.case_id) {
            fetchEvidenceData(caseSummary.case.case_id);
            triggerTimelineRefresh();
          }
        }}
      />
    </div>
  );
}

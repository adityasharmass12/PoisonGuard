import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UploadCloud, FileText, FileSpreadsheet, CheckCircle,
  AlertCircle, AlertTriangle, ShieldCheck, ChevronDown,
  ChevronUp, RotateCcw, Shield, Eye, Lock, Database,
  Link2, Globe
} from 'lucide-react';
import { runAllChecks, getCacheStats, ChecklistResult } from '../components/URLChecklist';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Anomaly {
  row: number;
  reason: string;
  severity: 'high' | 'medium' | 'low';
}

interface AnalysisResult {
  totalRows: number;
  cleanRows: number;
  suspiciousRows: number;
  anomalies: Anomaly[];
  summary: string;
  score: number;
  preCheckStats?: PreCheckStats;
  detectionMethod?: string;
  modelAvailable?: boolean;
}

interface PreCheckStats {
  total: number;
  safe: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
  withPaywall: number;
  withRedirect: number;
  withShortener: number;
  withFirewallBypass: number;
  fromCache: number;
}

type UploadState = 'idle' | 'reading' | 'prechecking' | 'analyzing' | 'done' | 'error';

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };

  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = splitLine(line);
    return headers.reduce((o, h, i) => ({ ...o, [h]: vals[i] ?? '' }), {} as Record<string, string>);
  });
  return { headers, rows };
}

// ─── Pre-check runner (no animation, quick scan for batch) ──────────────────

async function runPreChecks(urls: string[]): Promise<PreCheckStats> {
  const stats: PreCheckStats = { total: urls.length, safe: 0, low: 0, medium: 0, high: 0, critical: 0, withPaywall: 0, withRedirect: 0, withShortener: 0, withFirewallBypass: 0, fromCache: 0 };

  // Process in batches to avoid blocking UI
  const BATCH = 20;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    await Promise.all(batch.map(async url => {
      try {
        const r = await runAllChecks(url);
        stats[r.overallRisk]++;
        if (r.fromCache) stats.fromCache++;
        const hasPaywall = r.checks.find(c => c.id === 'paywall')?.status === 'warn';
        const hasRedirect = r.checks.find(c => c.id === 'redirect')?.status !== 'pass';
        const hasShortener = r.checks.find(c => c.id === 'shortener')?.status === 'warn';
        const hasFirewall = ['warn','fail'].includes(r.checks.find(c => c.id === 'firewall')?.status || '');
        if (hasPaywall) stats.withPaywall++;
        if (hasRedirect) stats.withRedirect++;
        if (hasShortener) stats.withShortener++;
        if (hasFirewall) stats.withFirewallBypass++;
      } catch { stats.low++; }
    }));
    // Yield to event loop
    await new Promise(r => setTimeout(r, 0));
  }
  return stats;
}

// ─── ML analysis ─────────────────────────────────────────────────────────────

async function analyzeWithBackend(
  headers: string[],
  rows: Record<string, string>[],
  filename: string,
  preCheckStats: PreCheckStats
): Promise<AnalysisResult> {
  const totalRows = rows.length;

  // ── Attempt 1: Flask backend ──────────────────────────────────────────────
  try {
    const csv = [
      headers.join(','),
      ...rows.map(row =>
        headers.map(h => {
          const v = row[h] || '';
          return v.includes(',') ? `"${v.replace(/"/g,'""')}"` : v;
        }).join(',')
      ),
    ].join('\n');

    const fd = new FormData();
    fd.append('file', new File([csv], filename, { type: 'text/csv' }));

    console.log('📤 Sending FormData with CSV to backend...');
    console.log('📊 FormData contents:', { filename, rows: rows.length, headers });
    
    const resp = await fetch('http://localhost:5000/api/upload', {
      method: 'POST',
      body: fd,
      signal: AbortSignal.timeout(300000), // 5 minutes for large files
    });

    console.log('📥 Backend response:', { status: resp.status, statusText: resp.statusText, ok: resp.ok });
    
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      console.error('❌ Backend HTTP error:', e);
      throw new Error(e.error || `Server error ${resp.status}`);
    }

    const br = await resp.json();
    console.log('✅ Backend response parsed:', { detection_method: br.detection_method, model_available: br.model_available, total: br.total });

    try {
      const anomalies: Anomaly[] = [];
      (br.results || []).forEach((r: any, idx: number) => {
        if (r.error) {
          anomalies.push({ row: idx + 1, reason: `Parse error: ${r.error}`, severity: 'medium' });
        } else if (r.is_phishing) {
          const sev = r.confidence >= 80 ? 'high' : r.confidence >= 50 ? 'medium' : 'low';
          const reasons = r.reasons?.length ? ` (${r.reasons[0]})` : '';
          anomalies.push({ row: idx + 1, reason: `Phishing detected — ${r.confidence}% confidence${reasons}`, severity: sev });
        }
      });

      const safeCount = br.safe_count ?? 0;
      const cleanScore = br.total > 0 ? Math.round((safeCount / br.total) * 100) : 0;
      
      const detectionMethod = br.detection_method || 'heuristic_only';
      const modelStatus = br.model_available ? '🤖 ML Model' : '📊 Heuristic Analysis';

      return {
        totalRows: br.total,
        cleanRows: safeCount,
        suspiciousRows: br.phishing_count ?? 0,
        anomalies: anomalies.slice(0, 30),
        summary: br.phishing_count === 0
          ? `✅ All ${br.total} URLs passed analysis (${modelStatus}). No phishing detected.`
          : `⚠️ ${br.phishing_count} phishing URL(s) found in ${br.total} total (${modelStatus}). ${safeCount} are safe.`,
        score: cleanScore,
        preCheckStats,
        detectionMethod,
        modelAvailable: br.model_available,
      };
    } catch (parseErr) {
      console.error('❌ Error parsing backend response:', parseErr, 'Response:', br);
      throw new Error(`Failed to parse backend response: ${parseErr}`);
    }

  } catch (fetchErr) {
    console.error('❌ Backend analysis failed with error:', {
      name: (fetchErr as any).name,
      message: (fetchErr as any).message,
      cause: (fetchErr as any).cause,
      stack: (fetchErr as any).stack,
    });

    // ── Fallback: heuristic-only analysis ────────────────────────────────────
    const anomalies: Anomaly[] = [];
    let suspicious = 0;

    // Use pre-check risk stats as base
    const highRiskCount = preCheckStats.high + preCheckStats.critical;
    const medRiskCount = preCheckStats.medium;
    suspicious = highRiskCount + Math.floor(medRiskCount * 0.5);

    // Quick pattern scan for additional signals (sample for large datasets)
    const sampleStep = Math.max(1, Math.floor(rows.length / 300));
    const urlCol = headers.find(h => h.toLowerCase().includes('url')) || headers[0];

    const seen = new Set<string>();
    rows.filter((_, i) => i % sampleStep === 0).forEach((row, si) => {
      const actualIdx = si * sampleStep;
      const urlVal = row[urlCol] || '';

      // Duplicate check (O(1) with Set)
      if (urlVal && seen.has(urlVal)) {
        anomalies.push({ row: actualIdx + 1, reason: `Duplicate URL: ${urlVal.slice(0, 60)}`, severity: 'medium' });
      } else if (urlVal) {
        seen.add(urlVal);
      }

      // Missing values
      const missing = Object.values(row).filter(v => !v?.trim()).length;
      if (missing > headers.length * 0.5) {
        anomalies.push({ row: actualIdx + 1, reason: `${missing}/${headers.length} fields empty`, severity: 'low' });
      }

      // Quick phishing keywords
      const low = urlVal.toLowerCase();
      const kwHits = ['verify','confirm','suspended','validate','secure-login'].filter(k => low.includes(k));
      if (kwHits.length >= 2) {
        anomalies.push({ row: actualIdx + 1, reason: `Suspicious keywords: ${kwHits.join(', ')}`, severity: 'high' });
        suspicious++;
      }
    });

    const cleanRows = Math.max(0, totalRows - suspicious);
    const cleanScore = Math.round((cleanRows / totalRows) * 100);

    return {
      totalRows,
      cleanRows,
      suspiciousRows: suspicious,
      anomalies: anomalies.slice(0, 30),
      summary: `⚠️ Backend connection error — heuristic analysis only. ${suspicious} potentially suspicious rows detected. Ensure Flask backend is running for ML model predictions.`,
      score: cleanScore,
      preCheckStats,
      detectionMethod: 'heuristic_fallback',
      modelAvailable: false,
    };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SeverityBadge({ s }: { s: 'high' | 'medium' | 'low' }) {
  const map = {
    high: 'bg-neon-red/20 text-neon-red border-neon-red/40',
    medium: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40',
    low: 'bg-neon-blue/20 text-neon-blue border-neon-blue/40',
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono uppercase flex-shrink-0 ${map[s]}`}>{s}</span>;
}

function PreCheckSummaryCard({ stats }: { stats: PreCheckStats }) {
  const flags = [
    { icon: Eye, label: 'Paywall', count: stats.withPaywall, color: 'text-yellow-400' },
    { icon: RotateCcw, label: 'Redirects', count: stats.withRedirect, color: 'text-orange-400' },
    { icon: Link2, label: 'Shorteners', count: stats.withShortener, color: 'text-yellow-300' },
    { icon: Shield, label: 'Firewall Bypass', count: stats.withFirewallBypass, color: 'text-neon-red' },
  ].filter(f => f.count > 0);

  const riskColor = stats.critical + stats.high > 0
    ? 'border-neon-red/30 bg-neon-red/5'
    : stats.medium > 0
    ? 'border-yellow-400/20 bg-yellow-400/5'
    : 'border-neon-green/20 bg-neon-green/5';

  return (
    <div className={`rounded-xl border p-4 ${riskColor}`}>
      <div className="flex items-center gap-2 mb-3">
        <Shield size={14} className="text-neon-blue" />
        <span className="text-xs font-bold text-white uppercase tracking-wider">Pre-Check Summary</span>
        {stats.fromCache > 0 && (
          <span className="ml-auto text-[10px] text-gray-500 font-mono flex items-center gap-1">
            <Database size={9} /> {stats.fromCache} from cache
          </span>
        )}
      </div>

      {/* Risk breakdown */}
      <div className="grid grid-cols-5 gap-1 mb-3">
        {[
          { label: 'Safe', count: stats.safe, color: 'text-neon-green' },
          { label: 'Low', count: stats.low, color: 'text-yellow-300' },
          { label: 'Medium', count: stats.medium, color: 'text-orange-400' },
          { label: 'High', count: stats.high, color: 'text-neon-red' },
          { label: 'Critical', count: stats.critical, color: 'text-neon-red font-bold' },
        ].map(r => (
          <div key={r.label} className="text-center">
            <div className={`text-sm font-mono font-bold ${r.color}`}>{r.count}</div>
            <div className="text-[9px] text-gray-600 uppercase">{r.label}</div>
          </div>
        ))}
      </div>

      {/* Specific flags */}
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {flags.map(f => (
            <span key={f.label} className="flex items-center gap-1 text-[10px] bg-white/5 border border-white/10 px-2 py-1 rounded-lg">
              <f.icon size={9} className={f.color} />
              <span className={f.color}>{f.count}</span>
              <span className="text-gray-500">{f.label}</span>
            </span>
          ))}
        </div>
      )}

      {flags.length === 0 && stats.safe === stats.total && (
        <div className="flex items-center gap-2 text-neon-green text-xs">
          <CheckCircle size={12} /> All URLs passed pre-checks
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Upload() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [preCheckProgress, setPreCheckProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setErrorMsg('');
    setPreCheckProgress(0);
    setUploadState('reading');

    try {
      const text = await f.text();
      let headers: string[] = [];
      let rows: Record<string, string>[] = [];

      if (f.name.endsWith('.json')) {
        const json = JSON.parse(text);
        const data: Record<string, string>[] = Array.isArray(json) ? json : [json];
        headers = Object.keys(data[0] ?? {});
        rows = data;
      } else {
        const parsed = parseCSV(text);
        headers = parsed.headers;
        rows = parsed.rows;
      }

      if (!rows.length || !headers.length) throw new Error('No data found. Check that the file has headers and at least one row.');

      setPreview({ headers, rows: rows.slice(0, 5) });

      // Find URL column
      const urlCol = headers.find(h => h.toLowerCase().includes('url') || h.toLowerCase() === 'link');
      const urls = urlCol ? rows.map(r => r[urlCol]).filter(Boolean) : [];

      // ── Pre-checks phase ──────────────────────────────────────────────────
      setUploadState('prechecking');

      let preCheckStats: PreCheckStats = { total: urls.length, safe: 0, low: 0, medium: 0, high: 0, critical: 0, withPaywall: 0, withRedirect: 0, withShortener: 0, withFirewallBypass: 0, fromCache: 0 };

      if (urls.length > 0) {
        // Sample up to 100 for pre-checks (to stay fast)
        const sample = urls.length <= 100 ? urls : urls.filter((_, i) => i % Math.ceil(urls.length / 100) === 0);
        const PBATCH = 10;
        for (let i = 0; i < sample.length; i += PBATCH) {
          await Promise.all(sample.slice(i, i + PBATCH).map(async url => {
            const r = await runAllChecks(url);
            preCheckStats[r.overallRisk]++;
            if (r.fromCache) preCheckStats.fromCache++;
            if (r.checks.find(c => c.id === 'paywall')?.status === 'warn') preCheckStats.withPaywall++;
            if (['warn','fail'].includes(r.checks.find(c => c.id === 'redirect')?.status || '')) preCheckStats.withRedirect++;
            if (r.checks.find(c => c.id === 'shortener')?.status === 'warn') preCheckStats.withShortener++;
            if (['warn','fail'].includes(r.checks.find(c => c.id === 'firewall')?.status || '')) preCheckStats.withFirewallBypass++;
          }));
          setPreCheckProgress(Math.round(((i + PBATCH) / sample.length) * 100));
        }
        // Scale stats back if sampled
        if (urls.length > 100) {
          const scale = urls.length / sample.length;
          preCheckStats.safe = Math.round(preCheckStats.safe * scale);
          preCheckStats.low = Math.round(preCheckStats.low * scale);
          preCheckStats.medium = Math.round(preCheckStats.medium * scale);
          preCheckStats.high = Math.round(preCheckStats.high * scale);
          preCheckStats.critical = Math.round(preCheckStats.critical * scale);
          preCheckStats.total = urls.length;
        }
      }

      // ── ML analysis phase ─────────────────────────────────────────────────
      setUploadState('analyzing');
      const analysisResult = await analyzeWithBackend(headers, rows, f.name, preCheckStats);
      setResult(analysisResult);
      setUploadState('done');

    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process file.');
      setUploadState('error');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0]; if (f) processFile(f);
  }, []);
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '';
  };

  const reset = () => {
    setUploadState('idle'); setFile(null); setPreview(null);
    setResult(null); setErrorMsg(''); setShowAll(false); setPreCheckProgress(0);
  };

  const scoreColor = (result?.score ?? 0) >= 80 ? 'text-neon-green' : (result?.score ?? 0) >= 50 ? 'text-yellow-300' : 'text-neon-red';
  const visible = showAll ? (result?.anomalies ?? []) : (result?.anomalies ?? []).slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold font-display text-white tracking-wide mb-2">Upload Dataset</h1>
        <p className="text-gray-400 text-sm">CSV or JSON · Pre-checks every URL before ML analysis</p>
      </header>

      <AnimatePresence mode="wait">

        {/* ── Idle / drop zone ── */}
        {uploadState === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`glass-panel p-8 transition-all duration-300 ${isDragging ? 'border-neon-blue shadow-[0_0_30px_rgba(0,240,255,0.2)]' : ''}`}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`p-6 rounded-full mb-6 transition-all ${isDragging ? 'bg-neon-blue/20 scale-110' : 'bg-surface border border-border'}`}>
                <UploadCloud size={48} className={isDragging ? 'text-neon-blue text-glow-blue' : 'text-gray-400'} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Drag & Drop your dataset</h3>
              <p className="text-gray-400 mb-2">Supports <span className="text-neon-blue">.csv</span> and <span className="text-neon-blue">.json</span></p>
              <p className="text-gray-600 text-xs mb-8 font-mono">9-point URL pre-check · ML phishing analysis · Cache-accelerated</p>
              <label className="cursor-pointer relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-blue to-neon-purple rounded-lg blur opacity-30 group-hover:opacity-70 transition duration-500" />
                <div className="relative px-8 py-3 bg-background rounded-lg border border-border hover:border-neon-blue/50 flex items-center gap-2 text-white font-medium text-sm">
                  <FileSpreadsheet size={15} /> Browse File
                </div>
                <input ref={inputRef} type="file" className="hidden" accept=".csv,.json,.tsv,.txt" onChange={handleInput} />
              </label>
            </div>
          </motion.div>
        )}

        {/* ── Reading ── */}
        {uploadState === 'reading' && (
          <motion.div key="reading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass-panel p-8 flex flex-col items-center justify-center py-20"
          >
            <div className="w-12 h-12 border-4 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin mb-6" />
            <h3 className="text-lg font-semibold mb-1">Reading file…</h3>
            <p className="text-gray-500 font-mono text-sm">{file?.name}</p>
          </motion.div>
        )}

        {/* ── Pre-checking ── */}
        {uploadState === 'prechecking' && (
          <motion.div key="prechecking" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass-panel p-8 flex flex-col items-center py-10"
          >
            {/* Preview table */}
            {preview && (
              <div className="w-full mb-8 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="bg-white/5">
                      {preview.headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left text-neon-blue font-semibold truncate max-w-[120px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-t border-border hover:bg-white/5">
                        {preview.headers.map(h => (
                          <td key={h} className="px-3 py-2 text-gray-300 truncate max-w-[120px]">{row[h] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[10px] text-gray-600 px-3 py-2 font-mono">Preview: first 5 rows · {file?.name}</p>
              </div>
            )}

            {/* Pre-check progress */}
            <div className="w-full max-w-sm">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-2 font-mono">
                <span className="flex items-center gap-1.5"><Shield size={11} className="text-neon-blue" /> Running 9-point pre-checks…</span>
                <span>{Math.min(preCheckProgress, 100)}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-neon-blue rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(preCheckProgress, 100)}%` }}
                  transition={{ type: 'spring', stiffness: 50 }}
                />
              </div>
              <div className="flex gap-3 mt-4 flex-wrap justify-center">
                {[
                  { icon: Database, label: 'Cache', color: 'text-neon-blue' },
                  { icon: Lock, label: 'HTTPS', color: 'text-neon-green' },
                  { icon: RotateCcw, label: 'Redirects', color: 'text-yellow-400' },
                  { icon: Shield, label: 'Firewall', color: 'text-orange-400' },
                  { icon: Eye, label: 'Paywall', color: 'text-yellow-300' },
                  { icon: Globe, label: 'Patterns', color: 'text-neon-purple' },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex items-center gap-1 text-[10px] text-gray-500">
                    <Icon size={9} className={color} /> {label}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ML Analyzing ── */}
        {uploadState === 'analyzing' && (
          <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass-panel p-8 flex flex-col items-center py-10"
          >
            {preview && (
              <div className="w-full mb-8 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs font-mono">
                  <thead><tr className="bg-white/5">{preview.headers.map(h => (
                    <th key={h} className="px-3 py-2 text-left text-neon-blue font-semibold truncate max-w-[120px]">{h}</th>
                  ))}</tr></thead>
                  <tbody>{preview.rows.map((row, i) => (
                    <tr key={i} className="border-t border-border hover:bg-white/5">
                      {preview.headers.map(h => (
                        <td key={h} className="px-3 py-2 text-gray-300 truncate max-w-[120px]">{row[h]||'—'}</td>
                      ))}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            <div className="flex items-center gap-3 text-neon-blue mb-2">
              <div className="w-7 h-7 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
              <span className="font-semibold">Running ML Phishing Analysis…</span>
            </div>
            <p className="text-gray-500 text-sm">Querying model for each URL</p>

            <div className="mt-5 flex gap-1 h-6 w-40 opacity-40">
              {Array.from({ length: 16 }).map((_, i) => (
                <motion.div key={i} className="flex-1 bg-neon-blue rounded-sm"
                  animate={{ scaleY: [0.2, 1, 0.2] }}
                  transition={{ duration: 1 + Math.random(), repeat: Infinity, delay: Math.random() * 0.8 }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Results ── */}
        {uploadState === 'done' && result && (
          <motion.div key="done" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

            {/* Pre-check summary */}
            {result.preCheckStats && (
              <PreCheckSummaryCard stats={result.preCheckStats} />
            )}

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Rows', val: result.totalRows, color: 'text-white' },
                { label: 'Clean Rows', val: result.cleanRows, color: 'text-neon-green' },
                { label: 'Suspicious', val: result.suspiciousRows, color: 'text-neon-red' },
                { label: 'Clean Score', val: `${result.score}%`, color: scoreColor },
              ].map(s => (
                <div key={s.label} className="glass-panel p-5 text-center">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">{s.label}</p>
                  <p className={`text-3xl font-bold font-mono ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="glass-panel p-6 flex gap-4 items-start">
              {result.score >= 75
                ? <ShieldCheck size={26} className="text-neon-green shrink-0 mt-0.5" />
                : <AlertTriangle size={26} className="text-yellow-300 shrink-0 mt-0.5" />
              }
              <div>
                <h3 className="font-semibold text-white mb-1">Analysis Summary</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{result.summary}</p>
                <p className="text-gray-600 text-xs mt-2 font-mono">File: {file?.name}</p>
              </div>
            </div>

            {/* Anomalies */}
            {result.anomalies.length > 0 ? (
              <div className="glass-panel p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <AlertCircle size={16} className="text-neon-red" />
                  Flagged Anomalies ({result.anomalies.length})
                </h3>
                <div className="space-y-2">
                  {visible.map((a, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-border hover:border-neon-red/20 transition-colors"
                    >
                      <SeverityBadge s={a.severity} />
                      <div className="min-w-0">
                        <span className="text-gray-500 text-xs font-mono mr-2">Row {a.row}</span>
                        <span className="text-gray-200 text-sm">{a.reason}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
                {result.anomalies.length > 5 && (
                  <button onClick={() => setShowAll(v => !v)}
                    className="mt-3 flex items-center gap-1 text-neon-blue text-xs hover:underline">
                    {showAll ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {result.anomalies.length}</>}
                  </button>
                )}
              </div>
            ) : (
              <div className="glass-panel p-6 flex items-center gap-4">
                <CheckCircle size={26} className="text-neon-green shrink-0" />
                <div>
                  <h3 className="font-semibold text-white mb-1">No Anomalies Detected</h3>
                  <p className="text-gray-400 text-sm">Dataset appears clean. No phishing URLs found.</p>
                </div>
              </div>
            )}

            <div className="flex justify-center pt-2">
              <button onClick={reset}
                className="flex items-center gap-2 px-8 py-3 rounded-xl border border-neon-blue/40 text-neon-blue hover:bg-neon-blue/10 transition-colors font-medium text-sm">
                <RotateCcw size={14} /> Scan Another File
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Error ── */}
        {uploadState === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass-panel p-12 flex flex-col items-center text-center"
          >
            <div className="p-4 rounded-full bg-neon-red/10 mb-6">
              <AlertCircle size={52} className="text-neon-red" />
            </div>
            <h3 className="text-2xl font-bold mb-2 text-white">Processing Failed</h3>
            <p className="text-gray-400 mb-2 max-w-md text-sm">{errorMsg}</p>
            <p className="text-gray-600 text-xs mb-8">Make sure your file has column headers and valid CSV / JSON format.</p>
            <button onClick={reset}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-neon-blue text-background font-bold hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all text-sm">
              <RotateCcw size={14} /> Try Again
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
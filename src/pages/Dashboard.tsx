import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ShieldCheck, AlertTriangle, ArrowLeft } from 'lucide-react';
import { URLChecklist, ChecklistResult } from '../components/URLChecklist';

interface DashboardProps {
  onScanComplete?: (data: any) => void;
}

type Phase = 'input' | 'checking' | 'analyzing' | 'done' | 'error';

export function Dashboard({ onScanComplete }: DashboardProps) {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [checklistResult, setChecklistResult] = useState<ChecklistResult | null>(null);
  const [error, setError] = useState('');
  const [scanUrl, setScanUrl] = useState('');

  // Called after checklist finishes (and mandatory warnings acknowledged)
  const handleChecklistComplete = async (result: ChecklistResult) => {
    setChecklistResult(result);
    setPhase('analyzing');
    setError('');

    // If checklist already says it's critical — skip ML but still show result
    if (result.overallRisk === 'critical' && !result.shouldRunML) {
      onScanComplete?.({
        url: result.url,
        is_phishing: true,
        confidence: result.riskScore,
        reasons: result.warnings,
      });
      return;
    }

    // Try Flask backend
    try {
      const resp = await fetch('http://localhost:5000/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: result.url }),
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error(err.error || `Server error ${resp.status}`);
      }

      const data = await resp.json();

      // Merge checklist risk into model result
      const mergedConfidence = Math.min(100,
        Math.max(data.confidence, result.riskScore)
      );
      const isPhishing = data.is_phishing || result.overallRisk === 'high' || result.overallRisk === 'critical';

      onScanComplete?.({
        url: result.url,
        is_phishing: isPhishing,
        confidence: mergedConfidence,
        reasons: [
          ...(data.reasons || []),
          ...result.warnings,
        ].filter(Boolean),
        checklistRisk: result.overallRisk,
        detectionMethod: data.detection_method,
      });

    } catch (fetchErr) {
      console.warn('Backend prediction error, using heuristic result:', fetchErr);

      // Fallback: use checklist heuristic result
      const isPhishing = result.overallRisk === 'high' || result.overallRisk === 'critical'
        || result.overallRisk === 'medium';

      if (result.warnings.length > 0 || result.overallRisk !== 'safe') {
        onScanComplete?.({
          url: result.url,
          is_phishing: isPhishing,
          confidence: result.riskScore,
          reasons: result.warnings.length > 0
            ? result.warnings
            : ['No suspicious patterns detected (heuristic analysis only)'],
          checklistRisk: result.overallRisk,
          note: 'Backend prediction error — result based on heuristic pre-checks only',
          detectionMethod: 'heuristic_fallback',
        });
      } else {
        // Looks safe from heuristics
        onScanComplete?.({
          url: result.url,
          is_phishing: false,
          confidence: 5,
          reasons: ['URL passed all pre-checks (heuristic analysis only)'],
          checklistRisk: 'safe',
          note: 'Backend prediction error — result based on heuristic pre-checks only',
          detectionMethod: 'heuristic_fallback',
        });
      }
    }
  };

  const handleAnalysis = () => {
    const trimmed = url.trim();
    if (!trimmed) { setError('Please enter a URL to check.'); return; }
    setError('');
    setScanUrl(trimmed);
    setPhase('checking');
  };

  const reset = () => {
    setPhase('input');
    setUrl('');
    setScanUrl('');
    setChecklistResult(null);
    setError('');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <AnimatePresence mode="wait">

        {/* ── Input phase ── */}
        {phase === 'input' && (
          <motion.div
            key="input"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="glass-panel p-12 max-w-lg w-full flex flex-col items-center"
          >
            <div className="p-6 rounded-full bg-neon-blue/10 border border-neon-blue/20 mb-6">
              <Search size={44} className="text-neon-blue text-glow-blue" />
            </div>
            <h2 className="text-2xl font-bold mb-1 text-white">Phishing Link Detector</h2>
            <p className="text-sm text-gray-400 mb-8">
              9-point pre-check · AI-powered · Heuristic fallback
            </p>

            <div className="w-full mb-4">
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalysis()}
                placeholder="https://example.com/path?query=value"
                className="w-full px-4 py-3 rounded-xl bg-background/60 border border-neon-blue/30 text-white placeholder-gray-600 focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/30 transition-colors font-mono text-sm"
              />
            </div>

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-neon-red mb-4 text-sm">
                {error}
              </motion.p>
            )}

            <button
              onClick={handleAnalysis}
              className="w-full px-8 py-3 rounded-xl bg-neon-blue text-background font-bold hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] transition-all btn-slide"
            >
              Analyze URL
            </button>

            <div className="mt-8 pt-6 border-t border-white/5 w-full">
              <p className="text-gray-600 text-xs">
                Or{' '}
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'upload' }))}
                  className="text-neon-blue hover:underline"
                >
                  upload a CSV dataset
                </button>{' '}
                for bulk analysis
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Checking phase ── */}
        {phase === 'checking' && (
          <motion.div
            key="checking"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="glass-panel p-8 max-w-lg w-full"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-white">Running Pre-Checks</h3>
                <p className="text-gray-500 text-xs font-mono truncate max-w-[280px]">{scanUrl}</p>
              </div>
              <div className="flex items-center gap-1.5 text-neon-blue">
                <div className="w-1.5 h-1.5 rounded-full bg-neon-blue animate-pulse" />
                <span className="text-xs font-mono">SCANNING</span>
              </div>
            </div>

            <URLChecklist
              url={scanUrl}
              onComplete={handleChecklistComplete}
            />

            <button
              onClick={reset}
              className="mt-5 flex items-center gap-2 text-gray-500 hover:text-white text-xs transition-colors"
            >
              <ArrowLeft size={12} /> Cancel
            </button>
          </motion.div>
        )}

        {/* ── Analyzing phase ── */}
        {phase === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-panel p-10 max-w-lg w-full flex flex-col items-center"
          >
            {checklistResult && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold mb-6 ${
                checklistResult.overallRisk === 'safe'
                  ? 'text-neon-green border-neon-green/30 bg-neon-green/10'
                  : 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
              }`}>
                {checklistResult.overallRisk === 'safe'
                  ? <ShieldCheck size={16} />
                  : <AlertTriangle size={16} />
                }
                Pre-checks: {checklistResult.overallRisk.toUpperCase()}
                {checklistResult.warnings.length > 0 && ` · ${checklistResult.warnings.length} warning(s)`}
              </div>
            )}

            <div className="w-10 h-10 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin mb-4" />
            <p className="text-white font-semibold">Running ML Analysis…</p>
            <p className="text-gray-500 text-sm mt-1">Querying phishing detection model</p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
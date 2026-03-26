import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck, AlertTriangle, Activity, Database,
  TrendingUp, Eye, Link2, RotateCcw, Shield
} from 'lucide-react';

interface AnalyticsProps {
  result: {
    totalRows: number;
    cleanRows: number;
    suspiciousRows: number;
    anomalies: Array<{ row: number; reason: string; severity: 'high' | 'medium' | 'low' }>;
    summary: string;
    score: number;
    preCheckStats?: {
      total: number; safe: number; low: number; medium: number;
      high: number; critical: number; withPaywall: number;
      withRedirect: number; withShortener: number; withFirewallBypass: number;
    };
    detectionMethod?: string;
    modelAvailable?: boolean;
  };
  fileName?: string;
}

export function AnalyticsDashboard({ result, fileName }: AnalyticsProps) {
  const donutRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const lineRef = useRef<HTMLCanvasElement>(null);
  const radarRef = useRef<HTMLCanvasElement>(null);
  const [chartsLoaded, setChartsLoaded] = useState(false);

  const { totalRows, cleanRows, suspiciousRows, score, preCheckStats, anomalies } = result;
  const pc = preCheckStats;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    script.onload = () => setChartsLoaded(true);
    document.head.appendChild(script);
    return () => { script.onload = null; };
  }, []);

  useEffect(() => {
    if (!chartsLoaded || !(window as any).Chart) return;
    const Chart = (window as any).Chart;

    // Destroy existing charts
    ['donut-chart', 'bar-chart', 'line-chart', 'radar-chart'].forEach(id => {
      const c = Chart.getChart(id);
      if (c) c.destroy();
    });

    // ── Donut: safe vs suspicious
    if (donutRef.current) {
      new Chart(donutRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Safe', 'Suspicious'],
          datasets: [{
            data: [cleanRows, suspiciousRows],
            backgroundColor: ['#00ff66', '#ff3366'],
            borderWidth: 0,
            hoverOffset: 4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: '72%',
          plugins: { legend: { display: false }, tooltip: { callbacks: {
            label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed} rows (${((ctx.parsed / totalRows) * 100).toFixed(1)}%)`
          }}},
        },
      });
    }

    // ── Bar: severity breakdown
    if (barRef.current) {
      const high = anomalies.filter(a => a.severity === 'high').length;
      const med = anomalies.filter(a => a.severity === 'medium').length;
      const low = anomalies.filter(a => a.severity === 'low').length;
      new Chart(barRef.current, {
        type: 'bar',
        data: {
          labels: ['Critical / High', 'Medium', 'Low'],
          datasets: [{
            label: 'Anomalies',
            data: [high, med, low],
            backgroundColor: ['#ff3366cc', '#facc15cc', '#00f0ffcc'],
            borderWidth: 0,
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { size: 11 } } },
            y: {
              beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#9ca3af', font: { size: 11 }, stepSize: 1 },
            },
          },
        },
      });
    }

    // ── Line: risk distribution (cumulative by row index)
    if (lineRef.current) {
      const sortedRows = [...anomalies].sort((a, b) => a.row - b.row);
      const step = Math.max(1, Math.floor(totalRows / 20));
      const labels: string[] = [];
      const data: number[] = [];
      for (let i = step; i <= totalRows; i += step) {
        labels.push(`Row ${i}`);
        const count = sortedRows.filter(a => a.row <= i).length;
        data.push(count);
      }
      new Chart(lineRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Cumulative flags',
            data,
            borderColor: '#b026ff',
            backgroundColor: 'rgba(176,38,255,0.1)',
            borderWidth: 2,
            pointRadius: 3,
            fill: true,
            tension: 0.4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { size: 10 }, maxTicksLimit: 8 } },
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { size: 11 } } },
          },
        },
      });
    }

    // ── Radar: pre-check category scores
    if (radarRef.current && pc) {
      const t = pc.total || 1;
      new Chart(radarRef.current, {
        type: 'radar',
        data: {
          labels: ['Safe URLs', 'Low Risk', 'Medium Risk', 'High Risk', 'Critical'],
          datasets: [{
            label: 'Distribution',
            data: [
              Math.round((pc.safe / t) * 100),
              Math.round((pc.low / t) * 100),
              Math.round((pc.medium / t) * 100),
              Math.round((pc.high / t) * 100),
              Math.round((pc.critical / t) * 100),
            ],
            backgroundColor: 'rgba(0,240,255,0.15)',
            borderColor: '#00f0ff',
            borderWidth: 2,
            pointBackgroundColor: '#00f0ff',
            pointRadius: 4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              beginAtZero: true,
              max: 100,
              grid: { color: 'rgba(255,255,255,0.08)' },
              angleLines: { color: 'rgba(255,255,255,0.08)' },
              ticks: { color: '#9ca3af', font: { size: 10 }, backdropColor: 'transparent', stepSize: 25 },
              pointLabels: { color: '#9ca3af', font: { size: 11 } },
            },
          },
        },
      });
    }
  }, [chartsLoaded, result]);

  const scoreColor = score >= 80 ? '#00ff66' : score >= 50 ? '#facc15' : '#ff3366';
  const scoreLabel = score >= 80 ? 'Clean' : score >= 50 ? 'Moderate Risk' : 'High Risk';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white font-display tracking-wide">Analytics Dashboard</h2>
          <p className="text-gray-500 text-sm font-mono mt-0.5">{fileName || 'dataset'} · {totalRows} rows analyzed</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border"
          style={{ borderColor: `${scoreColor}40`, background: `${scoreColor}10` }}>
          {score >= 80 ? <ShieldCheck size={16} style={{ color: scoreColor }} /> : <AlertTriangle size={16} style={{ color: scoreColor }} />}
          <span className="text-sm font-bold font-mono" style={{ color: scoreColor }}>{scoreLabel} · {score}%</span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Rows', val: totalRows, color: 'text-white', icon: Database },
          { label: 'Clean Rows', val: cleanRows, color: 'text-neon-green', icon: ShieldCheck },
          { label: 'Flagged', val: suspiciousRows, color: 'text-neon-red', icon: AlertTriangle },
          { label: 'Integrity Score', val: `${score}%`, color: score >= 80 ? 'text-neon-green' : score >= 50 ? 'text-yellow-400' : 'text-neon-red', icon: Activity },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="glass-panel p-5 flex items-start gap-3"
          >
            <div className="p-2 rounded-lg bg-white/5">
              <s.icon size={16} className="text-gray-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.val}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Donut */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-panel p-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Safety Distribution</h3>
          <div className="flex items-center gap-6">
            <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
              <canvas id="donut-chart" ref={donutRef} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold font-mono" style={{ color: scoreColor }}>{score}%</span>
                <span className="text-[10px] text-gray-500">clean</span>
              </div>
            </div>
            <div className="space-y-3 flex-1">
              {[
                { label: 'Safe rows', val: cleanRows, pct: totalRows ? Math.round((cleanRows / totalRows) * 100) : 0, color: '#00ff66' },
                { label: 'Flagged rows', val: suspiciousRows, pct: totalRows ? Math.round((suspiciousRows / totalRows) * 100) : 0, color: '#ff3366' },
              ].map(r => (
                <div key={r.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm" style={{ background: r.color }} />
                      {r.label}
                    </span>
                    <span className="font-mono text-white">{r.val}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ background: r.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${r.pct}%` }}
                      transition={{ duration: 0.8, delay: 0.5 }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-white/5">
                <p className="text-[11px] text-gray-600 font-mono">
                  {result.detectionMethod === 'ml_model' ? '🤖 ML model' : '📊 Heuristic'} · {result.modelAvailable ? 'model online' : 'model offline'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bar: severity */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Anomaly Severity</h3>
            <div className="flex gap-3 text-[11px]">
              {[['High','#ff3366'], ['Medium','#facc15'], ['Low','#00f0ff']].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm" style={{ background: c as string }} />
                  <span className="text-gray-500">{l}</span>
                </span>
              ))}
            </div>
          </div>
          <div style={{ position: 'relative', height: 160 }}>
            <canvas id="bar-chart" ref={barRef} />
          </div>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Line: cumulative flags */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-panel p-6">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Anomaly Distribution Across Dataset</h3>
          <div style={{ position: 'relative', height: 180 }}>
            <canvas id="line-chart" ref={lineRef} />
          </div>
          <p className="text-[11px] text-gray-600 mt-2 font-mono">Cumulative flagged rows as dataset progresses</p>
        </motion.div>

        {/* Radar: pre-check risk levels */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="glass-panel p-6">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Pre-Check Risk Profile</h3>
          {pc && pc.total > 0 ? (
            <div style={{ position: 'relative', height: 180 }}>
              <canvas id="radar-chart" ref={radarRef} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[180px] text-gray-600 text-sm">No URL pre-check data</div>
          )}
        </motion.div>
      </div>

      {/* Pre-check flags row */}
      {pc && pc.total > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-panel p-6">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">URL Threat Indicators</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Eye, label: 'Paywall detected', val: pc.withPaywall, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
              { icon: RotateCcw, label: 'Redirect params', val: pc.withRedirect, color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' },
              { icon: Link2, label: 'URL shorteners', val: pc.withShortener, color: 'text-yellow-300', bg: 'bg-yellow-300/10 border-yellow-300/20' },
              { icon: Shield, label: 'Firewall bypass', val: pc.withFirewallBypass, color: 'text-neon-red', bg: 'bg-neon-red/10 border-neon-red/20' },
            ].map(f => (
              <div key={f.label} className={`rounded-xl border p-4 ${f.bg}`}>
                <f.icon size={16} className={`${f.color} mb-2`} />
                <p className={`text-2xl font-bold font-mono ${f.color}`}>{f.val}</p>
                <p className="text-[11px] text-gray-500 mt-1">{f.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Top anomalies table */}
      {anomalies.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-neon-red" />
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Top Flagged Rows</h3>
            <span className="ml-auto text-[11px] text-gray-600 font-mono">{anomalies.length} total</span>
          </div>
          <div className="space-y-2">
            {anomalies.slice(0, 8).map((a, i) => {
              const sevColor = a.severity === 'high' ? 'text-neon-red border-neon-red/30 bg-neon-red/10'
                : a.severity === 'medium' ? 'text-yellow-300 border-yellow-300/30 bg-yellow-300/10'
                : 'text-neon-blue border-neon-blue/30 bg-neon-blue/10';
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.55 + i * 0.04 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
                >
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-mono uppercase flex-shrink-0 ${sevColor}`}>{a.severity}</span>
                  <span className="text-gray-500 text-xs font-mono flex-shrink-0">Row {a.row}</span>
                  <span className="text-gray-300 text-sm truncate">{a.reason}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}

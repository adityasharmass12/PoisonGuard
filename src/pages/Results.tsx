import { motion } from 'motion/react';
import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';

interface ResultsProps {
  data?: any;
  onReset?: () => void;
}

export function Results({ data, onReset }: ResultsProps) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-12 max-w-lg w-full flex flex-col items-center"
        >
          <div className="p-6 rounded-full bg-neon-blue/10 mb-6">
            <ShieldAlert size={48} className="text-neon-blue text-glow-blue" />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-white">No Results Available</h2>
          <p className="text-gray-400 mb-8">
            Detection results will appear here once a URL has been analyzed.
          </p>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'dashboard' }))}
            className="px-8 py-3 rounded-lg bg-neon-blue text-background font-bold hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all btn-slide"
          >
            Go to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  // Safely extract data with fallbacks
  const confidence = 
    data?.confidence || 
    data?.probability || 
    (data?.score ? data.score * 100 : null) || 
    0;

  const isPhishing = data?.is_phishing ?? data?.isPhishing ?? false;
  const url = data?.url ?? "Unknown URL";
  const detectionMethod = data?.detectionMethod ?? 'heuristic_only';
  const note = data?.note ?? '';

  // Format detection method for display
  const getMethodLabel = () => {
    switch(detectionMethod) {
      case 'ml_model': return '🤖 ML Model Detection';
      case 'heuristic_fallback': return '📊 Heuristic Analysis';
      case 'heuristic_primary': return '⚡ Quick Heuristic Check';
      case 'heuristic_only': return '📊 Heuristic Analysis';
      default: return '🔍 Analysis';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-[80vh] text-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel p-12 max-w-2xl w-full flex flex-col items-center"
      >
        <div className={`p-6 rounded-full mb-6 ${isPhishing ? 'bg-neon-red/10' : 'bg-neon-green/10'}`}>
          {isPhishing ? (
            <AlertTriangle size={48} className="text-neon-red text-glow-red" />
          ) : (
            <ShieldCheck size={48} className="text-neon-green" />
          )}
        </div>

        <h2 className={`text-3xl font-bold mb-4 ${isPhishing ? 'text-neon-red' : 'text-neon-green'}`}>
          {isPhishing ? 'PHISHING DETECTED' : 'LINK IS SAFE'}
        </h2>

        <div className="bg-background/50 border border-neon-blue/30 rounded-lg p-6 w-full mb-6">
          <p className="text-gray-400 mb-2 text-sm">URL Analyzed:</p>
          <p className="text-white break-all font-mono text-sm">{url}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full mb-8">
          <div className="bg-background/50 border border-neon-blue/30 rounded-lg p-4">
            <p className="text-gray-400 mb-2 text-sm">Confidence</p>
            <p className={`text-2xl font-bold ${isPhishing ? 'text-neon-red' : 'text-neon-green'}`}>
              {typeof confidence === 'number' ? confidence.toFixed(2) : confidence}%
            </p>
          </div>
          <div className="bg-background/50 border border-neon-blue/30 rounded-lg p-4">
            <p className="text-gray-400 mb-2 text-sm">Status</p>
            <p className={`text-2xl font-bold ${isPhishing ? 'text-neon-red' : 'text-neon-green'}`}>
              {isPhishing ? 'Malicious' : 'Legitimate'}
            </p>
          </div>
        </div>

        <div className="bg-neon-purple/10 border border-neon-purple/30 rounded-lg p-4 w-full mb-8">
          <p className="text-neon-purple text-sm">
            {getMethodLabel()}
          </p>
        </div>

        {note && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neon-yellow/10 border border-neon-yellow/30 rounded-lg p-4 w-full mb-8"
          >
            <p className="text-neon-yellow text-sm">
              ℹ️ {note}
            </p>
          </motion.div>
        )}

        {isPhishing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neon-red/10 border border-neon-red/30 rounded-lg p-4 w-full mb-8"
          >
            <p className="text-neon-red text-sm">
              ⚠️ This link has been identified as potentially dangerous. Do not click on it or provide any personal information.
            </p>
          </motion.div>
        )}

        <div className="flex gap-4">
          {onReset && (
            <button 
              onClick={onReset}
              className="px-8 py-3 rounded-lg bg-neon-blue text-background font-bold hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all btn-slide"
            >
              Check Another URL
            </button>
          )}
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'landing' }))}
            className="px-8 py-3 rounded-lg bg-neon-cyan/20 border border-neon-cyan text-neon-cyan font-bold hover:bg-neon-cyan/30 transition-all"
          >
            Back to Home
          </button>
        </div>
      </motion.div>
    </div>
  );
}

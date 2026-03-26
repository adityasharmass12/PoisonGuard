/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Upload } from './pages/Uploads';
import { Analysis } from './pages/Analysis';
import { Results } from './pages/Results';
import { About } from './pages/About';

export default function App() {
  const [currentPage, setCurrentPage] = useState('landing');
  const [scanResult, setScanResult] = useState<any>(null);
  const [datasetResult, setDatasetResult] = useState<any>(null);
  const [datasetFile, setDatasetFile] = useState<string>('');

  useEffect(() => {
    const handleNavigation = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentPage(customEvent.detail);
    };

    window.addEventListener('navigate', handleNavigation);
    return () => window.removeEventListener('navigate', handleNavigation);
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'landing':
        return <Landing onNavigate={setCurrentPage} />;
      case 'dashboard':
        return <Dashboard onScanComplete={(data: any) => {
          setScanResult(data);
          setCurrentPage('results');
        }} />;
      case 'upload':
        return <Upload onUploadComplete={(data: any, file: string) => {
          setDatasetResult(data);
          setDatasetFile(file);
          setCurrentPage('analysis');
        }} />;
      case 'analysis':
        return <Analysis data={datasetResult} fileName={datasetFile} />;
      case 'results':
        return <Results data={scanResult} onReset={() => setCurrentPage('dashboard')} />;
      case 'about':
        return <About />;
      default:
        return <Landing onNavigate={setCurrentPage} />;
    }
  };

  return (
    <Layout showSidebar={currentPage !== 'landing'} currentPage={currentPage}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="w-full h-full"
        >
          {renderPage()}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

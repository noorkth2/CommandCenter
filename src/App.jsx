import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Projects from './pages/Projects';
import Issues from './pages/Issues';
import QATracker from './pages/QATracker';
import Deployments from './pages/Deployments';
import Sprints from './pages/Sprints';
import Automations from './pages/Automations';
import AIReports from './pages/AIReports';
import Settings from './pages/Settings';
import Clients from './pages/Clients';
import { useState } from 'react';
import Setup from './pages/Setup';
import { checkIsConfigured } from './lib/supabase';
import { ToastProvider } from './components/ui/Toast';

export default function App() {
  const [configured] = useState(() => checkIsConfigured());

  if (!configured) {
    return (
      <ToastProvider>
        <Setup />
      </ToastProvider>
    );
  }


  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="clients" element={<Clients />} />
            <Route path="projects" element={<Projects />} />
            <Route path="issues" element={<Issues />} />
            <Route path="qa" element={<QATracker />} />
            <Route path="deployments" element={<Deployments />} />
            <Route path="sprints" element={<Sprints />} />
            <Route path="automations" element={<Automations />} />
            <Route path="ai-reports" element={<AIReports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}


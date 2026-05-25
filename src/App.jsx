import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { useState, useEffect } from 'react';
import Setup from './pages/Setup';
import Login from './pages/Login';
import AccessDenied from './pages/AccessDenied';
import { supabase, checkIsConfigured } from './lib/supabase';
import { useAuthStore } from './store/useAuthStore';
import { ToastProvider } from './components/ui/Toast';

export default function App() {
  const [configured] = useState(() => checkIsConfigured());
  const { session, user, initialize, setSession } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!configured) return;

    // Load initial session on startup
    initialize().then(() => setAuthChecked(true));

    // Listen to changes in auth state dynamically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [configured, initialize, setSession]);

  const renderContent = () => {
    if (!configured) {
      return <Setup />;
    }

    if (!authChecked) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-bg-base">
          <div className="w-6 h-6 border-2 border-border-strong border-t-brand-blue rounded-full animate-spin" />
        </div>
      );
    }

    if (!session) {
      return <Login />;
    }

    const ALLOWED_EMAILS = [
      'kayastha.noor1100@gmail.com',
      'niroj.mahrjan@gmail.com'
    ];

    const isAuthorized = user && ALLOWED_EMAILS.includes(user.email);
    if (!isAuthorized) {
      return <AccessDenied />;
    }

    return (
      <HashRouter>
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
      </HashRouter>
    );
  };

  return (
    <ToastProvider>
      {renderContent()}
    </ToastProvider>
  );
}


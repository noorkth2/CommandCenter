/**
 * App.jsx
 * Pure router. Auth logic and session bootstrap live in SessionProvider.
 */

import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

import { ToastProvider } from './components/ui/Toast';
import { SessionProvider } from './components/auth/SessionProvider';
import { SyncProvider } from './lib/SyncContext';
import { checkIsConfigured } from './lib/supabase';

import ProtectedRoutes from './components/auth/ProtectedRoutes';
import Layout from './components/layout/Layout';

import Setup from './pages/Setup';
import Login from './pages/Login';
import AccessDenied from './pages/AccessDenied';

import Dashboard from './pages/Dashboard';
import Board from './pages/Board';
import ImportPage from './pages/Import';
import TimeTracking from './pages/TimeTracking';
import Products from './pages/Products';
import Clients from './pages/Clients';
import Projects from './pages/Projects';
import Issues from './pages/Issues';
import QATracker from './pages/QATracker';
import Deployments from './pages/Deployments';
import Sprints from './pages/Sprints';
import Automations from './pages/Automations';
import AIReports from './pages/AIReports';
import Settings from './pages/Settings';

const isConfigured = checkIsConfigured();

export default function App() {
  if (!isConfigured) {
    return (
      <ToastProvider>
        <Setup />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <SessionProvider>
        <SyncProvider>
        <HashRouter>
          <Routes>
            {/* Pre-auth */}
            <Route path="/login" element={<Login />} />
            <Route path="/access-denied" element={<AccessDenied />} />

            {/* Protected Routes */}
            <Route path="/" element={<ProtectedRoutes />}>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard"   element={<Dashboard />} />
                <Route path="board"       element={<Board />} />
                <Route path="import"      element={<ImportPage />} />
                <Route path="time"        element={<TimeTracking />} />
                <Route path="products"    element={<Products />} />
                <Route path="clients"     element={<Clients />} />
                <Route path="projects"    element={<Projects />} />
                <Route path="issues"      element={<Issues />} />
                <Route path="qa"          element={<QATracker />} />
                <Route path="deployments" element={<Deployments />} />
                <Route path="sprints"     element={<Sprints />} />
                <Route path="automations" element={<Automations />} />
                <Route path="ai-reports"  element={<AIReports />} />
                <Route path="settings"    element={<Settings />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </HashRouter>
        </SyncProvider>
      </SessionProvider>
    </ToastProvider>
  );
}


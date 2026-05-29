import { useState } from 'react';
import { Database, Key, CheckCircle2, Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import Button from '../components/ui/Button';
import Logo from '../components/shared/Logo';

export default function Setup() {
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const envTemplate = `# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# App settings
VITE_APP_NAME=CommandCenter
VITE_APP_VERSION=1.0.0`;

  const sqlLocation = 'supabase/migrations/001_initial_schema.sql';

  const copyToClipboard = (text, setCopied) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRestartInfo = () => {
    alert(
      "Vite loads environment variables at startup.\n\n" +
      "1. Save your .env file.\n" +
      "2. Close the Electron app.\n" +
      "3. Stop the dev server in your terminal (Ctrl+C).\n" +
      "4. Restart the app with: npm run dev"
    );
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex items-center justify-center p-6 select-none relative">
      {/* Draggable window titlebar area for Electron */}
      <div className="absolute top-0 left-0 right-0 h-14 drag-region z-10" />

      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-2xl bg-bg-surface border border-border rounded-xl p-8 relative overflow-hidden animate-scale-in">
        {/* Glow indicator at the top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-accent to-success" />

        {/* Title / Logo */}
        <div className="flex items-center gap-3 mb-6">
          <Logo className="w-10 h-10" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">CommandCenter</h1>
            <p className="text-xs text-text-muted">Configuration Required</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Status warning card */}
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-3">
            <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
            <div className="text-xs text-warning leading-relaxed">
              <strong>Database Connection Missing:</strong> No valid Supabase credentials were found in your <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text-primary">.env</code> file. Follow the steps below to connect your local environment.
            </div>
          </div>

          {/* Stepper */}
          <div className="space-y-5">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-xs font-semibold text-accent">
                  1
                </div>
                <div className="w-0.5 h-full bg-border mt-2" />
              </div>
              <div className="flex-1 pb-4">
                <h3 className="text-sm font-semibold text-text-primary">Create a Supabase Project</h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Go to <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">supabase.com</a>, sign in or sign up, and create a new project. Give it a name like <code className="text-accent">command-center</code>.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-xs font-semibold text-accent">
                  2
                </div>
                <div className="w-0.5 h-full bg-border mt-2" />
              </div>
              <div className="flex-1 pb-4">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                  Run SQL Database Schema
                  <Database size={13} className="text-text-muted" />
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Open your project's <strong>SQL Editor</strong> in Supabase. Copy the contents of the migration file located at:
                </p>
                <div className="mt-2 p-2 bg-bg-elevated border border-border rounded flex items-center justify-between">
                  <code className="text-2xs text-text-primary font-mono">{sqlLocation}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-2xs"
                    onClick={() => copyToClipboard(sqlLocation, setCopiedSql)}
                  >
                    {copiedSql ? <Check size={11} className="text-success" /> : <Copy size={11} />}
                    <span className="text-[10px]">{copiedSql ? 'Copied Path' : 'Copy Path'}</span>
                  </Button>
                </div>
                <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                  Paste the SQL into the editor and click <strong>Run</strong>. This will set up the tables (<code className="text-accent">projects</code>, <code className="text-accent">issues</code>, <code className="text-accent">qa_items</code>, etc.) and pre-seed built-in automation rules.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-xs font-semibold text-accent">
                  3
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                  Configure Environment Variables
                  <Key size={13} className="text-text-muted" />
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Go to <strong>Project Settings → API</strong> in your Supabase dashboard. Copy your <strong>Project URL</strong> and <strong>Anon Public Key</strong>, then paste them into your <code className="text-accent">.env</code> file:
                </p>

                <div className="mt-3 relative rounded-lg border border-border overflow-hidden bg-bg-base font-mono">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-elevated">
                    <span className="text-2xs text-text-secondary">.env (Workspace Root)</span>
                    <button
                      onClick={() => copyToClipboard(envTemplate, setCopiedEnv)}
                      className="text-text-secondary hover:text-text-primary transition-colors"
                      aria-label="Copy environment template"
                    >
                      {copiedEnv ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <pre className="p-4 text-2xs leading-relaxed text-text-primary overflow-x-auto">
                    {envTemplate}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-border">
          <div className="flex items-center gap-2 text-text-muted">
            <RefreshCw size={13} className="animate-spin text-accent" />
            <span className="text-2xs">Waiting for valid settings...</span>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleRestartInfo}
            className="flex items-center gap-1.5"
          >
            <CheckCircle2 size={15} />
            How to Apply & Restart
          </Button>
        </div>
      </div>
    </div>
  );
}

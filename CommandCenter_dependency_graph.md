# CommandCenter — Complete Project Reference & Dependency Graph

> **Purpose:** Drop this file into any AI chat to give full context about the CommandCenter project.  
> **Generated from:** Source analysis of `/CommandCenter` workspace (v1.0.5)

---

## 1. Project Overview

**CommandCenter** is a cross-platform **Electron + React desktop app** for product/project management. It is a unified PM hub covering issues, QA, deployments, sprints, AI reports, and workflow automations — all backed by a hosted **Supabase** (PostgreSQL) database.

| Property | Value |
|---|---|
| App ID | `com.commandcenter.app` |
| Version | `1.0.5` |
| Entry (Electron) | `electron/main.js` |
| Entry (Renderer) | `src/main.jsx` → `src/App.jsx` |
| Auth | Supabase Google OAuth (allowlist-gated) |
| Database | Supabase (PostgreSQL) — hosted |
| AI Engine | Anthropic Claude (`claude-sonnet-4-20250514`) |
| Email | Nodemailer via SMTP (credentials stored in DB) |
| Build tool | Vite 6 + electron-builder 25 |
| UI Framework | React 18 + TailwindCSS 3 |
| State Management | Zustand 5 |
| Routing | React Router DOM 6 (HashRouter) |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron Shell                           │
│                                                                 │
│  ┌──────────────────────────────────────┐  ┌────────────────┐  │
│  │         Main Process (Node.js)       │  │  Renderer (V8) │  │
│  │                                      │  │                │  │
│  │  main.js ──► registerIpcHandlers()   │  │  React 18 App  │  │
│  │      ├── ipc/supabase.ipc.js         │◄─┤  (Vite bundle) │  │
│  │      ├── ipc/ai.ipc.js               │  │                │  │
│  │      ├── mailer.js                   │  │  window.electron│  │
│  │      ├── auth.js                     │  │  (preload API) │  │
│  │      ├── automations.js              │  └────────────────┘  │
│  │      └── cron.js                     │                       │
│  │                                      │                       │
│  │  preload.js ──► contextBridge        │                       │
│  └──────────────────────────────────────┘                       │
│                          │                                      │
│                    IPC Channels                                 │
│  (supabase:query, ai:generate, email:send, automation:trigger,  │
│   settings:get, settings:set, export:all, auth:start-login-flow)│
└─────────────────────────────────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Supabase   │
                    │ (PostgreSQL)│
                    │             │
                    │ Tables:     │
                    │ products    │
                    │ clients     │
                    │ projects    │
                    │ issues      │
                    │ qa_items    │
                    │ deployments │
                    │ sprints     │
                    │ ai_reports  │
                    │ automations │
                    │ settings    │
                    └─────────────┘
                           │
                    ┌──────▼──────┐
                    │  Anthropic  │
                    │ Claude API  │
                    └─────────────┘
```

---

## 3. Full File Inventory

### 3.1 Root

| File | Purpose |
|---|---|
| `package.json` | Dependencies, scripts, electron-builder config |
| `vite.config.js` | Vite bundler config for renderer |
| `tailwind.config.js` | TailwindCSS design tokens |
| `postcss.config.js` | PostCSS plugins |
| `index.html` | HTML shell — mounts `#root` |
| `.env` | Runtime secrets (Supabase URL/key, app name/version) — **never committed** |
| `.env.example` | Template for `.env` |
| `.gitignore` | Excludes `node_modules`, `dist`, `.env`, etc. |
| `commandcenter_logo.svg` | App logo SVG source |

### 3.2 `electron/` — Main Process

| File | Purpose |
|---|---|
| `main.js` | App entry point: creates BrowserWindow, loads env, registers IPC handlers, starts cron |
| `preload.js` | `contextBridge` — exposes `window.electron` API to renderer (secure IPC bridge) |
| `auth.js` | Local HTTP server (port 54321) for Google OAuth callback flow |
| `automations.js` | `AutomationEngine` class — evaluates rules and executes actions (QA entry, email, AI report) |
| `cron.js` | `node-cron` scheduler — built-in daily sprint summary (23:00) + dynamic DB-driven schedules |
| `mailer.js` | Nodemailer wrapper — reads SMTP credentials from `settings` table, sends emails |
| `generate-icons.js` | Dev utility — generates app icons for packaging |
| `ipc/supabase.ipc.js` | Singleton Supabase client for main process; generic `handleSupabaseIpc` proxy |
| `ipc/ai.ipc.js` | `handleAiGenerate` — reads Claude API key from DB, calls Anthropic SDK, offline mock fallback |

### 3.3 `src/` — Renderer Process

#### Entry

| File | Purpose |
|---|---|
| `main.jsx` | React DOM root mount |
| `App.jsx` | Auth gate, routing root, `ToastProvider` wrapper |
| `index.css` | Global CSS: design tokens, layout utilities, component classes |

#### `src/lib/` — Shared Utilities

| File | Purpose |
|---|---|
| `supabase.js` | Renderer Supabase client singleton + `checkIsConfigured()` |
| `claude.js` | Renderer-side prompt templates + `generateReport()` → IPC bridge caller |
| `constants.js` | All enums, status labels, color maps, JSDoc type definitions (single source of truth) |

#### `src/store/` — Zustand Stores (Global State)

| File | Supabase Table | Key State |
|---|---|---|
| `useAuthStore.js` | `auth` (Supabase Auth) | `session`, `user`, `loginWithGoogle()`, `logout()` |
| `useProductStore.js` | `products` | `products[]`, CRUD actions |
| `useClientStore.js` | `clients` | `clients[]`, CRUD actions |
| `useProjectStore.js` | `projects` | `projects[]`, CRUD actions |
| `useIssueStore.js` | `issues` | `issues[]`, filters, CRUD + status transitions |
| `useQAStore.js` | `qa_items` | `qaItems[]`, CRUD actions |
| `useDeploymentStore.js` | `deployments` | `deployments[]`, CRUD actions |
| `useSprintStore.js` | `sprints` | `sprints[]`, CRUD actions |
| `useAutomationStore.js` | `automations` | `automations[]`, CRUD, enable/disable |

#### `src/hooks/` — Custom Hooks

| File | Purpose |
|---|---|
| `useAI.js` | `generate()` (saves to `ai_reports`) + `generateInline()` (returns content only) — wraps `claude.js` |
| `useAutomations.js` | `trigger(triggerType, data)` — client-side condition check → IPC `automation:trigger` |
| `useSupabaseQuery.js` | `useSupabaseQuery(queryFn, deps)` generic data-fetching hook + `useSupabaseRow(table, id)` |

#### `src/components/layout/`

| File | Purpose |
|---|---|
| `Layout.jsx` | Shell: `<Sidebar>` + `<TopBar>` + `<Outlet>` |
| `Sidebar.jsx` | Nav links, user profile card, logout button; reads `useAuthStore` |
| `TopBar.jsx` | Page title bar |

#### `src/components/shared/`

| File | Purpose |
|---|---|
| `Logo.jsx` | SVG logo component |
| `AIGenerateButton.jsx` | Reusable "Generate with AI" button with loading state |
| `StatusBadge.jsx` | Colored badge for status values (uses `STATUS_COLORS` from constants) |
| `PriorityBadge.jsx` | Colored badge for priority values (uses `PRIORITY_COLORS` from constants) |

#### `src/components/ui/` — Primitive UI Components

| File | Purpose |
|---|---|
| `Button.jsx` | Primary/secondary/ghost/danger variants |
| `Input.jsx` | Styled text input |
| `Textarea.jsx` | Styled textarea |
| `Select.jsx` | Styled `<select>` |
| `Badge.jsx` | Generic badge |
| `Card.jsx` | Container card |
| `Dialog.jsx` | Modal dialog |
| `ConfirmDialog.jsx` | Confirmation modal with Yes/Cancel |
| `Dropdown.jsx` | Custom dropdown menu |
| `Toast.jsx` | Toast notification system + `ToastProvider` + `useToast()` hook |

#### `src/components/`

| File | Purpose |
|---|---|
| `ErrorBoundary.jsx` | React error boundary — catches renderer crashes |

#### `src/pages/` — Route-Level Views

| File | Route | Supabase Tables Used |
|---|---|---|
| `Dashboard.jsx` | `/dashboard` | `projects`, `issues`, `deployments`, `sprints` |
| `Products.jsx` | `/products` | `products` |
| `Clients.jsx` | `/clients` | `clients`, `projects` |
| `Projects.jsx` | `/projects` | `projects`, `clients`, `products` |
| `Issues.jsx` | `/issues` | `issues`, `projects`, `sprints` |
| `QATracker.jsx` | `/qa` | `qa_items`, `projects`, `issues` |
| `Deployments.jsx` | `/deployments` | `deployments`, `projects` |
| `Sprints.jsx` | `/sprints` | `sprints`, `issues` |
| `Automations.jsx` | `/automations` | `automations` |
| `AIReports.jsx` | `/ai-reports` | `ai_reports` |
| `Settings.jsx` | `/settings` | `settings` (via `window.electron.settings`) |
| `Login.jsx` | *(pre-auth)* | Supabase Auth (Google OAuth) |
| `Setup.jsx` | *(pre-config)* | None — shown if `.env` is unconfigured |
| `AccessDenied.jsx` | *(pre-auth)* | None — shown if email not in allowlist |

### 3.4 `supabase/migrations/`
SQL migration files for the Supabase database schema.

---

## 4. Dependency Graph — Module-Level

### 4.1 Electron Main Process

```mermaid
graph TD
    main["electron/main.js\n(App Entry)"]
    preload["electron/preload.js\n(contextBridge)"]
    auth["electron/auth.js\n(OAuth Server)"]
    automations["electron/automations.js\n(AutomationEngine)"]
    cron["electron/cron.js\n(node-cron)"]
    mailer["electron/mailer.js\n(Nodemailer)"]
    supabase_ipc["electron/ipc/supabase.ipc.js\n(Main-Process Supabase Client)"]
    ai_ipc["electron/ipc/ai.ipc.js\n(Claude API)"]

    main --> preload
    main --> auth
    main --> automations
    main --> cron
    main --> mailer
    main --> supabase_ipc
    main --> ai_ipc

    automations --> supabase_ipc
    automations --> ai_ipc
    automations --> mailer

    cron --> supabase_ipc
    cron --> automations

    mailer --> supabase_ipc
    ai_ipc --> supabase_ipc
```

### 4.2 Renderer Process

```mermaid
graph TD
    mainJsx["src/main.jsx"]
    AppJsx["src/App.jsx\n(Auth Gate + Router)"]
    Layout["components/layout/Layout.jsx"]
    Sidebar["components/layout/Sidebar.jsx"]
    TopBar["components/layout/TopBar.jsx"]

    libSupa["src/lib/supabase.js\n(Renderer Supabase Client)"]
    libClaude["src/lib/claude.js\n(Prompt Templates + IPC call)"]
    libConsts["src/lib/constants.js\n(Enums, Types, Colors)"]

    authStore["store/useAuthStore.js"]
    prodStore["store/useProductStore.js"]
    clientStore["store/useClientStore.js"]
    projStore["store/useProjectStore.js"]
    issueStore["store/useIssueStore.js"]
    qaStore["store/useQAStore.js"]
    deployStore["store/useDeploymentStore.js"]
    sprintStore["store/useSprintStore.js"]
    autoStore["store/useAutomationStore.js"]

    hookAI["hooks/useAI.js"]
    hookAuto["hooks/useAutomations.js"]
    hookQuery["hooks/useSupabaseQuery.js"]

    Toast["components/ui/Toast.jsx"]

    mainJsx --> AppJsx
    AppJsx --> Layout
    AppJsx --> libSupa
    AppJsx --> authStore
    AppJsx --> Toast

    Layout --> Sidebar
    Layout --> TopBar
    Sidebar --> authStore
    Sidebar --> Toast

    authStore --> libSupa
    prodStore --> libSupa
    clientStore --> libSupa
    projStore --> libSupa
    issueStore --> libSupa
    qaStore --> libSupa
    deployStore --> libSupa
    sprintStore --> libSupa
    autoStore --> libSupa

    hookAI --> libClaude
    hookAI --> libSupa
    hookAuto --> libSupa

    hookQuery --> libSupa
    libClaude --> libConsts
```

### 4.3 IPC Bridge (Renderer ↔ Main)

```mermaid
sequenceDiagram
    participant R as Renderer (React)
    participant P as preload.js (contextBridge)
    participant M as main.js (IPC handlers)
    participant S as Supabase
    participant C as Claude API
    participant E as Email (SMTP)

    R->>P: window.electron.ai.generate(prompt, type)
    P->>M: ipcMain.handle('ai:generate')
    M->>S: Fetch claude_api_key from settings
    M->>C: anthropic.messages.create(...)
    C-->>M: content
    M-->>R: { content, error }

    R->>P: window.electron.settings.set(key, value)
    P->>M: ipcMain.handle('settings:set')
    M->>S: upsert into settings table
    M-->>R: { success }

    R->>P: window.electron.email.send(opts)
    P->>M: ipcMain.handle('email:send')
    M->>S: Fetch SMTP credentials from settings
    M->>E: nodemailer.sendMail(...)
    E-->>M: messageId
    M-->>R: { success, messageId }

    R->>P: window.electron.automation.trigger(id, data)
    P->>M: ipcMain.handle('automation:trigger')
    M->>S: Fetch automation by ID
    M->>M: AutomationEngine.executeAction()
    M-->>R: { success }

    R->>P: window.electron.auth.startLoginFlow(authUrl)
    P->>M: ipcMain.handle('auth:start-login-flow')
    M->>M: startAuthServer() on :54321
    M-->>R: { accessToken, refreshToken }
```

---

## 5. IPC Channel Reference

| Channel | Direction | Handler File | What It Does |
|---|---|---|---|
| `supabase:query` | R→M | `ipc/supabase.ipc.js` | Generic Supabase proxy (select/insert/update/delete/upsert) |
| `ai:generate` | R→M | `ipc/ai.ipc.js` | Calls Claude API; falls back to mock if no key |
| `email:send` | R→M | `mailer.js` | Sends email via Nodemailer using SMTP from DB |
| `automation:trigger` | R→M | `automations.js` | Manually triggers an automation by ID |
| `settings:get` | R→M | `main.js` (inline) | Reads a single key from `settings` table |
| `settings:set` | R→M | `main.js` (inline) | Upserts a key/value into `settings` table |
| `export:all` | R→M | `main.js` (inline) | Exports all 9 tables as a single JSON payload |
| `auth:start-login-flow` | R→M | `auth.js` | Hosts OAuth callback server + opens browser |

---

## 6. Supabase Database Schema

### Tables

| Table | Primary Key | Notable Columns |
|---|---|---|
| `products` | `id` (uuid) | `name`, `description`, `status`, `tech_stack[]`, `client_id` |
| `clients` | `id` (uuid) | `name`, `contact_email`, `company`, `status` |
| `projects` | `id` (uuid) | `name`, `status`, `priority`, `category`, `tech_stack[]`, `deadline`, `client_id`, `product_id` |
| `issues` | `id` (uuid) | `title`, `description`, `status`, `priority`, `labels[]`, `project_id`, `sprint_id`, `team`, `environment`, `assignee`, `completed_at` |
| `qa_items` | `id` (uuid) | `test_case`, `project_id`, `issue_id`, `module`, `test_type`, `severity`, `status`, `steps_to_reproduce`, `expected_result`, `actual_result`, `environment`, `tested_on` |
| `deployments` | `id` (uuid) | `name`, `project_id`, `environment`, `status`, `services_affected[]`, `rollback_plan`, `expected_downtime`, `deployed_at` |
| `sprints` | `id` (uuid) | `name`, `status`, `start_date`, `end_date`, `goals`, `ai_summary`, `completed_tasks_count` |
| `ai_reports` | `id` (uuid) | `type`, `title`, `content`, `related_id`, `related_type`, `is_draft` |
| `automations` | `id` (uuid) | `name`, `enabled`, `trigger_type`, `trigger_config` (jsonb), `action_type`, `action_config` (jsonb), `last_triggered_at`, `trigger_count` |
| `settings` | `key` (text) | `value` (text), `updated_at` — stores SMTP creds, Claude API key, feature flags |

### Relationships

```
clients ──┐
          ├──► projects ──► issues ──► qa_items
products ─┘         │
                     └──► deployments
                     └──► sprints ──► issues (sprint_id FK)

issues ──────────────────► ai_reports (related_id)
deployments ─────────────► ai_reports (related_id)
automations (standalone — trigger evaluates against any entity)
settings (standalone key-value store)
```

---

## 7. Domain Enums (from `src/lib/constants.js`)

### Issue Statuses (with valid transitions)
```
backlog → todo → in_progress → testing → uat → ready_to_deploy → production → monitoring → done
                                                                           ↘ rolled_back
Any → cancelled → backlog
```

### Other Enums

| Domain | Values |
|---|---|
| Project Status | `active`, `on_hold`, `completed`, `blocked` |
| Project Priority | `p0` (Critical), `p1` (High), `p2` (Medium), `p3` (Low) |
| Project Category | `fyp`, `coursework`, `client`, `personal` |
| Issue Teams | `backend`, `frontend`, `qa`, `ops`, `app` |
| Issue Environments | `local`, `staging`, `production` |
| QA Status | `to_test`, `in_progress`, `pass`, `fail`, `blocked` |
| QA Severity | `critical`, `high`, `medium`, `low` |
| QA Test Type | `functional`, `ui`, `integration`, `regression`, `edge_case` |
| Deployment Status | `planned`, `in_progress`, `success`, `failed`, `rolled_back` |
| Deployment Envs | `dev`, `staging`, `production` |
| Sprint Status | `upcoming`, `active`, `completed` |
| AI Report Types | `rca`, `sprint_summary`, `deployment_note`, `test_summary` |
| Automation Triggers | `issue_created`, `issue_status_changed`, `deployment_completed`, `schedule` |
| Automation Actions | `create_qa_entry`, `send_email`, `generate_ai_report`, `create_notion_page`* |

> *`create_notion_page` is a placeholder — not implemented in v1.

---

## 8. Authentication Flow

```mermaid
flowchart TD
    A[App starts] --> B{checkIsConfigured?}
    B -- No --> C[Show Setup page\nconfigure .env]
    B -- Yes --> D[supabase.auth.getSession]
    D --> E{Session exists?}
    E -- No --> F[Show Login page]
    F --> G[User clicks Google Sign In]
    G --> H[supabase.auth.signInWithOAuth\nskipBrowserRedirect: true]
    H --> I[IPC: auth:start-login-flow\nstartAuthServer on :54321]
    I --> J[System browser opens\nGoogle OAuth]
    J --> K[Callback hits localhost:54321/callback]
    K --> L[/token endpoint extracts tokens]
    L --> M[IPC resolves with accessToken + refreshToken]
    M --> N[supabase.auth.setSession]
    N --> O{Email in ALLOWED_EMAILS?}
    O -- No --> P[Show AccessDenied page]
    O -- Yes --> Q[Show full app with HashRouter]
    E -- Yes --> O
```

**Allowed emails (hardcoded in `App.jsx`):**
- `kayastha.noor1100@gmail.com`
- `niroj.mahrjan@gmail.com`

---

## 9. Automation Engine Flow

```mermaid
flowchart TD
    T1[Issue Created] --> AE
    T2[Issue Status Changed] --> AE
    T3[Deployment Completed] --> AE
    T4[Cron Schedule] --> AE

    AE["AutomationEngine.evaluate(triggerType, data)"]
    AE --> DB[(Fetch enabled automations\nmatching trigger_type)]
    DB --> COND{evaluateConditions\nlabels / status /\nenvironment / priority /\nproject_id}
    COND -- Fail --> SKIP[Skip]
    COND -- Pass --> ACT[executeAction]

    ACT --> QA[create_qa_entry\n→ INSERT qa_items]
    ACT --> EMAIL[send_email\n→ mailer.js → SMTP]
    ACT --> REPORT[generate_ai_report\n→ ai.ipc.js → Claude\n→ INSERT ai_reports]
    ACT --> NOTION[create_notion_page\n⚠ Not implemented]

    QA & EMAIL & REPORT --> REC[recordTrigger\nupdate last_triggered_at\n+ trigger_count++]
```

**Trigger Sources:**
1. **Renderer hooks** (`useAutomations.js`) — fires after mutations (issue created, deployment completed)
2. **`cron.js`** — built-in daily sprint summary at 23:00; dynamic schedules from DB
3. **IPC `automation:trigger`** — manual trigger from Automations UI page

---

## 10. React Routing Table

All routes are rendered inside `HashRouter` (Electron-compatible).

| Path | Component | Description |
|---|---|---|
| `/` | → redirect | Redirects to `/dashboard` |
| `/dashboard` | `Dashboard.jsx` | Overview stats, recent activity |
| `/products` | `Products.jsx` | Product catalogue CRUD |
| `/clients` | `Clients.jsx` | Client management CRUD |
| `/projects` | `Projects.jsx` | Projects kanban/table CRUD |
| `/issues` | `Issues.jsx` | Issue tracker with filters + status transitions |
| `/qa` | `QATracker.jsx` | QA test cases CRUD + status tracking |
| `/deployments` | `Deployments.jsx` | Deployment log CRUD + AI notes |
| `/sprints` | `Sprints.jsx` | Sprint management + AI summary generation |
| `/automations` | `Automations.jsx` | Automation rule builder + manual trigger |
| `/ai-reports` | `AIReports.jsx` | AI-generated report viewer + editor |
| `/settings` | `Settings.jsx` | SMTP, Claude API key, feature flags |

Pre-auth screens (not in HashRouter):
- `Setup.jsx` — shown when `.env` is missing/unconfigured
- `Login.jsx` — Google OAuth login screen
- `AccessDenied.jsx` — email not in allowlist

---

## 11. AI Report Generation Flow (Renderer-initiated)

```
Page (e.g. Issues.jsx)
  └── useAI.js → generate(type, data, meta)
        └── src/lib/claude.js → generateReport(type, data)
              └── PROMPTS[type](data)  ← builds prompt string
                    └── window.electron.ai.generate(prompt, type)  ← IPC
                          └── electron/ipc/ai.ipc.js → handleAiGenerate()
                                ├── getClaudeApiKey()  ← reads from settings table
                                ├── IF key present: Anthropic SDK call
                                └── IF no key: generateMockReport()  ← offline fallback
                          └── returns { content, error }
        └── supabase.from('ai_reports').insert({ type, title, content, is_draft: true })
```

**Report types and their data sources:**

| Type | Data Passed | Prompt Template in |
|---|---|---|
| `rca` | `Issue` object | `claude.js` + `ai.ipc.js` |
| `sprint_summary` | `Issue[]` (completed today) | `claude.js` + `ai.ipc.js` |
| `deployment_note` | `Deployment` object | `claude.js` + `ai.ipc.js` |
| `test_summary` | `QAItem[]` | `claude.js` |

---

## 12. Zustand Store Pattern

All stores follow this consistent pattern:

```js
// Example: useProjectStore.js
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useProjectStore = create((set, get) => ({
  projects: [],
  loading: false,
  error: null,

  fetchProjects: async () => { ... },      // SELECT *
  addProject: async (data) => { ... },     // INSERT + update local state
  updateProject: async (id, data) => { ... }, // UPDATE + update local state
  deleteProject: async (id) => { ... },    // DELETE + update local state
}));
```

All stores write **directly to Supabase** from the renderer using `src/lib/supabase.js`. The IPC supabase proxy (`supabase:query`) is only used by the main process internally (automations, cron, settings, export).

---

## 13. Settings Keys (in `settings` table)

| Key | Purpose |
|---|---|
| `claude_api_key` | Anthropic API key for AI report generation |
| `smtp_host` | SMTP server hostname |
| `smtp_port` | SMTP port (default 587) |
| `smtp_user` | SMTP username / from email |
| `smtp_pass` | SMTP password |
| `notification_email` | Default recipient email for automation emails |
| `daily_summary_enabled` | `"true"/"false"` — toggles nightly sprint summary cron |

---

## 14. Key External Dependencies

| Package | Version | Used For |
|---|---|---|
| `electron` | ^35.3.0 | Desktop shell |
| `react` + `react-dom` | ^18.3.1 | UI framework |
| `react-router-dom` | ^6.30.1 | Client-side routing |
| `zustand` | ^5.0.4 | Global state management |
| `@supabase/supabase-js` | ^2.49.4 | Database client (renderer + main) |
| `@anthropic-ai/sdk` | ^0.36.3 | Claude AI (main process only) |
| `nodemailer` | ^6.10.1 | Email sending (main process only) |
| `node-cron` | ^3.0.3 | Scheduled jobs (main process only) |
| `lucide-react` | ^0.511.0 | Icon library |
| `recharts` | ^2.15.3 | Charts on Dashboard |
| `@tanstack/react-table` | ^8.21.3 | Data tables |
| `@hello-pangea/dnd` | ^17.0.0 | Drag-and-drop (Sprints board) |
| `react-hook-form` | ^7.56.4 | Form management |
| `zod` | ^3.24.4 | Form validation schemas |
| `react-markdown` | ^9.0.3 | Renders AI report markdown content |
| `date-fns` | ^4.1.0 | Date formatting |
| `tailwindcss` | ^3.4.17 | Utility CSS (dev) |
| `vite` | ^6.3.5 | Renderer bundler |
| `electron-builder` | ^25.1.8 | Packaging/distribution |

---

## 15. Build & Dev Scripts

```bash
# Development (runs Vite dev server + Electron simultaneously)
npm run dev

# Build for current platform
npm run build

# Build macOS (Intel + Apple Silicon universal)
npm run build:mac

# Build Windows
npm run build:win

# Build Linux
npm run build:linux

# Preview production Vite build in browser only
npm run preview

# Regenerate app icons from SVG source
npm run build:icons
```

**Output directories:**
- `dist/` — Vite production bundle (renderer)
- `dist-electron/` — electron-builder output (`.dmg`, `.exe`, `.AppImage`)

---

## 16. Environment Variables (`.env`)

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_NAME=CommandCenter
VITE_APP_VERSION=1.0.5
```

> `.env` is loaded by **both** Vite (at build time, injected via `import.meta.env`) and Electron main process (at runtime, parsed manually from file). All `VITE_` prefixed vars are available in both contexts.

---

## 17. Security Design Notes

- **No Node.js APIs in renderer** — `nodeIntegration: false`, `contextIsolation: true`
- **API keys never in renderer** — Claude key and SMTP password only accessed in main process via `settings` table query
- **Secrets sanitized in logs** — `ai.ipc.js` and `mailer.js` strip credentials from error messages before logging
- **OAuth via loopback** — Google auth callback on `localhost:54321` (no deep links), server auto-closes after 1s
- **Access control** — hardcoded email allowlist in `App.jsx`; unauthorized users see `AccessDenied` page
- **Single instance lock** — `app.requestSingleInstanceLock()` prevents multiple app instances

---

*End of CommandCenter Project Reference*

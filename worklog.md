# PGR Angola - Worklog

---
Task ID: 1
Agent: Main Agent
Task: Clone GitHub repo and integrate PGR Angola system into existing Next.js project

Work Log:
- Cloned repository from https://github.com/feliciofernando/PGR-Sistema-de-Controlo-de-Arguidos-em-Pris-o-Preventiva to /home/z/cloned-repo
- Examined full project structure: Next.js 16 + Supabase + Tailwind CSS + shadcn/ui + PWA support
- Copied all source files (page.tsx, layout.tsx, globals.css, supabase.ts)
- Copied all 9 API routes (auth, arguidos CRUD, stats, alertas, push notifications)
- Copied public assets (manifest.json, sw.js, icons/ directory)
- Copied scripts folder (generate_ficha.py, add_zai_metadata.py, sanitize_code.py)
- Configured .env.local with Supabase credentials (URL, Anon Key, Service Role Key)
- Updated next.config.ts with service worker headers and security cache settings
- Updated tailwind.config.ts with PGR theme colors
- Installed additional dependencies: @supabase/supabase-js, bcryptjs, web-push, recharts, date-fns, uuid, canvas, sharp
- Installed dev type dependencies: @types/bcryptjs, @types/web-push, @types/uuid
- Removed default /api/route.ts (replaced by PGR API routes)
- Verified linting passes with no errors
- Started dev server - all routes responding with 200 status

Stage Summary:
- Project fully integrated and running on port 3000
- API routes verified: GET /, POST /api/auth/login, GET /api/alertas, GET /api/stats all return 200
- Supabase connected with provided credentials
- No build or lint errors
- System ready for use via Preview Panel

---
Task ID: 1
Agent: general-purpose
Task: Fix git merge state and read all project files

Work Log:
- Resolved git merge conflicts (git merge --abort failed with "no merge to abort", git reset --merge succeeded)
- Verified git status clean — all file operations unblocked
- Read all project files for Flutter rebuild prompt

Stage Summary:
- Git state cleaned successfully
- All project files read for Flutter rebuild prompt

---
Task ID: 2
Agent: Main Agent
Task: Add public defendant process search on landing page below "Acessar Sistema" button

Work Log:
- Created `/api/arguidos/search-public/route.ts` — public API endpoint that searches by nome, número do processo, or ID
- API returns only limited/safe fields (no observations, no internal notes) for privacy
- Modified `LandingPage` component in `page.tsx` to add search section below "ACESSAR SISTEMA" button
- Added search form with input field and submit button, styled to match dark fog theme
- Added divider ("Pesquisa Pública") between access button and search
- Created `InfoPill` component for displaying compact summary fields (Detenção, Crime, Medida, Magistrado, Prazos)
- Each result card shows: name, ID, process number, status badge, 6 info pills with deadline indicators
- Added "no results" empty state with helpful message
- Added `fadeIn` keyframe animation in `globals.css` for smooth result appearance
- Changed landing page layout from `justify-center` to `justify-start` with padding to accommodate search results below fold
- Lint passes with no errors

Stage Summary:
- Public search endpoint: GET /api/arguidos/search-public?q=<term>
- Landing page now includes "Pesquisa Pública" section with search bar and result cards
- Search results show ficha resumida (summary card) with key defendant info
- Deadline badges show color-coded status (green/yellow/red) using existing helper functions

---
Task ID: 3
Agent: Main Agent
Task: Implement Phases 1-4 (Core Features) — Form Validation, Auto Status, Audit Log, History/Timeline

Work Log:
- Read entire codebase (page.tsx ~3300+ lines, all API routes, supabase.ts) to understand existing patterns
- Phase 1: Form Validation + Duplicate Detection
  - Added `formErrors`, `duplicateWarning`, `checkingDuplicates` state variables in AppContent
  - Created `validateForm()` function checking: nomeArguido required, numeroProcesso required, crime required, dataProrrogacao > dataMedidasAplicadas date logic
  - Created `checkDuplicates()` async function querying `/api/arguidos?search=NAME` for exact match (blocking) and similar name match (warning)
  - Updated `handleSubmitForm()` to validate → check duplicates → submit flow
  - Updated `FormFields` component to accept `formErrors` prop and display inline red error messages
  - Added duplicate warning banner in form dialog (amber styling with AlertTriangle icon)
  - Updated button to show loading spinner while checking duplicates
  - Reset form errors and duplicate warnings on form open/create/edit

- Phase 2: Auto Status Update API
  - Created `/api/arguidos/auto-status/route.ts` (GET endpoint)
  - Finds ativo records where fim_primeiro_prazo < today → updates to "vencido"
  - Finds vencido records where both prazos passed → updates to "encerrado"
  - Also handles ativo records where both prazos passed → encerrado directly
  - Returns counts of updated records

- Phase 3: Audit Log
  - Created `/api/audit/route.ts` with GET (paginated, filter by arguido_id) and POST endpoints
  - Updated `/api/arguidos/route.ts` POST handler to create audit log on creation ("criacao")
  - Updated `/api/arguidos/[id]/route.ts` PUT handler to compare old vs new values and create audit log for each changed field ("atualizacao")
  - Updated DELETE handler to log removal ("remocao") with existing record info before delete
  - Tracks 18 fields including computed deadline changes

- Phase 4: History/Timeline
  - Created `/api/arguidos/[id]/history/route.ts` combining audit_logs + alertas into unified timeline
  - Added `TimelineEntry` interface in page.tsx
  - Added "Linha do Tempo" section in DetailView with visual timeline component
  - Timeline shows: colored dots by action type (green=create, red=delete, blue=edit, orange=status, amber=alert)
  - Vertical connecting lines between entries
  - Old/new value diffs for field changes (red strikethrough → green)
  - Deadline urgency badges for alert entries
  - Username attribution for audit entries
  - Chronological order (most recent first)
  - Empty state and loading spinner states

- Fixed pre-existing lint error: replaced undefined `UsersView` component with placeholder Card
- All lint checks pass with 0 errors

Stage Summary:
- 4 new API routes created: auto-status, audit, history, and updated arguidos CRUD with audit logging
- Form now validates 3 required fields + date logic before submission
- Duplicate detection warns on exact match (blocking) and similar names (non-blocking)
- Full audit trail on create, update (per-field diff), and delete operations
- Visual timeline ("Linha do Tempo") in DetailView shows complete history of changes and alerts
- SQL table needed: audit_logs (id, arguido_id, user_id, username, action, field_changed, old_value, new_value, created_at)

---
Task ID: 4
Agent: Main Agent
Task: Implement Phases 5-6 — Document Attachments & Role-Based Permissions

Work Log:
- Read entire codebase (page.tsx ~3780 lines, all API routes) to understand existing patterns
- Phase 5: Document Attachments
  - API route `/api/documents/route.ts` already existed with GET, POST, DELETE — verified functionality
  - Added "Documentos Anexados" section in DetailView component with:
    - State management: documents list, loading, upload dialog state, file/category/description fields
    - Upload functionality: file input, category select (mandado/certidao/relatorio/outro), description textarea
    - Document list with: filename, category badge (color-coded), file size, date, description, download link, delete button
    - Loading spinner and empty state ("Nenhum documento anexado")
    - Upload dialog with validation, file size hint, accepted formats list
    - Delete with confirmation via toast feedback
    - Helper functions: getCategoryBadge(), getCategoryLabel() for category display
  - Uses existing formatFileSize() helper for file size display

- Phase 6: Role-Based Permissions
  - Updated ROLE_PERMISSIONS to match spec:
    - admin: create, edit, delete, export, view_all, view_own, manage_users, import
    - operador: create, edit, delete, export, view_all, import
    - magistrado: create, edit, view_own, export
    - consultor: view_all, export
  - Updated GestaoView component to accept permission props (canCreate, canEdit, canDelete, canExport)
    - "Novo" button hidden when !canCreate
    - "Exportar PDF" button hidden when !canExport
    - Edit icon hidden when !canEdit
    - PDF download icon hidden when !canExport
    - Delete icon hidden when !canDelete
    - "Criar novo registo" link in empty state hidden when !canCreate
  - Updated AppContent to pass permission booleans to GestaoView
  - Fixed RelatoriosView to accept all passed props (canExport, reportFilters, etc.) — previously caused unused prop warnings
  - Magistrado filtering already implemented in loadArguidos (params.set('magistrado', authUser.nome))
  - Removed unused onImport/userRole props from GestaoView call in AppContent
  - Utilizadores nav item already conditionally shown via canPerform('manage_users')

- Phase 6: Utilizadores Management (admin only)
  - Built full UtilizadoresView component replacing placeholder Card:
    - User list table with: username, nome, role (inline Select dropdown), estado (Badge), último login, criado em
    - Role change: inline Select dropdown with color-coded triggers (admin=red, operador=blue, magistrado=amber, consultor=green)
    - Active/Inactive toggle: Lock/Unlock icon button with PATCH to /api/users
    - Create new user dialog: username, password, nome, role fields
    - Loading spinner and empty state
    - Toast notifications for all actions
  - Added Unlock icon import from lucide-react
  - Connected to existing API: GET /api/users (list), POST /api/users (create), PATCH /api/users (update role/status)

- All lint checks pass with 0 errors

Stage Summary:
- Document attachment section fully functional in DetailView with upload, download, delete
- Role-based permissions enforced: admin=all, operador=CRUD+export, magistrado=create+edit+export(view_own), consultor=view+export
- Utilizadores management page complete: user list, role change dropdown, activate/deactivate toggle, create user dialog
- API routes used: /api/documents (GET/POST/DELETE), /api/users (GET/POST/PATCH)
- SQL table needed: documents (id, arguido_id, file_name, file_path, file_size, file_type, category, description, url, created_at)
- Supabase Storage bucket needed: "documents" (public)

---
Task ID: 5
Agent: Main Agent
Task: Implement Phases 7-8 — Advanced Reports with Date Range & CSV Import

Work Log:
- Read entire codebase (page.tsx ~3800+ lines, all API routes) to understand existing patterns
- Discovered existing infrastructure: reportFilters state, loadReportStats function, handleExportReportPdf, CSV import route, canPerform permissions

- Phase 7: Advanced Reports with Date Range
  - Created `/api/relatorios/advanced/route.ts` (POST endpoint):
    - Accepts JSON body: { dateFrom, dateTo, crime, status, magistrado }
    - Queries arguidos table with all filter combinations
    - Returns: totalArguidos, ativos, vencidos, encerrados, prazosProximos, prazosCriticos, processosUrgentes, crimes distribution, magistrados distribution, monthlyCounts, statusCounts, filteredArguidos
    - Uses existing supabase client and toCamelCaseDeep utility

  - Updated `loadReportStats` function to POST to `/api/relatorios/advanced` instead of GET `/api/stats`
    - Maps reportFilters.startDate → dateFrom, reportFilters.endDate → dateTo

  - Rewrote `RelatoriosView` component with full filter UI:
    - Updated function signature to accept all passed props: stats, reportFilters, setReportFilters, onApplyFilters, reportLoading, onExportPdf, canExport
    - Added "Filtros Avançados" card with:
      - Data Início (date input)
      - Data Fim (date input)
      - Crime (select from CRIMES_LIST)
      - Status (select: ativo/vencido/encerrado)
      - Magistrado (text input)
      - "Filtrar" button (calls onApplyFilters)
      - "Limpar Filtros" button (resets all filters)
      - Active filters badge indicator
    - Added loading state with spinner
    - Added empty/initial state
    - Added "Exportar Relatório" button in header (triggers PDF export of filtered data)
    - Added "Distribuição por Status" card with progress bars and percentage breakdowns
    - All existing charts (crimes pie, magistrado bar, monthly line) update with filtered data

- Phase 8: Import Data from CSV
  - Backend `/api/arguidos/import/route.ts` already existed:
    - Verified CSV parsing, header validation, row validation, Supabase insert
    - Added `crime` as required field validation (was only checking nome_arguido)
    - Uses validated `crime` variable instead of re-querying getValue

  - Added CSV import UI in GestaoView:
    - "Importar CSV" button next to "Exportar PDF" (shown when canImport=true)
    - Added canImport prop to GestaoView (passed from AppContent via canPerform('import'))
    - CSV Import Dialog with:
      - File upload input (accept=".csv")
      - Required fields hint (nome_arguido, crime)
      - "Descarregar modelo CSV" link — generates sample CSV template with headers + example row
      - "Importar" button with loading spinner state
      - "Cancelar" button
    - After successful import: toast with success/error counts, auto-close dialog, refresh data
    - Error handling: network errors, server validation errors, file validation

  - Removed unused csvDialogOpen state from AppContent (dialog now managed inside GestaoView)
  - All lint checks pass with 0 errors

Stage Summary:
- New API route: POST /api/relatorios/advanced — filtered report with aggregated stats
- RelatoriosView now has complete filter UI with date range, crime, status, magistrado
- Charts and summary cards update dynamically based on applied filters
- "Exportar Relatório" button generates landscape PDF of filtered data
- CSV import UI with dialog, template download, validation, and toast results
- No new SQL tables needed (uses existing arguidos table)

---
Task ID: 6
Agent: Main Agent
Task: Implement Phases 13-14 — Magistrado Dashboard Personalization & Full Data Backup/Export

Work Log:
- Read entire codebase (page.tsx ~4700 lines, all API routes) to understand existing patterns
- Verified existing infrastructure: magistrado filtering on stats API, alertas API, loadInitialData

- Phase 13: Magistrado Dashboard Personalization
  - Updated DashboardView component signature to accept `authUser` prop
  - Added `isMagistrado` check: `authUser?.role === 'magistrado'`
  - Added personalized welcome banner at top of dashboard when magistrado:
    - Teal-to-cyan gradient background with Scale icon
    - "Bem-vindo, [Nome do Magistrado]"
    - "Aqui estão os seus processos sob supervisão"
  - Updated dashboard title/subtitle to show "Painel do Magistrado" with contextual subtitle
  - Updated `loadInitialData` to filter alertas by magistrado when role === 'magistrado'
    - Alertas URL includes `?magistrado=NAME` parameter for Supabase FK join filtering
  - Updated `/api/alertas/route.ts` GET handler:
    - Added `magistrado` query parameter support
    - Extended select to include `magistrado` from joined arguido table
    - Filters alertas by `arguido.magistrado` using Supabase join syntax
  - Stats filtering already working server-side (magistradoParam on /api/stats)
  - Charts, KPI cards, urgent processes table all filtered via server-side stats API

- Phase 14: Full Data Backup/Export
  - Enhanced `/api/backup/route.ts` (GET):
    - Parallel fetch of 4 tables: arguidos, alertas, audit_logs, documents
    - New structure: `{ version: "1.0", exportDate, system, counts, data: { arguidos, alertas, auditLogs, documents } }`
    - Documents exported as metadata only (no binary data)
    - Filename format: `backup_pgr_YYYY-MM-DD_HHmmss.json`
    - Partial error handling with warnings array
    - Backward-compatible with legacy format (metadata + arguidos/alertas)
  - Rewrote `/api/backup/restore/route.ts` (POST):
    - Supports both v1.0 format (version + data) and legacy format (metadata + arguidos)
    - Upsert logic: for each record, check if ID exists → update, else insert
    - Restores all 4 tables: arguidos, alertas, audit_logs, documents
    - Returns: `{ restored: { arguidos, alertas, auditLogs, documents }, errors: [] }`
    - Individual error tracking per record with detailed messages
    - Auto-generated fields (id, createdAt, updatedAt, numeroId) stripped before insert

  - Added "Sistema" nav item in page.tsx:
    - Only visible when `authUser?.role === 'admin'`
    - Uses Shield icon from lucide-react
    - Added "sistema" to valid URL view parameter list

  - Created SistemaView component (~260 lines):
    - System info cards (3 cards): Total Arguidos, Total Utilizadores, DB Status
    - "Exportar Backup Completo" button: calls GET /api/backup, downloads JSON file
    - "Restaurar Backup" button: opens dialog with file input (.json)
    - Restore dialog with file input, warning message, red "Restaurar" button
    - Warning banner: "A restauração irá sobrepor dados existentes"
    - Restore results display: 4-count grid (arguidos, alertas, auditLogs, documents)
    - Error list display with scrollable list when errors occur
    - Loading states for export (spinner) and restore (spinner)
    - Toast notifications for success/error feedback

- All lint checks pass with 0 errors

Stage Summary:
- Magistrado dashboard shows personalized welcome banner and filters all data by magistrado name
- Alertas API now supports magistrado filter via Supabase FK join
- Backup API exports all 4 tables with versioned format and timestamped filename
- Restore API supports upsert (update or insert) with error tracking per record
- Sistema nav item (admin only) with full backup/restore UI and system info
- Modified files: src/app/page.tsx, src/app/api/backup/route.ts, src/app/api/backup/restore/route.ts, src/app/api/alertas/route.ts
- No new SQL tables needed (uses existing: arguidos, alertas, audit_logs, documents)

---
Task ID: 7
Agent: Main Agent
Task: Implement Phases 9-10 — Print Individual Ficha & Dark Mode

Work Log:
- Read entire worklog and codebase (page.tsx ~4550 lines, globals.css) to understand existing patterns
- Verified next-themes v0.4.6 already installed in package.json
- Verified globals.css already had basic @media print styles from previous work

- Phase 9: Print Individual Ficha
  - Added `Printer` icon import from lucide-react
  - Added "Imprimir" button in DetailView DialogFooter (between PDF and Eliminar buttons)
    - Button uses outline variant with stone styling matching existing Fechar button
    - Calls `window.print()` on click
  - Enhanced @media print CSS in globals.css:
    - A4 page margins: 18mm top, 12mm sides, 22mm bottom
    - @page margin boxes: "PGR ANGOLA — Ficha de Arguido" header, page number footer
    - Hides: header, footer, nav, buttons, dialogs, modals, overlays, sticky elements, alerts
    - Forces [role="dialog"] visible with static positioning, no shadow/border
    - Hides DialogFooter in print
    - DialogHeader shows with bottom border separator
    - Table cells have 1px solid #ccc borders, even rows get #fafafa background
    - Badge colors render as gray (#e5e7eb background, #374151 text)
    - All backgrounds forced transparent/white, text black
    - Separator lines use #ccc border
    - Progress bars use gray background
    - Print color adjust for webkit and standard

- Phase 10: Dark Mode
  - Imported `ThemeProvider` and `useTheme` from next-themes
  - Created `ThemeToggle` component:
    - Uses useTheme() hook with mounted guard for SSR hydration safety
    - Sun icon shown in dark mode, Moon icon in light mode
    - Ghost button with dark hover states
    - Tooltip showing current mode label ("Modo Claro" / "Modo Escuro")
  - Wrapped AppContent return with ThemeProvider (attribute="class", defaultTheme="light", enableSystem=false)
  - Added ThemeToggle button in desktop header (before Bell icon) and mobile nav (before Bell/Sair icons)

  - Applied dark: Tailwind classes to key UI elements:
    - Header: `dark:bg-gray-900/95 dark:border-gray-800`
    - Main content: `dark:bg-gray-950`
    - Footer: `dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800`
    - Desktop nav active: `dark:bg-orange-600 dark:hover:bg-orange-700`
    - Desktop nav inactive: `dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800`
    - Mobile nav inactive: `dark:text-gray-400 dark:hover:bg-gray-800`
    - All cards (30+): `dark:bg-gray-900 dark:border-gray-800`
    - All inputs/selects: `dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 dark:placeholder:text-gray-500`
    - All labels: `dark:text-gray-100`
    - All headings (h2): `dark:text-gray-100`
    - Card titles (h3/h4): `dark:text-gray-100`
    - All table rows: `dark:bg-gray-800` / `dark:bg-gray-800/60` alternating, `dark:hover:bg-gray-700`, `dark:text-gray-100`
    - Selected table row: `dark:bg-gray-700/70 dark:ring-gray-400`
    - Outline buttons: `dark:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-100 dark:border-gray-700`
    - Primary outline button: `dark:hover:bg-orange-900/20 dark:bg-gray-800`
    - Bell/logout buttons: dark hover states
    - Divider: `dark:bg-gray-700`
    - User name: `dark:text-gray-100`
    - Footer link: `dark:text-gray-400 dark:hover:text-gray-200 dark:decoration-gray-600`
    - Dialog content: `dark:border-gray-800 dark:text-gray-100`
  - Did NOT modify LandingPage or LoginPage (custom dark backgrounds)

- All lint checks pass with 0 errors
- Dev server compiles successfully

Stage Summary:
- Print button ("Imprimir") added in DetailView dialog footer, calls window.print()
- Comprehensive @media print CSS with A4 margins, header/footer, hidden controls, gray badges, table borders
- Dark mode toggle (Sun/Moon) added to both desktop and mobile header areas
- ThemeProvider wraps AppContent with class-based dark mode
- 100+ dark: classes applied across all admin panel components
- LandingPage and LoginPage unchanged (already have custom dark backgrounds)
- No new SQL tables needed
- No new API routes needed

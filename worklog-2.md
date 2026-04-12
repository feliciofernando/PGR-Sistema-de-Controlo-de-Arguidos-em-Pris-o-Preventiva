---
Task ID: 4
Agent: Main Agent
Task: Implement remaining improvements - dark mode, countdown, accessibility, notifications

Work Log:
- Added useCountdown hook and CountdownDisplay component for real-time deadline tracking (updates every second)
- Fixed dark mode inconsistencies across KPI cards, DetailView, timeline, documents
- Added real-time countdown to DetailView, DashboardView urgent table, GestãoView table
- Improved in-app notification: auto-dismiss 15s, progress bar, ARIA roles
- Added accessibility: ARIA roles on header/nav/main/footer, aria-current on nav, focus-visible styles
- Enhanced skeleton loading for UtilizadoresView
- Added shrink CSS animation for notification progress bar

Stage Summary:
- Dark mode fully consistent across all views
- Real-time countdown timers on 3 views
- Non-blocking notification with auto-dismiss
- Accessibility improvements with ARIA and keyboard focus

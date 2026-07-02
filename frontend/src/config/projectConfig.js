// ============================================================
// PROJECT CONFIG
// ============================================================
// Single source of truth for project-level metadata. This is
// consumed by AppContext so any component can read "what is
// this project, what phase are we in, what's the stack" without
// digging through docs. Update PHASES as each phase ships.
// ============================================================

export const PROJECT_CONFIG = {
  name: 'Multi-Tenant SaaS CRM',
  description:
    'A B2B SaaS/CRM hybrid demonstrating real multi-tenant architecture: tenant isolation, RBAC, audit logging, and tenant-aware APIs.',
  stack: {
    frontend: ['React', 'Vite', 'Tailwind CSS', 'Zustand', 'React Router', 'Axios'],
    backend: ['Node.js', 'Express', 'PostgreSQL (Row-Level Security)', 'JWT'],
  },
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  designTokens: {
    background: { dark: '#0B1220', light: '#F8FAFC' },
    surface: { dark: '#111827', light: '#FFFFFF' },
    brandPrimary: '#4F46E5',
    brandAccent: '#06B6D4',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  roles: ['owner', 'admin', 'manager', 'member', 'viewer'],
  phases: [
    { id: 1, name: 'Foundation', status: 'complete' },
    { id: 2, name: 'Auth & Tenant Onboarding', status: 'complete' },
    { id: 3, name: 'Role-Based Access Control', status: 'complete' },
    { id: 4, name: 'Core CRM Module', status: 'complete' },
    { id: 5, name: 'Dashboard & Analytics', status: 'complete' },
    { id: 6, name: 'Audit Logs & Notifications', status: 'complete' },
    { id: 7, name: 'Billing & Subscriptions', status: 'complete' },
    { id: 8, name: 'Security Hardening & Polish', status: 'complete' },
  ],
};

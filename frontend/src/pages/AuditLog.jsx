// ============================================================
// AUDIT LOG PAGE — Phase 6
// ============================================================
// Read-only trail of who did what: invites, role changes,
// removals, and CRM create/update/delete/stage-change events.
// Written by backend/src/utils/auditLog.js from team.js,
// contacts.js, and deals.js. Admin/owner only (view_audit_log).
// ============================================================
import { useEffect, useState } from 'react';
import {
  ScrollText, UserPlus, UserCog, UserMinus, FilePlus, FilePen, FileX,
  Briefcase, ArrowRightLeft, ChevronLeft, ChevronRight, CreditCard,
} from 'lucide-react';
import { getAuditLog, getAuditActions } from '../api/auditLog.js';
import { useApp } from '../context/AppContext.jsx';
import PermissionGate from '../components/PermissionGate.jsx';

const ACTION_META = {
  'member.invited':      { label: 'Member invited',    icon: UserPlus,       color: 'text-brand' },
  'member.role_changed': { label: 'Role changed',      icon: UserCog,        color: 'text-status-warning' },
  'member.removed':      { label: 'Member removed',    icon: UserMinus,      color: 'text-status-error' },
  'contact.created':     { label: 'Contact created',   icon: FilePlus,       color: 'text-status-success' },
  'contact.updated':     { label: 'Contact updated',   icon: FilePen,        color: 'text-brand-accent' },
  'contact.deleted':     { label: 'Contact deleted',   icon: FileX,          color: 'text-status-error' },
  'deal.created':        { label: 'Deal created',      icon: Briefcase,      color: 'text-status-success' },
  'deal.updated':        { label: 'Deal updated',      icon: Briefcase,      color: 'text-brand-accent' },
  'deal.stage_changed':  { label: 'Deal stage moved',  icon: ArrowRightLeft, color: 'text-brand' },
  'deal.deleted':        { label: 'Deal deleted',      icon: FileX,          color: 'text-status-error' },
  'billing.plan_changed': { label: 'Plan changed',     icon: CreditCard,     color: 'text-brand' },
};

function metaFor(action) {
  return ACTION_META[action] || { label: action, icon: ScrollText, color: 'text-muted-text' };
}

function timeAgo(ts) {
  const seconds = Math.floor((Date.now() - new Date(ts)) / 1000);
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [label, secs] of units) {
    const val = Math.floor(seconds / secs);
    if (val >= 1) return `${val} ${label}${val > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

function describeMetadata(action, metadata) {
  if (!metadata) return null;
  if (action === 'member.role_changed' && metadata.from && metadata.to) {
    return `${metadata.from} → ${metadata.to}`;
  }
  if (action === 'deal.stage_changed' && metadata.from && metadata.to) {
    return `${metadata.from} → ${metadata.to}`;
  }
  if (action === 'billing.plan_changed' && metadata.from && metadata.to) {
    return `${metadata.from} → ${metadata.to}`;
  }
  if (action === 'member.invited' && metadata.role) {
    return `as ${metadata.role}${metadata.emailMode === 'console' ? ' (email logged, no SMTP set)' : ''}`;
  }
  return null;
}

export default function AuditLog() {
  const { tenant } = useApp();

  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [actions, setActions] = useState([]);
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAuditActions().then((d) => setActions(d.actions)).catch(() => {});
  }, [tenant.id]);

  useEffect(() => {
    load(1);
  }, [tenant.id, actionFilter, targetTypeFilter]);

  async function load(page) {
    setLoading(true);
    setError('');
    try {
      const data = await getAuditLog({ page, action: actionFilter, targetType: targetTypeFilter });
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load audit log.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ScrollText size={22} className="text-brand" /> Audit Log
          </h1>
          <p className="text-sm text-muted-text mt-1">{tenant.name} · who did what, and when</p>
        </div>
      </div>

      <PermissionGate
        permission="view_audit_log"
        fallback={
          <div className="card text-sm text-muted-text">
            Audit log access is limited to admins and owners. Ask a workspace admin
            if you need visibility into recent activity.
          </div>
        }
      >
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{metaFor(a).label}</option>
            ))}
          </select>

          <select
            value={targetTypeFilter}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            className="bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            <option value="membership">Team</option>
            <option value="contact">Contacts</option>
            <option value="deal">Deals</option>
            <option value="tenant">Billing</option>
          </select>
        </div>

        {error && (
          <p className="text-sm text-status-error bg-status-error/10 border border-status-error/30 rounded-lg px-4 py-3 mb-4">
            {error}
          </p>
        )}

        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-muted-text text-sm animate-pulse">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-text text-sm">
              No activity recorded yet — actions like inviting a member or creating a
              deal will show up here.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {logs.map((log) => {
                const { label, icon: Icon, color } = metaFor(log.action);
                const detail = describeMetadata(log.action, log.metadata);
                return (
                  <div key={log.id} className="flex items-start gap-3 px-6 py-4">
                    <Icon size={16} className={`${color} mt-0.5 flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{log.actor_name}</span>
                        {' '}
                        <span className="text-muted-text">{label.toLowerCase()}</span>
                        {log.target_label && (
                          <> — <span className="font-medium">{log.target_label}</span></>
                        )}
                      </p>
                      {detail && <p className="text-xs text-muted-text mt-0.5">{detail}</p>}
                    </div>
                    <span className="text-xs text-muted-text flex-shrink-0">{timeAgo(log.created_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-text">
            <button
              onClick={() => load(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            Page {pagination.page} of {pagination.pages}
            <button
              onClick={() => load(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="p-1.5 rounded hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </PermissionGate>
    </div>
  );
}

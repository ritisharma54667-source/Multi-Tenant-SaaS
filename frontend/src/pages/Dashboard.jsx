// ============================================================
// DASHBOARD — Phase 5 (Dashboard & Analytics)
// ============================================================
// Every number on this page comes from GET /analytics/overview,
// which derives everything live from the contacts/deals tables —
// nothing here is mocked or hardcoded. See backend/src/routes/analytics.js.
//
// Gated behind the 'view_analytics' permission: viewers can see
// contacts/deals but not the aggregate numbers. CSV export is
// gated separately behind 'export_data' (manager+).
// ============================================================
import { useEffect, useState } from 'react';
import {
  Users, TrendingUp, Trophy, Percent, Wallet, Download, Clock, ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { getOverview, exportData } from '../api/analytics.js';
import PermissionGate from '../components/PermissionGate.jsx';
import { usePermission } from '../hooks/usePermission.js';
import { useToast } from '../context/ToastContext.jsx';

// Design-system colors (mirrors tailwind.config.js — recharts
// needs real hex values, it can't read Tailwind classes)
const COLORS = {
  brand:   '#4F46E5',
  accent:  '#06B6D4',
  success: '#22C55E',
  warning: '#F59E0B',
  error:   '#EF4444',
  muted:   '#94A3B8',
};

const STATUS_COLOR = { lead: COLORS.muted, active: COLORS.success, churned: COLORS.error };
const STAGE_COLOR = {
  lead: COLORS.muted, qualified: COLORS.brand, proposal: COLORS.accent,
  negotiation: COLORS.warning, won: COLORS.success, lost: COLORS.error,
};

function fmt(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
}
function fmtCompact(n) {
  return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
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

export default function Dashboard() {
  const { user, tenant } = useApp();
  const { can } = usePermission();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    if (!can('view_analytics')) { setLoading(false); return; }
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const overview = await getOverview();
      setData(overview);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(type) {
    setExporting(type);
    try {
      const blob = await exportData(type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${type === 'contacts' ? 'Contacts' : 'Deals'} exported.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Export failed.');
    } finally {
      setExporting('');
    }
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {user?.name}</h1>
          <p className="text-muted-text text-sm">
            Workspace: {tenant.name} · Role: {tenant.role}
          </p>
        </div>

        <PermissionGate permission="export_data">
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('contacts')}
              disabled={exporting === 'contacts'}
              className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
            >
              <Download size={13} /> {exporting === 'contacts' ? 'Exporting…' : 'Contacts CSV'}
            </button>
            <button
              onClick={() => handleExport('deals')}
              disabled={exporting === 'deals'}
              className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
            >
              <Download size={13} /> {exporting === 'deals' ? 'Exporting…' : 'Deals CSV'}
            </button>
          </div>
        </PermissionGate>
      </div>

      <PermissionGate
        permission="view_analytics"
        fallback={
          <div className="card mt-6 text-sm text-muted-text">
            Your role ({tenant.role}) doesn't include analytics access. Ask an admin
            to upgrade your role if you need to see workspace-wide numbers.
          </div>
        }
      >
        {error && (
          <p className="mt-6 text-sm text-status-error bg-status-error/10 border border-status-error/30 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {loading ? (
          <div className="text-center py-24 text-muted-text animate-pulse">Crunching the numbers…</div>
        ) : data && (
          <div className="mt-6 flex flex-col gap-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KpiCard icon={Users} label="Total contacts" value={data.kpis.totalContacts} />
              <KpiCard icon={TrendingUp} label="Open pipeline" value={fmt(data.kpis.openValue)} accent={COLORS.accent} />
              <KpiCard icon={Trophy} label="Won revenue" value={fmt(data.kpis.wonValue)} accent={COLORS.success} />
              <KpiCard
                icon={Percent}
                label="Win rate"
                value={data.kpis.winRate === null ? '—' : `${Math.round(data.kpis.winRate * 100)}%`}
                accent={COLORS.warning}
              />
              <KpiCard icon={Wallet} label="Avg deal size" value={fmt(data.kpis.avgDealSize)} />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Deals by stage */}
              <div className="card lg:col-span-2">
                <h2 className="text-sm font-medium mb-4">Deals by stage</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.dealsByStage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="stage" tick={{ fill: COLORS.muted, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                      formatter={(value, name) => [name === 'value' ? fmt(value) : value, name === 'value' ? 'Total value' : 'Deals']}
                    />
                    <Bar dataKey="count" name="count" radius={[4, 4, 0, 0]}>
                      {data.dealsByStage.map((d) => <Cell key={d.stage} fill={STAGE_COLOR[d.stage]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Contacts breakdown */}
              <div className="card">
                <h2 className="text-sm font-medium mb-4">Contacts by status</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={Object.entries(data.contactsByStatus).map(([status, count]) => ({ status, count }))}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {Object.keys(data.contactsByStatus).map((status) => (
                        <Cell key={status} fill={STATUS_COLOR[status]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }} />
                    <Legend
                      verticalAlign="bottom"
                      height={24}
                      formatter={(value) => <span style={{ color: COLORS.muted, fontSize: 12 }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue trend */}
            <div className="card">
              <h2 className="text-sm font-medium mb-4">Deals created &amp; revenue won — last 6 months</h2>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.monthlyTrend}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.success} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={COLORS.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: COLORS.muted, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                    formatter={(value, name) => [name === 'revenueWon' ? fmt(value) : value, name === 'revenueWon' ? 'Revenue won' : 'Deals created']}
                  />
                  <Area type="monotone" dataKey="revenueWon" stroke={COLORS.success} fill="url(#revenueFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Top deals + activity feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card">
                <h2 className="text-sm font-medium mb-3">Top open deals</h2>
                {data.topDeals.length === 0 ? (
                  <p className="text-xs text-muted-text/60 py-6 text-center">No open deals yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.topDeals.map((deal) => (
                      <div key={deal.id} className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
                        <div>
                          <p className="font-medium leading-tight">{deal.title}</p>
                          {deal.contact_name && <p className="text-xs text-muted-text">{deal.contact_name}</p>}
                        </div>
                        <span className="text-xs font-medium text-brand-accent">{fmt(deal.value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <h2 className="text-sm font-medium mb-3">Recent activity</h2>
                {data.recentActivity.length === 0 ? (
                  <p className="text-xs text-muted-text/60 py-6 text-center">Nothing yet — add a contact or deal.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.recentActivity.map((item) => (
                      <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 text-sm py-1.5 border-b border-white/5 last:border-0">
                        <ArrowUpRight size={13} className="text-muted-text flex-shrink-0" />
                        <span className="flex-1 leading-tight">{item.label}</span>
                        <span className="text-xs text-muted-text flex items-center gap-1 flex-shrink-0">
                          <Clock size={11} /> {timeAgo(item.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </PermissionGate>
    </div>
  );
}

// Small KPI stat card
function KpiCard({ icon: Icon, label, value, accent = COLORS.brand }) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center gap-2 text-muted-text text-xs">
        <Icon size={14} style={{ color: accent }} />
        {label}
      </div>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

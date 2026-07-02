// ============================================================
// BILLING PAGE — Phase 7
// ============================================================
// Every member can see current usage vs. plan limits (everyone
// hits the ceiling, not just the owner). Only the owner can
// actually switch plans — manage_billing is owner-only, per the
// permission table defined back in Phase 3.
//
// No real payment processor wired up — see backend's
// config/plans.js for why. Switching plans here is immediate and
// free, which is honest about what this demo does: it proves out
// usage metering + gated upgrade actions, not real payments.
// ============================================================
import { useEffect, useState } from 'react';
import { CreditCard, Check, TrendingUp } from 'lucide-react';
import { getBilling, getPlans, changePlan } from '../api/billing.js';
import { useApp } from '../context/AppContext.jsx';
import { useTenantStore } from '../store/tenantStore.js';
import PermissionGate from '../components/PermissionGate.jsx';
import { PLAN_FEATURES } from '../config/plans.js';

function UsageBar({ label, count, limit }) {
  const unlimited = limit === 'unlimited';
  const pct = unlimited ? 0 : Math.min(100, Math.round((count / limit) * 100));
  const nearLimit = !unlimited && pct >= 80;

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-muted-text">{label}</span>
        <span className={nearLimit ? 'text-status-warning font-medium' : ''}>
          {count} / {unlimited ? '∞' : limit}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${nearLimit ? 'bg-status-warning' : 'bg-brand'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function Billing() {
  const { tenant } = useApp();
  const setCurrentPlan = useTenantStore((s) => s.setCurrentPlan);

  const [billing, setBilling] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState('');

  useEffect(() => {
    load();
  }, [tenant.id]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [billingData, plansData] = await Promise.all([getBilling(), getPlans()]);
      setBilling(billingData);
      setPlans(plansData.plans);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load billing info.');
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePlan(planId) {
    if (planId === billing.plan) return;
    setSwitching(planId);
    setError('');
    try {
      const result = await changePlan(planId);
      setCurrentPlan(result.plan);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change plan.');
    } finally {
      setSwitching('');
    }
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <CreditCard size={22} className="text-brand" /> Billing &amp; Plan
        </h1>
        <p className="text-sm text-muted-text mt-1">{tenant.name}</p>
      </div>

      {error && (
        <p className="text-sm text-status-error bg-status-error/10 border border-status-error/30 rounded-lg px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <div className="text-center py-24 text-muted-text animate-pulse">Loading billing info…</div>
      ) : billing && (
        <div className="flex flex-col gap-6">
          {/* Current plan + usage */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-text">Current plan</p>
                <p className="text-xl font-semibold">{billing.planMeta.name}</p>
              </div>
              <p className="text-2xl font-semibold">
                ${billing.planMeta.priceMonthly}
                <span className="text-sm text-muted-text font-normal">/mo</span>
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <UsageBar label="Contacts" count={billing.usage.contacts.count} limit={billing.usage.contacts.limit} />
              <UsageBar label="Deals" count={billing.usage.deals.count} limit={billing.usage.deals.limit} />
              <UsageBar label="Team members" count={billing.usage.members.count} limit={billing.usage.members.limit} />
            </div>
          </div>

          <PermissionGate
            permission="manage_billing"
            fallback={
              <div className="card text-sm text-muted-text flex items-center gap-2">
                <TrendingUp size={15} />
                Only the workspace owner can change plans. Ask them if you're running
                into a limit above.
              </div>
            }
          >
            {/* Plan comparison / switcher */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const isCurrent = plan.id === billing.plan;
                return (
                  <div
                    key={plan.id}
                    className={`card flex flex-col gap-3 ${isCurrent ? 'border-brand ring-1 ring-brand/40' : ''}`}
                  >
                    <div>
                      <p className="font-semibold">{plan.name}</p>
                      <p className="text-2xl font-semibold mt-1">
                        ${plan.priceMonthly}
                        <span className="text-sm text-muted-text font-normal">/mo</span>
                      </p>
                    </div>

                    <ul className="flex flex-col gap-1.5 text-xs text-muted-text flex-1">
                      {(PLAN_FEATURES[plan.id] || []).map((feature) => (
                        <li key={feature} className="flex items-start gap-1.5">
                          <Check size={13} className="text-status-success mt-0.5 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleChangePlan(plan.id)}
                      disabled={isCurrent || switching === plan.id}
                      className={isCurrent ? 'btn-secondary text-sm' : 'btn-primary text-sm'}
                    >
                      {isCurrent ? 'Current plan' : switching === plan.id ? 'Switching…' : `Switch to ${plan.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </PermissionGate>
        </div>
      )}
    </div>
  );
}

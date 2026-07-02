// ============================================================
// LANDING PAGE
// ============================================================
// Phase 7 adds a real pricing section now that plans exist —
// static copy from config/plans.js, live usage is only ever
// shown post-login on /billing.
// ============================================================
import { useApp } from '../context/AppContext.jsx';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { PLAN_FEATURES } from '../config/plans.js';

const PRICING = [
  { id: 'free', name: 'Free', priceMonthly: 0 },
  { id: 'pro', name: 'Pro', priceMonthly: 29 },
  { id: 'enterprise', name: 'Enterprise', priceMonthly: 99 },
];

export default function Landing() {
  const { project, isAuthenticated } = useApp();

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-16">
      <h1 className="text-4xl font-bold mb-4 text-center">{project.name}</h1>
      <p className="text-muted-text max-w-xl mb-6 text-center">{project.description}</p>

      {!isAuthenticated && (
        <div className="flex gap-3 mb-16">
          <Link to="/signup" className="btn-primary">
            Get started
          </Link>
          <Link
            to="/login"
            className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
          >
            Log in
          </Link>
        </div>
      )}

      {isAuthenticated && (
        <Link to="/dashboard" className="btn-primary mb-16">
          Go to dashboard
        </Link>
      )}

      {/* Pricing */}
      <div className="w-full max-w-4xl mb-16">
        <h2 className="text-2xl font-semibold text-center mb-8">Simple, transparent pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PRICING.map((plan) => (
            <div key={plan.id} className="card flex flex-col gap-3">
              <div>
                <p className="font-semibold">{plan.name}</p>
                <p className="text-2xl font-semibold mt-1">
                  ${plan.priceMonthly}
                  <span className="text-sm text-muted-text font-normal">/mo</span>
                </p>
              </div>
              <ul className="flex flex-col gap-1.5 text-xs text-muted-text flex-1">
                {PLAN_FEATURES[plan.id].map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5">
                    <Check size={13} className="text-status-success mt-0.5 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to={isAuthenticated ? '/billing' : '/signup'}
                className="btn-secondary text-sm text-center"
              >
                {isAuthenticated ? 'Manage plan' : 'Get started'}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Build progress */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full text-left">
        {project.phases.map((phase) => (
          <div key={phase.id} className="card text-sm">
            <p className="font-medium">
              Phase {phase.id}: {phase.name}
            </p>
            <p
              className={
                phase.status === 'complete' ? 'text-status-success' : 'text-muted-text'
              }
            >
              {phase.status}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

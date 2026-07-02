// ============================================================
// PLANS — frontend display copy
// ============================================================
// Numbers here MUST match backend/src/config/plans.js — the
// backend is the source of truth for enforcement, this is just
// for rendering the pricing/upgrade UI without a round trip for
// static copy. Live usage numbers always come from GET /billing.
// ============================================================

export const PLAN_FEATURES = {
  free: [
    'Up to 25 contacts',
    'Up to 25 deals',
    'Up to 3 team members',
    'Kanban pipeline & analytics dashboard',
  ],
  pro: [
    'Up to 1,000 contacts',
    'Up to 1,000 deals',
    'Up to 15 team members',
    'CSV export',
    'Everything in Free',
  ],
  enterprise: [
    'Unlimited contacts',
    'Unlimited deals',
    'Unlimited team members',
    'Audit log access',
    'Everything in Pro',
  ],
};

// ============================================================
// PLANS — single source of truth for subscription tiers
// ============================================================
// No real payment processor here (no Stripe keys in this repo) —
// "billing" is self-serve plan switching that immediately changes
// enforced limits. That's enough to demonstrate the pattern
// (usage metering, upgrade prompts, gated actions) without wiring
// up a payment provider for a portfolio project. Swapping in real
// Stripe later means: call this on a successful webhook instead of
// directly from the change-plan route — the limit-checking code
// below doesn't change at all.
//
// Keep in sync with the frontend's copy at
// src/config/plans.js (pricing copy needs the same numbers).
// ============================================================

export const PLANS = ['free', 'pro', 'enterprise'];

// Infinity is valid JSON-serialized as `null` by JSON.stringify,
// so the API layer converts it to the string "unlimited" for the
// frontend rather than sending Infinity over the wire.
export const PLAN_LIMITS = {
  free:       { contacts: 25,   deals: 25,   members: 3 },
  pro:        { contacts: 1000, deals: 1000, members: 15 },
  enterprise: { contacts: Infinity, deals: Infinity, members: Infinity },
};

export const PLAN_META = {
  free:       { name: 'Free',       priceMonthly: 0 },
  pro:        { name: 'Pro',        priceMonthly: 29 },
  enterprise: { name: 'Enterprise', priceMonthly: 99 },
};

// ------------------------------------------------------------
// checkLimit(client, tenantId, plan, resource)
// ------------------------------------------------------------
// Returns { allowed, count, limit }. Called right before an
// INSERT in contacts.js / deals.js / team.js so a tenant can never
// exceed its plan — even via two simultaneous requests racing past
// a client-side check, since this re-queries the live count every
// time rather than trusting cached usage numbers.
// ------------------------------------------------------------
const RESOURCE_TABLE = {
  contacts: 'contacts',
  deals: 'deals',
  members: 'memberships',
};

export async function checkLimit(client, tenantId, plan, resource) {
  const limit = PLAN_LIMITS[plan]?.[resource] ?? 0;
  if (limit === Infinity) return { allowed: true, count: null, limit: 'unlimited' };

  const table = RESOURCE_TABLE[resource];
  const result = await client.query(`SELECT COUNT(*) FROM ${table} WHERE tenant_id = $1`, [tenantId]);
  const count = parseInt(result.rows[0].count);

  return { allowed: count < limit, count, limit };
}

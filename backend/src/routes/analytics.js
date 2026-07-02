// ============================================================
// ANALYTICS ROUTES  /api/v1/analytics
// ============================================================
// Phase 5. Every number here is DERIVED live from the real
// contacts/deals tables — nothing is precomputed or faked.
// Same tenant-RLS pattern as contacts.js / deals.js: every query
// runs through withTenantClient() so Postgres itself refuses to
// leak another tenant's rows even if a WHERE clause is missing.
//
// GET /overview   — KPIs + chart data for the dashboard
// GET /export     — CSV download of contacts or deals
//                    (?type=contacts | ?type=deals)
// ============================================================

import { Router } from 'express';
import { withTenantClient } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { resolveTenantContext } from '../middleware/tenantContext.js';
import { requirePermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '../config/permissions.js';
import { DEAL_STAGES } from './deals.js';

const router = Router();
const guard  = [requireAuth, resolveTenantContext];

const CLOSED_STAGES = ['won', 'lost'];

// ── GET /overview ───────────────────────────────────────────
router.get('/overview', ...guard, requirePermission(PERMISSIONS.VIEW_ANALYTICS), async (req, res, next) => {
  try {
    const data = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);

      // -- Contacts, grouped by status --------------------------
      const contactStatusResult = await client.query(
        `SELECT status, COUNT(*)::int AS count FROM contacts GROUP BY status`
      );
      const contactsByStatus = { lead: 0, active: 0, churned: 0 };
      let totalContacts = 0;
      contactStatusResult.rows.forEach((r) => {
        contactsByStatus[r.status] = r.count;
        totalContacts += r.count;
      });

      // -- Deals, grouped by stage -------------------------------
      const dealStageResult = await client.query(
        `SELECT stage, COUNT(*)::int AS count, COALESCE(SUM(value), 0)::float AS value
         FROM deals GROUP BY stage`
      );
      const dealsByStage = DEAL_STAGES.map((stage) => {
        const row = dealStageResult.rows.find((r) => r.stage === stage);
        return { stage, count: row?.count || 0, value: row?.value || 0 };
      });

      let totalDeals = 0, totalDealValue = 0, openValue = 0, wonValue = 0, wonCount = 0, lostCount = 0;
      dealsByStage.forEach(({ stage, count, value }) => {
        totalDeals += count;
        totalDealValue += value;
        if (stage === 'won') { wonValue = value; wonCount = count; }
        else if (stage === 'lost') { lostCount = count; }
        else { openValue += value; }
      });

      const closedCount = wonCount + lostCount;
      const winRate     = closedCount > 0 ? wonCount / closedCount : null;
      const avgDealSize = totalDeals > 0 ? totalDealValue / totalDeals : 0;

      // -- Monthly trend, last 6 months ---------------------------
      const trendResult = await client.query(
        `SELECT date_trunc('month', created_at) AS month,
                COUNT(*)::int AS deals_created,
                COALESCE(SUM(value) FILTER (WHERE stage = 'won'), 0)::float AS revenue_won
         FROM deals
         WHERE created_at >= date_trunc('month', now()) - interval '5 months'
         GROUP BY month
         ORDER BY month`
      );
      // Build a complete 6-month bucket list so months with zero
      // activity still show up as 0 on the chart instead of a gap.
      const monthlyTrend = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const key = d.toISOString().slice(0, 7); // "YYYY-MM"
        const match = trendResult.rows.find(
          (r) => new Date(r.month).toISOString().slice(0, 7) === key
        );
        monthlyTrend.push({
          month: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
          dealsCreated: match?.deals_created || 0,
          revenueWon: match?.revenue_won || 0,
        });
      }

      // -- Top open deals by value ---------------------------------
      const topDealsResult = await client.query(
        `SELECT d.id, d.title, d.value, d.stage, c.name AS contact_name
         FROM deals d
         LEFT JOIN contacts c ON c.id = d.contact_id
         WHERE d.stage NOT IN ('won', 'lost')
         ORDER BY d.value DESC
         LIMIT 5`
      );

      // -- Recent activity feed (latest contacts + deals, merged) --
      const recentContactsResult = await client.query(
        `SELECT id, name, created_at FROM contacts ORDER BY created_at DESC LIMIT 5`
      );
      const recentDealsResult = await client.query(
        `SELECT id, title, stage, updated_at FROM deals ORDER BY updated_at DESC LIMIT 5`
      );

      const recentActivity = [
        ...recentContactsResult.rows.map((r) => ({
          type: 'contact',
          id: r.id,
          label: `New contact: ${r.name}`,
          timestamp: r.created_at,
        })),
        ...recentDealsResult.rows.map((r) => ({
          type: 'deal',
          id: r.id,
          label: `Deal "${r.title}" → ${r.stage}`,
          timestamp: r.updated_at,
        })),
      ]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 8);

      return {
        kpis: {
          totalContacts,
          totalDeals,
          openValue,
          wonValue,
          winRate,
          avgDealSize,
        },
        contactsByStatus,
        dealsByStage,
        monthlyTrend,
        topDeals: topDealsResult.rows,
        recentActivity,
      };
    });

    res.json(data);
  } catch (err) { next(err); }
});

// ── GET /export — CSV download ──────────────────────────────
router.get('/export', ...guard, requirePermission(PERMISSIONS.EXPORT_DATA), async (req, res, next) => {
  const type = req.query.type;
  if (!['contacts', 'deals'].includes(type)) {
    return res.status(400).json({ error: "type must be 'contacts' or 'deals'." });
  }

  try {
    const rows = await withTenantClient(req.tenantId, async (client) => {
      await req.setTenantContext(client);

      if (type === 'contacts') {
        const r = await client.query(
          `SELECT c.name, c.email, c.phone, c.company, c.status, u.name AS owner_name, c.created_at
           FROM contacts c LEFT JOIN users u ON u.id = c.owner_id
           ORDER BY c.created_at DESC`
        );
        return r.rows;
      }

      const r = await client.query(
        `SELECT d.title, d.value, d.stage, c.name AS contact_name, u.name AS owner_name,
                d.expected_close_date, d.created_at
         FROM deals d
         LEFT JOIN contacts c ON c.id = d.contact_id
         LEFT JOIN users   u ON u.id = d.owner_id
         ORDER BY d.created_at DESC`
      );
      return r.rows;
    });

    const csv = toCsv(rows);
    const filename = `${type}-export-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// ── Helper: convert an array of row objects into a CSV string ──
function toCsv(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);

  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // Quote any field containing a comma, quote, or newline
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  });
  return lines.join('\n');
}

export default router;

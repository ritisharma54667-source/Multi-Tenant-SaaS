// ============================================================
// AUDIT LOG UTILITY
// ============================================================
// Every meaningful action inside a workspace gets one row here:
// who did it, what they did, and what it was done to. Call this
// with the SAME client you're already using inside
// withTenantClient() — it must run in that tenant-scoped session
// so the RLS policy on audit_logs lets the INSERT through.
//
// Usage (inside a withTenantClient callback, after the real
// write succeeds):
//   await logAction(client, {
//     tenantId: req.tenantId,
//     actor: req.user,
//     action: 'deal.stage_changed',
//     targetType: 'deal',
//     targetId: deal.id,
//     targetLabel: deal.title,
//     metadata: { from: oldStage, to: newStage },
//   });
//
// Failure to write an audit entry should never break the real
// action it's describing — callers should treat this as
// best-effort (see the try/catch inside).
// ============================================================

export async function logAction(client, {
  tenantId,
  actor,          // { id, name } — usually req.user
  action,
  targetType = null,
  targetId = null,
  targetLabel = null,
  metadata = null,
}) {
  try {
    await client.query(
      `INSERT INTO audit_logs
        (tenant_id, actor_id, actor_name, action, target_type, target_id, target_label, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        actor?.id || null,
        actor?.name || 'Unknown',
        action,
        targetType,
        targetId,
        targetLabel,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (err) {
    // Never let audit logging take down the primary request.
    console.error('[auditLog] failed to write entry:', err.message);
  }
}

// ============================================================
// SLUG UTILITY — turns "Acme Corp" into "acme-corp", with a
// random suffix appended if the slug is already taken.
// ============================================================

export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function withRandomSuffix(slug) {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${slug}-${suffix}`;
}

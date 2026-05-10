/**
 * Generate a UUID v4 identifier.
 * The optional prefix is intentionally ignored — all IDs must be valid UUIDs
 * to satisfy the `uuid` primary-key constraint in Supabase tables.
 */
export function genId(_prefix) {
  return crypto.randomUUID();
}

export default genId;

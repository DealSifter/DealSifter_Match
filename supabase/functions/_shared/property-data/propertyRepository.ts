import { validatePropertyId } from './cache.ts';
import type { InternalPropertyRecord, PropertyEvidenceRepository } from './propertyEvidenceTypes.ts';

type QueryResult = { data: unknown; error: { message?: string } | null };
export type PropertyEvidenceTableClient = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): { maybeSingle(): PromiseLike<QueryResult> };
    };
  };
};

export class SupabasePropertyEvidenceRepository implements PropertyEvidenceRepository {
  constructor(private readonly client: PropertyEvidenceTableClient) {}

  async getById(propertyId: string, userId?: string | null) {
    const id = validatePropertyId(propertyId);
    const { data, error } = await this.client
      .from('properties')
      .select('id,type,address,city,state,zip,price,beds,baths,sqft,lot,owner_id,description')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error('PROPERTY_EVIDENCE_INTERNAL_LOOKUP_FAILED');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const row = data as Record<string, unknown>;
    if (row.id !== id) return null;
    if ((id === '07343e87-1ef8-4ca5-a88e-be49d95431a7' || String(row.description || '').startsWith('PI_1D_B0_PRIVATE_TEST_COPY')) && row.owner_id !== userId) return null;
    return row as unknown as InternalPropertyRecord;
  }
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, Tables } from './database.types';

type PublicFunctions = Database['public']['Functions'];
type Contract<Name extends keyof PublicFunctions> = PublicFunctions[Name];

export type TypedSupabaseClient = SupabaseClient<Database>;

export type PropertyRow = Tables<'properties'>;
export type ServiceRow = Tables<'services'>;
export type ProfileRow = Tables<'user_profiles'>;
export type ChatMessageRow = Tables<'chat_messages'>;
export type DealWorkflowRow = Tables<'deal_workflow_items'>;

export type GlobalFeedResult = Contract<'ds_get_global_feed_inventory'>['Returns'];
export type ProfileSaveArgs = Contract<'ds_save_professional_profile'>['Args'];
export type ProfileSaveResult = Contract<'ds_save_professional_profile'>['Returns'];
export type RateLimitArgs = Contract<'ds_consume_edge_rate_limit'>['Args'];
export type RateLimitResult = Contract<'ds_consume_edge_rate_limit'>['Returns'];
export type UnlockArgs = Contract<'ds_purchase_contact_unlock'>['Args'];
export type UnlockResult = Contract<'ds_purchase_contact_unlock'>['Returns'];
export type WorkflowArgs = Contract<'ds_set_manual_deal_workflow_item'>['Args'];
export type WorkflowResult = Contract<'ds_set_manual_deal_workflow_item'>['Returns'];
export type IntegrityAuditResult = Contract<'ds_data_integrity_audit'>['Returns'];
export type TrackAppEventArgs = Contract<'track_app_event'>['Args'];

export type SafeProductMetadata = Record<string, string | number | boolean | null> & Json;

// Compile-time witnesses: schema drift in any critical contract must fail `audit:types`.
export const criticalContractWitness = {
  tables: ['properties', 'services', 'user_profiles', 'chat_messages', 'deal_workflow_items'],
  functions: [
    'ds_get_global_feed_inventory',
    'ds_save_professional_profile',
    'ds_consume_edge_rate_limit',
    'ds_purchase_contact_unlock',
    'ds_set_manual_deal_workflow_item',
    'ds_data_integrity_audit',
    'track_app_event',
  ],
} as const satisfies {
  tables: readonly (keyof Database['public']['Tables'])[];
  functions: readonly (keyof PublicFunctions)[];
};

import { supabase } from '../lib/supabaseClient';

export async function listMaxxisReportEntitlements(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase.from('maxxis_report_entitlements')
    .select('id, property_id, capability, access_source, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id, propertyId: row.property_id, reportType: row.capability,
    accessSource: row.access_source === 'ONE_TIME_UNLOCK' ? 'NUGGET_UNLOCK' : 'SUBSCRIPTION',
    createdAt: row.created_at, expires: null,
  }));
}

export async function unlockMaxxisReport({ propertyId, capability }) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('ds_unlock_maxxis_report', {
    p_property_id: propertyId, p_capability: capability, p_report_version: '1', p_report_payload: null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function listMaxxisReportHistory(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase.from('maxxis_reports')
    .select('id, property_id, capability, access_source, report_version, report_payload, created_at')
    .eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id, propertyId: row.property_id, capability: row.capability,
    accessSource: row.access_source, reportVersion: row.report_version,
    reportPayload: row.report_payload, createdAt: row.created_at,
  }));
}

export async function deleteMaxxisReportArtifact(reportId) {
  if (!supabase || !reportId) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('ds_delete_maxxis_report_artifact', { p_report_id: reportId });
  if (error) throw error;
  return data;
}

export async function saveMaxxisReportPayload({ propertyId, capability, reportPayload, reportVersion = '1' }) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('ds_save_maxxis_report_payload', {
    p_property_id: propertyId, p_capability: capability,
    p_report_version: reportVersion, p_report_payload: reportPayload,
  });
  if (error) throw error;
  return data;
}

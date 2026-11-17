import {supabase} from '../lib/supabaseClient';
import {releaseSourceFingerprint,readAuthorizedReleaseSource} from '../../supabase/functions/_shared/mailbox/propertyReleaseMail.ts';
import {createReportDeliveryReference} from '../features/maxxis/reports/reportDelivery';
import {resolveReportExportEntitlements} from '../features/maxxis/export/reportExportEntitlement';
export async function readPropertyReleaseMailSource(userId,propertyId) {
 if(!supabase)throw new Error('REPORT_DELIVERY_UNAVAILABLE');
 const auth=await supabase.auth.getUser();if(auth.error||auth.data?.user?.id!==userId)throw new Error('REPORT_DELIVERY_UNAUTHORIZED');
 const source=await readAuthorizedReleaseSource(supabase,userId,propertyId);
 if(!source)throw new Error('REPORT_DELIVERY_UNAUTHORIZED');
 const {row,images}=source;
 const current=await supabase.auth.getUser();if(current.error||current.data?.user?.id!==userId)throw new Error('REPORT_DELIVERY_UNAUTHORIZED');
 return {row,images,fingerprint:await releaseSourceFingerprint(row,images)};
}
export async function createPropertyReleaseDelivery(userId,schema,source,language) {
 const report={id:source.row.id,userId,propertyId:source.row.id,capability:'PROPERTY_RELEASE',reportVersion:'1',reportPayload:{data:{maxxisReport:schema}}};
 return {report,schema,sourceFingerprint:source.fingerprint,reference:await createReportDeliveryReference(report,userId,language),
 entitlements:resolveReportExportEntitlements({reportType:'PROPERTY_RELEASE',plan:'free'})};
}
export async function resolvePropertyReleaseDelivery(prepared,reference,userId) {
 if(userId!==reference.userId||prepared.reference.fingerprint!==reference.fingerprint)throw new Error('REPORT_DELIVERY_UNAUTHORIZED');
 const current=await readPropertyReleaseMailSource(userId,reference.propertyId);
 if(current.fingerprint!==prepared.sourceFingerprint)throw new Error('REPORT_DELIVERY_STALE');
 return prepared;
}

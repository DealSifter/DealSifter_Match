-- Read report_id and request_id from the PDF Subject metadata.
-- Replace the fictional report UUID below with the UUID of the requested PDF.
select request_id, report_id, origin, operation, status, http_status,
       billable_success, evidence_outcome, error_code, created_at, completed_at
from public.external_provider_usage
where report_id = '00000000-0000-4000-8000-000000000013'::uuid
order by created_at, id;

select request_id, report_id, origin, bucket, status, billable_success,
       evidence_outcome, created_at, completed_at
from public.maxxis_provider_budget_usage
where report_id = '00000000-0000-4000-8000-000000000013'::uuid
order by created_at, id;

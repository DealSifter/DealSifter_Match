-- Targeted identity correction for the audited vacant-land control only.
-- The old address fingerprint must never authorize evidence for the corrected ZIP.
do $$
declare
  corrected_count integer;
begin
  update public.properties
     set zip = '35215',
         updated_at = now()
   where id = '20e8a78f-fcf7-4017-83cd-5c8355498da9'::uuid
     and lower(trim(address)) = '741 gable dr'
     and lower(trim(city)) = 'center point'
     and upper(trim(state)) = 'AL'
     and trim(zip) = '35126';

  get diagnostics corrected_count = row_count;
  if corrected_count > 1 then
    raise exception 'GABLE_IDENTITY_CORRECTION_SCOPE_VIOLATION';
  end if;

  delete from public.property_intelligence_cache
   where property_id = '20e8a78f-fcf7-4017-83cd-5c8355498da9'::uuid;
end $$;

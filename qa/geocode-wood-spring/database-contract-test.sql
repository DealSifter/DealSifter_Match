-- Temporary copy only. No modifications to real properties; all DDL is rolled back.
create temporary table geocode_contract_test (like public.properties including defaults including constraints);
create trigger geocode_contract_invalidate before update on geocode_contract_test
for each row execute function public.ds_invalidate_changed_property_address();
insert into geocode_contract_test select * from public.properties where id='60379a77-98b1-4c31-af00-32e6ac208e83';
do $$
declare draft record; blocked boolean := false;
begin
 if public.ds_property_geocode_valid(null,null,'resolved','census',now())
   or public.ds_property_geocode_valid(0,0,'resolved','census',now())
   or public.ds_property_geocode_valid(35,-78,'pending','census',now())
   or public.ds_property_geocode_valid(35,-78,'resolved','',now()) then
   raise exception 'Invalid coordinates/provenance accepted';
 end if;
 update geocode_contract_test set address='Address changed without revalidation';
 select * into draft from geocode_contract_test;
 if draft.publish_to_showcase or draft.is_active or draft.lat is not null or draft.geocode_status <> 'pending' then
   raise exception 'Address change did not invalidate publication and PIN';
 end if;
 begin
   update geocode_contract_test set publish_to_showcase=true;
 exception when check_violation then blocked := true;
 end;
 if not blocked then raise exception 'Unvalidated publication accepted'; end if;
end $$;
select 'PASS: invalid geocode rejected; address changes invalidate; invalid publication blocked; real properties untouched' as database_contract;

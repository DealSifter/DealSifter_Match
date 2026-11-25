-- Append after sec1-transactional-validation.sql in the SAME rolled-back transaction.
select set_config('request.jwt.claims','{"sub":"f1010000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.sec1_assert((select count(*)=1 from jsonb_array_elements(public.ds_get_unlocked_contact_cards(auth.uid())) c where c->>'owner_id'='f1010000-0000-4000-8000-000000000002' and c->>'primary_profile'='personal'),'SEC03_canonical_only_purchased_profile');
select pg_temp.sec1_assert((select count(*)=1 from public.ds_get_unlocked_contact_snapshots() s where s.seller_id='f1010000-0000-4000-8000-000000000002' and s.contact->>'primaryProfile'='personal' and s.contact->>'email'='b-personal@qa.invalid'),'SEC03_legacy_same_authorized_profile');
select pg_temp.sec1_assert(not exists(select 1 from public.ds_get_unlocked_contact_snapshots() s where s.contact->>'primaryProfile' in ('professional','fsbo')),'SEC03_business_and_fsbo_not_purchased_denied');
select pg_temp.sec1_assert(exists(select 1 from jsonb_array_elements(public.ds_get_user_unlock_state(auth.uid())->'contact_snapshots') c where c#>>'{contact,email}'='b-personal@qa.invalid'),'SEC03_aggregate_preserves_legacy_contract');
reset role;
update public.professional_profiles set profile_payload=profile_payload#-'{resolved,personal,email}' where user_id='f1010000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.sec1_assert((select contact->>'email' is null from public.ds_get_unlocked_contact_snapshots() where seller_id='f1010000-0000-4000-8000-000000000002'),'SEC03_no_login_email_fallback');
reset role;
update public.professional_profiles set profile_payload=jsonb_set(profile_payload,'{resolved,personal,email}','"b-personal@qa.invalid"') where user_id='f1010000-0000-4000-8000-000000000002';
insert into public.properties(id,owner_id,type,primary_profile) values
 ('f1010000-0000-4000-8000-000000000011','f1010000-0000-4000-8000-000000000002','single_family','personal'),
 ('f1010000-0000-4000-8000-000000000012','f1010000-0000-4000-8000-000000000002','single_family','professional');
insert into public.property_unlocks(id,property_id,owner_id,buyer_id,profile_scope,mode,status,expires_at,metadata) values
 ('f1010000-0000-4000-8000-000000000021','f1010000-0000-4000-8000-000000000011','f1010000-0000-4000-8000-000000000002','f1010000-0000-4000-8000-000000000003','personal','partial','active',now()+interval '7 days','{"buyerProfileScope":"personal"}');
set local role authenticated;
select pg_temp.sec1_assert((select contact->>'email' is null from public.ds_get_unlocked_contact_snapshots() where seller_id='f1010000-0000-4000-8000-000000000002'),'SEC03_legacy_third_party_exclusivity_hides_contact');
select pg_temp.sec1_assert((select c#>>'{contact,email}' is null from jsonb_array_elements(public.ds_get_unlocked_contact_cards(auth.uid())) c where c->>'owner_id'='f1010000-0000-4000-8000-000000000002'),'SEC03_canonical_third_party_exclusivity_hides_contact');
reset role;
update public.property_unlocks set expires_at=now()-interval '1 day' where id='f1010000-0000-4000-8000-000000000021';
set local role authenticated;
select pg_temp.sec1_assert((select contact->>'email'='b-personal@qa.invalid' from public.ds_get_unlocked_contact_snapshots() where seller_id='f1010000-0000-4000-8000-000000000002'),'SEC03_expired_exclusivity_preserves_previous_contact');
reset role;
update public.professional_profiles set profile_payload=jsonb_set(profile_payload,'{resolved,professional}','{"name":"Synthetic A Business","email":"a-business@qa.invalid","primaryPhone":"+12025550109"}') where user_id='f1010000-0000-4000-8000-000000000001';
set local role authenticated;
do $$
declare v_intent uuid; v_row record;
begin
  select intent_token into v_intent from public.ds_create_unlock_intent('f1010000-0000-4000-8000-000000000002','f1010000-0000-4000-8000-000000000012','professional','total','{"buyerProfileScope":"professional"}');
  select * into v_row from public.ds_purchase_property_unlock('f1010000-0000-4000-8000-000000000012','total','{"buyerProfileScope":"fsbo"}',v_intent);
  perform pg_temp.sec1_assert(v_row.total_cost=21,'SEC03_exclusive_purchase_preserves_price');
  perform pg_temp.sec1_assert(exists(select 1 from public.property_unlocks where id=v_row.unlock_id and metadata->>'buyerProfileScope'='professional'),'SEC03_buyer_scope_frozen_in_intent_not_purchase_payload');
end $$;
select set_config('request.jwt.claims','{"sub":"f1010000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.sec1_assert(exists(select 1 from jsonb_array_elements(public.ds_get_unlocked_contact_cards(auth.uid())) c where c->>'owner_id'='f1010000-0000-4000-8000-000000000001' and c->>'primary_profile'='professional' and c->>'unlock_scope'='reciprocal' and c#>>'{contact,email}'='a-business@qa.invalid' and (c->>'exclusive_expires_at')::timestamptz>now()),'SEC03_reciprocal_active_buyer_profile_and_expiry');
select pg_temp.sec1_assert(not exists(select 1 from jsonb_array_elements(public.ds_get_unlocked_contact_cards(auth.uid())) c where c->>'owner_id'='f1010000-0000-4000-8000-000000000001' and c->>'primary_profile' in ('personal','fsbo')),'SEC03_reciprocal_other_buyer_profiles_denied');
select pg_temp.sec1_assert(exists(select 1 from public.ds_get_unlocked_contact_snapshots() c where c.seller_id='f1010000-0000-4000-8000-000000000001' and c.contact->>'email'='a-business@qa.invalid' and (c.contact->>'exclusiveExpiresAt')::timestamptz>now()),'SEC03_legacy_reciprocal_matches_canonical_and_expiry');
reset role;
update public.property_unlocks set expires_at=now()-interval '1 day' where property_id='f1010000-0000-4000-8000-000000000012';
set local role authenticated;
select pg_temp.sec1_assert(not exists(select 1 from jsonb_array_elements(public.ds_get_unlocked_contact_cards(auth.uid())) c where c->>'owner_id'='f1010000-0000-4000-8000-000000000001'),'SEC03_expired_reciprocal_contact_not_disclosed');
reset role;
select jsonb_agg(name order by name) as sec1_passed_tests from sec1_results;

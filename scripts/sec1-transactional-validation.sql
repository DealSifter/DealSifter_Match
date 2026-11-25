-- Synthetic fixtures only. The caller MUST wrap this script in BEGIN ... ROLLBACK.
-- No HTTP/providers, real identities, persistent balance changes or paid actions.
create temporary table sec1_results (name text primary key);
grant insert, select on sec1_results to authenticated, anon;
create function pg_temp.sec1_assert(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'SEC1_ASSERT:%', label; end if;
  insert into sec1_results values (label);
end $$;
create function pg_temp.sec1_denied(statement text, label text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege then
    insert into sec1_results values (label);
    return;
  end;
  raise exception 'SEC1_EXPECTED_DENIAL:%', label;
end $$;

do $$ begin
  if exists(select 1 from auth.users where id in ('f1010000-0000-4000-8000-000000000001','f1010000-0000-4000-8000-000000000002','f1010000-0000-4000-8000-000000000003')) then
    raise exception 'SEC1_FIXTURE_COLLISION';
  end if;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('f1010000-0000-4000-8000-000000000001','sec1-a@qa.dealsifter.invalid','{"full_name":"SEC1 Synthetic A"}'),
 ('f1010000-0000-4000-8000-000000000002','sec1-b@qa.dealsifter.invalid','{"full_name":"SEC1 Synthetic B"}'),
 ('f1010000-0000-4000-8000-000000000003','sec1-c@qa.dealsifter.invalid','{"full_name":"SEC1 Synthetic C"}');
update public.users set nuggets=100,plan_id='pro',is_admin=false where id in
 ('f1010000-0000-4000-8000-000000000001','f1010000-0000-4000-8000-000000000002','f1010000-0000-4000-8000-000000000003');
insert into public.professional_profiles(user_id,profile_payload) values
 ('f1010000-0000-4000-8000-000000000001','{"resolved":{"personal":{"email":"a-profile@qa.invalid","primaryPhone":"+12025550101","contactMethods":["chat"]}}}'),
 ('f1010000-0000-4000-8000-000000000002','{"resolved":{"personal":{"email":"b-personal@qa.invalid","primaryPhone":"+12025550102","contactMethods":["chat"]},"professional":{"email":"b-business@qa.invalid"},"fsbo":{"email":"b-fsbo@qa.invalid"}}}');
insert into public.services(owner_id,title,category,primary_profile,publish_to_connections) values
 ('f1010000-0000-4000-8000-000000000002','SEC1 Synthetic Service','photography','personal',true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1010000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.sec1_denied($q$insert into public.unlocks(buyer_id,seller_id,nuggets_spent) values
 ('f1010000-0000-4000-8000-000000000001','f1010000-0000-4000-8000-000000000002',0)$q$,'SEC01_direct_insert_denied');
select pg_temp.sec1_assert(not exists(select 1 from jsonb_array_elements(public.ds_get_unlocked_contact_cards(auth.uid())) r where r->>'owner_id'='f1010000-0000-4000-8000-000000000002'),'SEC01_no_entitlement_no_contact');
do $$
declare v_intent uuid; v_cost integer; v_balance integer; v_repeat integer;
begin
  select intent_token,total_cost into v_intent,v_cost from public.ds_create_unlock_intent('f1010000-0000-4000-8000-000000000002',null,'personal','normal','{}');
  select remaining_nuggets into v_balance from public.ds_purchase_contact_unlock('f1010000-0000-4000-8000-000000000002',v_intent,'personal');
  perform pg_temp.sec1_assert(v_cost=1 and v_balance=99,'SEC01_legitimate_purchase_one_debit');
  select remaining_nuggets into v_repeat from public.ds_purchase_contact_unlock('f1010000-0000-4000-8000-000000000002',v_intent,'personal');
  perform pg_temp.sec1_assert(v_repeat=v_balance,'SEC01_retry_no_duplicate_debit');
  perform pg_temp.sec1_assert(exists(select 1 from jsonb_array_elements(public.ds_get_unlocked_contact_cards(auth.uid())) r
    where r->>'owner_id'='f1010000-0000-4000-8000-000000000002' and r#>>'{contact,email}'='b-personal@qa.invalid'),'SEC01_legitimate_contact_read');
end $$;
select pg_temp.sec1_denied($q$insert into public.subscriptions(user_id,plan_id,status) values('f1010000-0000-4000-8000-000000000001','enterprise','active')$q$,'SEC02_direct_plan_insert_denied');
reset role;
insert into public.subscriptions(user_id,plan_id,status,stripe_customer_id) values('f1010000-0000-4000-8000-000000000001','pro','active','cus_sec1_synthetic');
select pg_temp.sec1_assert(exists(select 1 from public.subscriptions where stripe_customer_id='cus_sec1_synthetic'),'SEC02_backend_subscription_write');
set local role authenticated;
select pg_temp.sec1_denied($q$update public.subscriptions set plan_id='enterprise' where user_id=auth.uid()$q$,'SEC02_direct_plan_update_denied');
select pg_temp.sec1_denied($q$update public.subscriptions set stripe_customer_id='cus_foreign' where user_id=auth.uid()$q$,'SEC02_direct_customer_update_denied');
select pg_temp.sec1_assert(exists(select 1 from public.subscriptions where user_id=auth.uid() and plan_id='pro'),'SEC02_own_subscription_select');

insert into public.chat_messages(id,sender_id,recipient_id,body,message_type,metadata) values
 ('f1010000-0000-4000-8000-000000000010','f1010000-0000-4000-8000-000000000001','f1010000-0000-4000-8000-000000000002','Synthetic security validation','text','{"primaryProfile":"personal"}');
select pg_temp.sec1_assert(exists(select 1 from public.chat_messages where id='f1010000-0000-4000-8000-000000000010'),'SEC04_sender_can_send_and_read');
select set_config('request.jwt.claims','{"sub":"f1010000-0000-4000-8000-000000000002","role":"authenticated"}',true);
update public.chat_messages set read_at=now() where id='f1010000-0000-4000-8000-000000000010';
select pg_temp.sec1_assert(exists(select 1 from public.chat_messages where id='f1010000-0000-4000-8000-000000000010' and read_at is not null),'SEC04_recipient_read_receipt');
select pg_temp.sec1_denied($q$update public.chat_messages set body='forged' where id='f1010000-0000-4000-8000-000000000010'$q$,'SEC04_body_update_denied');
select pg_temp.sec1_denied($q$update public.chat_messages set sender_id=auth.uid() where id='f1010000-0000-4000-8000-000000000010'$q$,'SEC04_sender_update_denied');
select pg_temp.sec1_denied($q$update public.chat_messages set created_at=now() where id='f1010000-0000-4000-8000-000000000010'$q$,'SEC04_time_update_denied');
select pg_temp.sec1_denied($q$update public.chat_messages set metadata='{}' where id='f1010000-0000-4000-8000-000000000010'$q$,'SEC04_metadata_update_denied');
select set_config('request.jwt.claims','{"sub":"f1010000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.sec1_assert(not exists(select 1 from public.chat_messages where id='f1010000-0000-4000-8000-000000000010'),'SEC04_external_read_denied');
do $$ declare n integer; begin
 update public.chat_messages set read_at=now() where id='f1010000-0000-4000-8000-000000000010';get diagnostics n=row_count;
 perform pg_temp.sec1_assert(n=0,'SEC04_external_receipt_denied');
end $$;

-- Exercise the actual RLS path used by Storage, with synthetic JPEG metadata only.
insert into storage.objects(bucket_id,name,owner) values('profile-images','f1010000-0000-4000-8000-000000000003/sec1-test.jpg',auth.uid());
insert into storage.objects(bucket_id,name,owner) values('property-images','f1010000-0000-4000-8000-000000000003/sec1-test.jpg',auth.uid());
select pg_temp.sec1_assert(true,'SEC05_own_avatar_and_property_insert');
select pg_temp.sec1_denied($q$insert into storage.objects(bucket_id,name,owner) values('profile-images','f1010000-0000-4000-8000-000000000001/sec1-foreign.jpg',auth.uid())$q$,'SEC05_foreign_avatar_insert_denied');
select pg_temp.sec1_denied($q$insert into storage.objects(bucket_id,name,owner) values('property-images','f1010000-0000-4000-8000-000000000001/sec1-foreign.jpg',auth.uid())$q$,'SEC05_foreign_property_insert_denied');
select set_config('request.jwt.claims','{"sub":"f1010000-0000-4000-8000-000000000001","role":"authenticated"}',true);
-- Storage's own API sets this transaction-local guard before DELETE. It does
-- not bypass RLS; it lets this isolated SQL test exercise the same RLS path.
set local storage.allow_delete_query='true';
do $$ declare n integer; begin
 update storage.objects set metadata='{}' where name='f1010000-0000-4000-8000-000000000003/sec1-test.jpg';get diagnostics n=row_count;
 perform pg_temp.sec1_assert(n=0,'SEC05_foreign_update_denied');
 delete from storage.objects where name='f1010000-0000-4000-8000-000000000003/sec1-test.jpg';get diagnostics n=row_count;
 perform pg_temp.sec1_assert(n=0,'SEC05_foreign_delete_denied');
end $$;
set local role anon;
select pg_temp.sec1_assert((select count(*)=2 from storage.objects where name='f1010000-0000-4000-8000-000000000003/sec1-test.jpg'),'SEC05_existing_images_public_select');
reset role;
select jsonb_agg(name order by name) as sec1_passed_tests from sec1_results;

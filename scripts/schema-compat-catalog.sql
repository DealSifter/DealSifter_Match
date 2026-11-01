-- Metadata only. No property, user, cache payload or usage-ledger rows.
select jsonb_build_object(
 'projectRef','cyeipfskwwisbbayyaca',
 'observedUtc',timezone('utc',now()),
 'functions',(select jsonb_agg(jsonb_build_object(
   'name',p.proname,'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
   'args',p.proargnames,'argTypes',oidvectortypes(p.proargtypes),'defaultCount',p.pronargdefaults,
   'grants',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,'settings',p.proconfig)
   order by p.oid::regprocedure::text) from pg_proc p where p.pronamespace='public'::regnamespace
   and p.proname in ('ds_reserve_external_provider_usage','ds_finalize_external_provider_usage',
    'ds_reserve_maxxis_provider_budget','ds_finalize_maxxis_provider_budget','ds_annotate_provider_attempt',
    'ds_acquire_property_evidence_lease','ds_release_property_evidence_lease',
    'ds_get_property_intelligence_cache','ds_get_retained_property_intelligence_cache','ds_upsert_property_intelligence_cache')),
 'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
   'grants',c.relacl::text,'owner',pg_get_userbyid(c.relowner),
   'constraints',(select jsonb_agg(jsonb_build_object('name',k.conname,'kind',k.contype,'definition',pg_get_constraintdef(k.oid)) order by k.conname) from pg_constraint k where k.conrelid=c.oid and k.contype in ('c','f','u','p')),
   'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
   'policies',(select jsonb_agg(jsonb_build_object('name',pol.polname,'command',pol.polcmd,'roles',pol.polroles,'permissive',pol.polpermissive,'using',pg_get_expr(pol.polqual,pol.polrelid),'check',pg_get_expr(pol.polwithcheck,pol.polrelid)) order by pol.polname) from pg_policy pol where pol.polrelid=c.oid)) order by c.relname)
   from pg_class c where c.relnamespace='public'::regnamespace and c.relname in ('external_provider_usage','maxxis_provider_budget_usage','property_evidence_leases','property_intelligence_cache')),
 'enums',(select coalesce(jsonb_agg(jsonb_build_object('type',t.typname,'value',e.enumlabel) order by t.typname,e.enumsortorder),'[]'::jsonb) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.oid in (select a.atttypid from pg_attribute a where a.attrelid in ('public.external_provider_usage'::regclass,'public.maxxis_provider_budget_usage'::regclass,'public.property_evidence_leases'::regclass,'public.property_intelligence_cache'::regclass) and a.attnum>0)),
 'migrations',(select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations)
) as catalog;

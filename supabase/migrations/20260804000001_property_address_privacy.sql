alter table public.properties
  add column if not exists hide_street_address_on_card boolean not null default false;

comment on column public.properties.hide_street_address_on_card is
  'When true, public feed cards hide street number/name and exact MapView pins are suppressed; city/state/zip remain visible.';

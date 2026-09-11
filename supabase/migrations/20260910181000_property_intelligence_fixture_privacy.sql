-- Only this controlled fixture. No mutation of users or existing public listings.
-- Prevent future normal UI publication of the private acceptance fixture.
alter table public.properties add constraint pi_acceptance_fixture_stays_private
  check (id <> '07343e87-1ef8-4ca5-a88e-be49d95431a7'::uuid
    or (publish_to_showcase is false));

-- Run this after creating your admin user
-- First set your user as admin:
-- UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_USER_UUID';

create policy "admins_full_providers" on providers
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "admins_read_all_profiles" on profiles
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

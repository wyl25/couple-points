-- Run supabase/schema.sql first, then run this file.
-- Your invite code is: love-0525

insert into spaces (name, invite_hash)
values (
  'Our Points',
  'ddf96e8a0df1b8367d63deb6aa27a5ee3676f8469496e15b76d74755699895b7'
)
on conflict (invite_hash) do nothing;

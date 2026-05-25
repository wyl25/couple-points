# Couple Points

A shared points system for couples or small groups. Tasks add points to members, rewards create pending redemption requests, and approved redemptions deduct points.

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Run `supabase/seed.sql` in the Supabase SQL editor.
4. Fill the three empty Supabase values in `.env.local`.
5. Run `npm install` and `npm run dev`.

Default invite code:

```text
love-0525
```

The invite code works only with the `INVITE_HASH_SECRET` already saved in `.env.local` and the matching hash in `supabase/seed.sql`.

## Create the first space

Generate an invite hash with the same `INVITE_HASH_SECRET` you use in `.env.local`:

```bash
node scripts/hash-invite.mjs your-invite-code your-secret
```

Then insert a row into `spaces` with that hash. Example:

```sql
insert into spaces (name, invite_hash) values ('Our Points', '<hash-from-script>');
```

Deploy to Vercel with the same environment variables.

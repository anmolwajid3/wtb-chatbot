-- Delete the named synthetic coaches and their sign-in rows.
-- Run: psql "$DATABASE_URL" -f scripts/delete_synthetic_coaches.sql
-- coach_accounts.coach_id references coaches, so the accounts go with the profile.

DELETE FROM coaches
WHERE coach_name ILIKE 'Synteettinen valmentaja%'
   OR coach_name ILIKE 'Usersynthetic%'
   OR coach_name IN ('WTB Coach One', 'WTB Coach Two', 'WTB Coach Three')
   OR id IN (
     SELECT coach_id
     FROM coach_accounts
     WHERE lower(username) IN ('user', 'usersynthetic', 'coach.one', 'coach.two', 'coach.three')
   );

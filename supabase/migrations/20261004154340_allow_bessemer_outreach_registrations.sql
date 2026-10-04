alter policy outreach_insert_public
on public.outreach_registrations
with check (
  user_id is null
  and source = any (array['st_lucia_2026'::text, 'bessemer_al_2026'::text])
  and length(btrim(first_name)) >= 1
  and length(btrim(first_name)) <= 100
  and length(btrim(last_name)) >= 1
  and length(btrim(last_name)) <= 100
  and length(btrim(email)) >= 5
  and length(btrim(email)) <= 320
  and length(btrim(phone)) >= 7
  and length(btrim(phone)) <= 40
  and consent = true
);

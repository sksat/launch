-- Dev seed data — NOT a real migration. Apply manually for local testing.
-- Today is 2026-04-18 (Saturday)

-- Clear in FK-safe order: rows that reference users (or missions) must
-- go first. `sites WHERE is_default = 0` preserves bundled defaults
-- populated by `pnpm sites:sync`; re-run the sync after this seed if
-- those got wiped.
DELETE FROM schedule_votes;
DELETE FROM schedule_poll_options;
DELETE FROM schedule_polls;
DELETE FROM mission_participants;
DELETE FROM missions;
DELETE FROM friendships;
DELETE FROM sites WHERE is_default = 0;
DELETE FROM users;

-- Mock users (IDs match the SHA-256 hash logic in mock-callback)
-- We pre-insert so participants/creator FKs resolve.
INSERT INTO users (id, login, display_name, avatar_url) VALUES
  (431106, 'sksat',    'sksat',    'https://github.com/sksat.png?size=80'),
  (584704, 'pepepper', 'pepepper', 'https://github.com/pepepper.png?size=80');

-- ---------- Upcoming missions ----------

-- T-5 #1 -- Monday morning rideshare (3 days out)
INSERT INTO missions (id, external_id, template_id, callsign, seq, title, description, visibility, status, scheduled_at, launch_site, target_orbit, vehicle, created_by)
VALUES (1, '567613b2', 'rideshare', 'T-5', 1, 'Monday Carpool',
  'Coffee at Komeda before merging onto the highway. Don''t be late, we''re tracking the launch window.',
  'authenticated', 'scheduled', '2026-04-20T05:00:00Z',
  'Tsukuba — Building A Parking Lot', 'Ariake — Office Building B',
  'Honda Fit (white) -- KAW 42-19', 431106);

INSERT INTO mission_participants (mission_id, user_id, role) VALUES
  (1, 431106, 'commander'),
  (1, 584704, 'crew');

-- T-8 #4 -- Tuesday rideshare (4 days out)
INSERT INTO missions (id, external_id, template_id, callsign, seq, title, description, visibility, status, scheduled_at, launch_site, target_orbit, vehicle, created_by)
VALUES (2, 'daddfddc', 'rideshare', 'T-8', 4, 'Late Start Tuesday',
  'Standard route. Booster recovery (return ride) at T+10h.',
  'authenticated', 'scheduled', '2026-04-21T08:00:00Z',
  'Tsukuba Station South Exit', 'Ariake',
  'Toyota Prius (silver)', 584704);

INSERT INTO mission_participants (mission_id, user_id, role) VALUES
  (2, 584704, 'commander'),
  (2, 431106, 'crew');

-- L-12 #7 -- Lunch refueling (today!)
INSERT INTO missions (id, external_id, template_id, callsign, seq, title, description, visibility, status, scheduled_at, launch_site, target_orbit, vehicle, created_by)
VALUES (3, '2c077f42', 'refueling', 'L-12', 7, 'Ramen Run',
  'New tonkotsu place opened next to the office. Reservation under "PEPEPPER/2".',
  'authenticated', 'go', '2026-04-18T12:00:00Z',
  'Office Lobby', 'Menya Hashimoto', 'Walk', 584704);

INSERT INTO mission_participants (mission_id, user_id, role) VALUES
  (3, 584704, 'commander'),
  (3, 431106, 'crew');

-- SPEC-002 -- Bowling night (next week, public)
INSERT INTO missions (id, external_id, template_id, callsign, seq, title, description, visibility, status, scheduled_at, launch_site, target_orbit, vehicle, created_by)
VALUES (4, '45cd3b5b', 'special', 'SPEC-002', 2, 'Team Bowling Night',
  'Quarterly team event. RSVP by Friday. Drinks after at the izakaya.',
  'public', 'scheduled', '2026-04-25T19:00:00Z',
  'Office', 'Round1 Tsukuba', 'Various', 431106);

INSERT INTO mission_participants (mission_id, user_id, role) VALUES
  (4, 431106, 'commander'),
  (4, 584704, 'crew');

-- ---------- Planning mission with active poll ----------

-- SPEC-003 -- Karaoke, time TBD
INSERT INTO missions (id, external_id, template_id, callsign, seq, title, description, visibility, status, scheduled_at, launch_site, target_orbit, vehicle, created_by)
VALUES (5, 'c89d7fbd', 'special', 'SPEC-003', 3, 'Karaoke Mission',
  'Voting on the launch window. Lock it in by Wednesday.',
  'authenticated', 'planning', NULL,
  'Office', 'Karaoke Kan Akihabara', 'Train', 584704);

INSERT INTO mission_participants (mission_id, user_id, role) VALUES
  (5, 584704, 'commander'),
  (5, 431106, 'crew');

INSERT INTO schedule_polls (id, mission_id, title, created_by) VALUES
  (1, 5, 'Karaoke Launch Window', 584704);

INSERT INTO schedule_poll_options (id, poll_id, starts_at, ends_at, sort_order) VALUES
  (1, 1, '2026-04-23T19:00:00Z', '2026-04-23T22:00:00Z', 0),
  (2, 1, '2026-04-24T20:00:00Z', '2026-04-24T23:00:00Z', 1),
  (3, 1, '2026-04-25T19:00:00Z', '2026-04-25T22:00:00Z', 2);

INSERT INTO schedule_votes (option_id, user_id, availability) VALUES
  (1, 431106, 'available'),
  (1, 584704, 'maybe'),
  (2, 431106, 'unavailable'),
  (2, 584704, 'available'),
  (3, 431106, 'available'),
  (3, 584704, 'available');

-- ---------- Past missions (archive) ----------

INSERT INTO missions (id, external_id, template_id, callsign, seq, title, description, visibility, status, scheduled_at, launch_site, target_orbit, vehicle, created_by)
VALUES (6, '227a2bda', 'rideshare', 'T-5', 0, 'Wednesday Carpool',
  'Nominal mission. Coffee was hot.', 'authenticated', 'completed', '2026-04-15T05:00:00Z',
  'Tsukuba', 'Ariake', 'Honda Fit (white)', 431106);
INSERT INTO mission_participants (mission_id, user_id, role) VALUES
  (6, 431106, 'commander'), (6, 584704, 'crew');

INSERT INTO missions (id, external_id, template_id, callsign, seq, title, description, visibility, status, scheduled_at, launch_site, target_orbit, vehicle, created_by)
VALUES (7, '6f64eb83', 'refueling', 'L-12', 6, 'Curry Mission',
  'New curry place. Spicy rating: 8/10.', 'authenticated', 'completed', '2026-04-16T12:00:00Z',
  'Office', 'Tokyo Curry Lab', 'Walk', 584704);
INSERT INTO mission_participants (mission_id, user_id, role) VALUES
  (7, 584704, 'commander'), (7, 431106, 'crew');

INSERT INTO missions (id, external_id, template_id, callsign, seq, title, description, visibility, status, scheduled_at, launch_site, target_orbit, vehicle, created_by)
VALUES (8, 'dcf2ef95', 'rideshare', 'T-8', 3, 'Rainy Tuesday',
  'Scrubbed due to weather; rescheduled later in the week.', 'authenticated', 'scrubbed', '2026-04-14T08:00:00Z',
  'Tsukuba', 'Ariake', NULL, 584704);
INSERT INTO mission_participants (mission_id, user_id, role) VALUES
  (8, 584704, 'commander');

-- Update the seq counter so the next T-5 gets #2 not #1
UPDATE missions SET seq = 2 WHERE id = 6;

-- 0001_initial.sql
-- launch.sksat.dev — full initial schema.
--
-- Collapsed from 0001..0005 before first deploy. Nothing shipped under
-- the intermediate split (image_key column, mission.external_id,
-- poll UNIQUE index, friends visibility were all layered on via
-- separate migrations during development), so prod starts with one
-- clean baseline.

PRAGMA defer_foreign_keys = true;

---------------------------------------------------------------------
-- users: cached GitHub profile data
---------------------------------------------------------------------
CREATE TABLE users (
    id              INTEGER PRIMARY KEY,          -- GitHub user ID (numeric)
    login           TEXT    NOT NULL UNIQUE,       -- GitHub username (stored lowercased)
    display_name    TEXT    NOT NULL,              -- GitHub display name
    avatar_url      TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
) STRICT;

---------------------------------------------------------------------
-- sites: the single registry of physical places. A given row can be
-- referenced by a mission as either its launch_site (origin) or target
-- (destination), or both — see missions.launch_site_id / target_id.
---------------------------------------------------------------------
CREATE TABLE sites (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    slug                  TEXT    NOT NULL UNIQUE,   -- URL key: "tsukuba-bldg-a", "zeyo"
    name                  TEXT    NOT NULL,
    description           TEXT    NOT NULL DEFAULT '',
    visibility            TEXT    NOT NULL DEFAULT 'authenticated'
                                  CHECK (visibility IN ('public', 'authenticated', 'friends', 'private')),
    image_source          TEXT    CHECK (image_source IS NULL OR image_source IN ('url', 'upload', 'google_places')),
    -- 'url' source: external URL. 'upload'/google_places: null here (see image_key / google_*).
    image_url             TEXT,
    -- 'upload' source: R2 object key (e.g. sites/42/abc-def.jpg). Served
    -- through /sites/:slug/image with a visibility check rather than via
    -- a direct R2 custom domain.
    image_key             TEXT,
    google_place_id       TEXT,                      -- Places API (New) resource id
    google_photo_name     TEXT,                      -- Places API photo resource name for re-resolution
    google_attribution    TEXT,                      -- photo author attribution (TOS: must display)
    latitude              REAL,
    longitude             REAL,
    address               TEXT,
    is_default            INTEGER NOT NULL DEFAULT 0, -- 1: sourced from sites.json, not user-editable
    created_by            INTEGER REFERENCES users(id), -- NULL for defaults
    created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE INDEX idx_sites_visibility ON sites (visibility);
CREATE INDEX idx_sites_created_by ON sites (created_by);
CREATE INDEX idx_sites_is_default ON sites (is_default);

---------------------------------------------------------------------
-- missions
---------------------------------------------------------------------
CREATE TABLE missions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Opaque UUID v4 for URL routing (/missions/:external_id). The
    -- INTEGER PK remains the FK authority for participants/polls/etc.
    external_id     TEXT,
    template_id     TEXT    NOT NULL,              -- references mission-templates.json id
    callsign        TEXT    NOT NULL,              -- e.g., "T-5", "L-12", "V-001"
    seq             INTEGER NOT NULL,              -- per-callsign sequence (1, 2, 3, ...)
    title           TEXT    NOT NULL DEFAULT '',
    description     TEXT    NOT NULL DEFAULT '',
    visibility      TEXT    NOT NULL DEFAULT 'authenticated'
                            CHECK (visibility IN ('public', 'authenticated', 'friends', 'participants')),
    status          TEXT    NOT NULL DEFAULT 'planning'
                            CHECK (status IN ('planning', 'scheduled', 'go', 'completed', 'scrubbed')),
    scheduled_at    TEXT,                          -- ISO-8601 datetime, NULL until confirmed
    launch_site     TEXT,                          -- free-text label (null when launch_site_id is set)
    launch_site_id  INTEGER REFERENCES sites(id),
    target_orbit    TEXT,                          -- free-text label (null when target_id is set)
    target_id       INTEGER REFERENCES sites(id),
    vehicle         TEXT,                          -- structured: car / transport
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (callsign, seq)
) STRICT;

CREATE UNIQUE INDEX idx_missions_external_id ON missions (external_id);
CREATE INDEX idx_missions_template    ON missions (template_id);
CREATE INDEX idx_missions_callsign    ON missions (callsign);
CREATE INDEX idx_missions_status      ON missions (status);
CREATE INDEX idx_missions_scheduled   ON missions (scheduled_at);
CREATE INDEX idx_missions_created_by  ON missions (created_by);
CREATE INDEX idx_missions_launch_site ON missions (launch_site_id);
CREATE INDEX idx_missions_target      ON missions (target_id);

---------------------------------------------------------------------
-- mission_participants: who is aboard each mission
---------------------------------------------------------------------
CREATE TABLE mission_participants (
    mission_id      INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    role            TEXT    NOT NULL DEFAULT 'crew'
                            CHECK (role IN ('commander', 'crew')),
    boarded_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (mission_id, user_id)
) STRICT;

CREATE INDEX idx_participants_user ON mission_participants (user_id);

---------------------------------------------------------------------
-- friendships: one row per requester→addressee direction. `accepted`
-- rows stay; "are A and B friends?" must check both directions.
---------------------------------------------------------------------
CREATE TABLE friendships (
    requester_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          TEXT    NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    responded_at    TEXT,
    PRIMARY KEY (requester_id, addressee_id),
    CHECK (requester_id <> addressee_id)
) STRICT;

CREATE INDEX idx_friendships_addressee_status ON friendships (addressee_id, status);
CREATE INDEX idx_friendships_requester_status ON friendships (requester_id, status);

---------------------------------------------------------------------
-- schedule_polls: launch window negotiation poll (one per mission)
---------------------------------------------------------------------
CREATE TABLE schedule_polls (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id      INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    title           TEXT    NOT NULL DEFAULT 'Launch Window Poll',
    closes_at       TEXT,                          -- optional deadline (ISO-8601)
    is_closed       INTEGER NOT NULL DEFAULT 0,    -- boolean
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE UNIQUE INDEX idx_schedule_polls_mission_id ON schedule_polls (mission_id);

---------------------------------------------------------------------
-- schedule_poll_options: candidate time slots
---------------------------------------------------------------------
CREATE TABLE schedule_poll_options (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id         INTEGER NOT NULL REFERENCES schedule_polls(id) ON DELETE CASCADE,
    starts_at       TEXT    NOT NULL,              -- ISO-8601 datetime
    ends_at         TEXT    NOT NULL,              -- ISO-8601 datetime
    sort_order      INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE INDEX idx_poll_options_poll ON schedule_poll_options (poll_id);

---------------------------------------------------------------------
-- schedule_votes: individual availability per option
---------------------------------------------------------------------
CREATE TABLE schedule_votes (
    option_id       INTEGER NOT NULL REFERENCES schedule_poll_options(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    availability    TEXT    NOT NULL DEFAULT 'available'
                            CHECK (availability IN ('available', 'maybe', 'unavailable')),
    voted_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (option_id, user_id)
) STRICT;

CREATE INDEX idx_votes_user ON schedule_votes (user_id);

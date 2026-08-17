-- FloatChat PostgreSQL practice commands
-- Connect first: psql -U postgres -d floatchat
-- (or in psql: \c floatchat)


-- ── psql meta-commands (not SQL, but essential) ──────────────────────────────

\dt                      -- list tables
\d argo_profiles         -- describe a table's columns/types/indexes
\d argo_readings
\dt+                     -- list tables with size info
\l                       -- list all databases
\du                      -- list all users/roles
\di                      -- list indexes
\x                       -- toggle expanded output (great for wide rows)
\q                       -- quit psql


-- ── Basic SELECT ──────────────────────────────────────────────────────────────

SELECT * FROM argo_profiles LIMIT 10;

SELECT profile_id, float_id, cycle_number, latitude, longitude
FROM argo_profiles
ORDER BY record_time DESC
LIMIT 5;

SELECT COUNT(*) FROM argo_profiles;
SELECT COUNT(*) FROM argo_readings;


-- ── WHERE filtering ───────────────────────────────────────────────────────────

SELECT * FROM argo_profiles WHERE float_id = '2903954';

SELECT * FROM argo_profiles WHERE latitude > 0;       -- northern hemisphere

SELECT * FROM argo_readings WHERE pressure < 10;       -- surface readings

SELECT * FROM argo_profiles
WHERE record_time BETWEEN '2023-01-01' AND '2023-12-31';


-- ── Aggregates (COUNT, AVG, MIN, MAX, SUM) ────────────────────────────────────

SELECT AVG(temperature) FROM argo_readings;

SELECT MIN(temperature), MAX(temperature) FROM argo_readings;

SELECT profile_id, AVG(salinity) AS avg_salinity
FROM argo_readings
GROUP BY profile_id
ORDER BY avg_salinity DESC
LIMIT 5;

SELECT COUNT(*) FROM argo_readings WHERE temperature IS NULL;


-- ── JOINs ─────────────────────────────────────────────────────────────────────

SELECT p.profile_id, p.latitude, p.longitude, r.pressure, r.temperature
FROM argo_profiles p
JOIN argo_readings r ON p.profile_id = r.profile_id
WHERE p.profile_id = '2903954_5'
ORDER BY r.pressure ASC
LIMIT 10;

-- profiles with no readings (should be empty if ingestion worked correctly)
SELECT p.profile_id
FROM argo_profiles p
LEFT JOIN argo_readings r ON p.profile_id = r.profile_id
WHERE r.id IS NULL;


-- ── cycle_number vs profile_id (a real gotcha in this schema) ────────────────

-- WRONG: profile_id is VARCHAR, not orderable as a range
-- SELECT * FROM argo_profiles WHERE profile_id BETWEEN '2903954_5' AND '2903954_15';

-- RIGHT: use cycle_number (INTEGER) for ranges
SELECT * FROM argo_profiles
WHERE float_id = '2903954' AND cycle_number BETWEEN 5 AND 15
ORDER BY cycle_number;


-- ── Subqueries ────────────────────────────────────────────────────────────────

-- profile with the highest average salinity
SELECT profile_id, avg_sal FROM (
    SELECT profile_id, AVG(salinity) AS avg_sal
    FROM argo_readings
    GROUP BY profile_id
) sub
ORDER BY avg_sal DESC
LIMIT 1;


-- ── INSERT / UPDATE / DELETE (practice on a scratch table, not real data) ────

CREATE TABLE scratch_test (
    id SERIAL PRIMARY KEY,
    label TEXT,
    value FLOAT
);

INSERT INTO scratch_test (label, value) VALUES ('a', 1.5), ('b', 2.5);

SELECT * FROM scratch_test;

UPDATE scratch_test SET value = 9.9 WHERE label = 'a';

DELETE FROM scratch_test WHERE label = 'b';

DROP TABLE scratch_test;   -- cleanup


-- ── EXPLAIN (see how the query planner uses your indexes) ────────────────────

EXPLAIN ANALYZE
SELECT * FROM argo_readings WHERE profile_id = '2903954_5' ORDER BY pressure;

-- compare against a query that can't use the index efficiently
EXPLAIN ANALYZE
SELECT * FROM argo_readings WHERE temperature > 25;


-- ── Indexes already in this schema (from migrate_db.py) ───────────────────────

\d argo_readings   -- look for idx_readings_profile_id, idx_readings_profile_pressure
\d argo_profiles   -- look for idx_profiles_record_time


-- ── chat_sessions / chat_messages (the app's own tables) ──────────────────────

SELECT * FROM chat_sessions ORDER BY created_at DESC LIMIT 5;

SELECT role, content, sql FROM chat_messages
WHERE session_id = (SELECT id FROM chat_sessions ORDER BY created_at DESC LIMIT 1)
ORDER BY created_at ASC;


-- ── float_sync_state (new table, from the daily sync pipeline) ───────────────

SELECT * FROM float_sync_state ORDER BY last_checked_at DESC;

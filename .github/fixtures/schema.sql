-- Fixture for the database backed end to end test in src/app.rs.
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS orgs;

CREATE TABLE orgs (
  id serial PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE users (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text,
  org_id integer REFERENCES orgs (id),
  active boolean NOT NULL DEFAULT true,
  tags text[],
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO orgs (name) VALUES ('Acme'), ('Globex');

INSERT INTO users (name, email, org_id, tags, meta)
SELECT
  'user ' || i,
  CASE WHEN i % 3 = 0 THEN NULL ELSE 'u' || i || '@example.com' END,
  (i % 2) + 1,
  ARRAY['a', 'b'],
  jsonb_build_object('n', i)
FROM generate_series(1, 42) i;

# Data Sources

Custom SQL widgets target Postgres databases declared in
`config/data_sources.json`. Every data source must connect via a dedicated
read-only role; the dashboard refuses to execute SQL widgets through any other
account.

## Adding a data source

1. Create the read-only role in the target database:

   ```sql
   CREATE ROLE <name>_ro NOINHERIT LOGIN PASSWORD '<strong password>';
   GRANT CONNECT ON DATABASE <db> TO <name>_ro;
   GRANT USAGE ON SCHEMA public TO <name>_ro;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO <name>_ro;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT SELECT ON TABLES TO <name>_ro;
   ```

2. Add an entry to `config/data_sources.json`:

   ```json
   {
     "<name>": {
       "kind": "app",
       "scope": "app",
       "app_slug": "<slug if app-bound>",
       "db_ro": {
         "host": "localhost",
         "port": 5432,
         "database": "<db>",
         "user": "<name>_ro"
       }
     }
   }
   ```

3. Add the password to the `DATA_SOURCE_RO_PASSWORDS_JSON` env variable. The
   variable holds a JSON object keyed by data source name:

   ```json
   {"<name>":"<strong password>", "sportly":"...", "honeydoeh":"..."}
   ```

4. Restart the dashboard. New SQL widgets can now target the source.

## Dashboard data source

If `dashboard` is omitted from `data_sources.json`, the loader auto-creates an
entry using `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. To
override, declare `dashboard` explicitly in the JSON.

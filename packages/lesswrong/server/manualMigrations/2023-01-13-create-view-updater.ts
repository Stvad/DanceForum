import { getSqlClientOrThrow } from '../../lib/sql/sqlClient';
import { registerMigration } from './migrationUtils';

// Postgres tables have weird casing because of legacy requirements
// This creates a set of views which are a case insensitive copy of the actual tables
registerMigration({
  name: "createViewUpdater",
  dateWritten: "2023-01-13",
  idempotent: false,
  action: async () => {
    const db = getSqlClientOrThrow();

    const sql = `
    create function refresh_lowercase_views() returns void as
    $$
    DECLARE
        rec record;
    BEGIN
      FOR rec IN 
        select table_name,
          STRING_AGG('"' || column_name || '" as ' || column_name, ', ') cols
        from information_schema."columns"
        inner join information_schema."tables" using (table_name)
        where "columns".table_schema = 'public'
          and table_name not in ('migration_log', 'mongo2pg_lock')
          and table_type = 'BASE TABLE'
        group by table_name
      LOOP
            EXECUTE format(E'drop view if exists %s; create view %s as select %s from %I;',
                rec.table_name, rec.table_name, rec.cols, rec.table_name);
        END LOOP;
    END;
    $$
    LANGUAGE plpgsql;

    create function remove_lowercase_views() returns void as
    $$
    DECLARE
        rec record;
    BEGIN
      FOR rec IN 
        select table_name,
          STRING_AGG('"' || column_name || '" as ' || column_name, ', ') cols
        from information_schema."columns"
        inner join information_schema."tables" using (table_name)
        where "columns".table_schema = 'public'
          and table_name not in ('migration_log', 'mongo2pg_lock')
          and table_type = 'BASE TABLE'
        group by table_name
      LOOP
            EXECUTE format(E'drop view if exists %s', rec.table_name);
        END LOOP;
    END;
    $$
    LANGUAGE plpgsql;
    `
    await db.any(sql)
  }
})

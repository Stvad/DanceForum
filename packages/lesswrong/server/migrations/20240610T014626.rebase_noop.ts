/**
 * Generated on 2024-06-10T01:46:26.717Z by `yarn makemigrations`
 * The following schema changes were detected:
 * -------------------------------------------
 * ***Diff too large to display***
 * -------------------------------------------
 * (run `git diff --no-index schema/accepted_schema.sql schema/schema_to_accept.sql` to see this more clearly)
 *
 * - [ ] Write a migration to represent these changes
 * - [ ] Rename this file to something more readable
 * - [ ] Uncomment `acceptsSchemaHash` below
 * - [ ] Run `yarn acceptmigrations` to update the accepted schema hash (running makemigrations again will also do this)
 */
export const acceptsSchemaHash = "369a319cca4b365db2c976b7f74f49c2";

export const up = async ({db}: MigrationContext) => {
  // post rebase no-op migration
}

export const down = async ({db}: MigrationContext) => {
  // TODO, not required
}

import {addField, dropField} from './meta/utils'
import Users from '../../lib/collections/users/collection'

/**
 * Generated on 2024-04-29T19:12:55.977Z by `yarn makemigrations`
 * The following schema changes were detected:
 * -------------------------------------------
 * /Users/vlad/coding/dance/fm/ForumMagnum/schema/schema_to_accept.sql --- 1/3 --- Text (8 SQL parse errors, exceeded DFT_PARSE_ERROR_LIMIT)
 * Renamed from /Users/vlad/coding/dance/fm/ForumMagnum/schema/accepted_schema.sql to /Users/vlad/coding/dance/fm/ForumMagnum/schema/schema_to_accept.sql
 *  2 -- Do not edit this file directly. I 2 -- Do not edit this file directly. I
 *  . nstead, start a server and run "yarn . nstead, start a server and run "yarn
 *  .  makemigrations"                     .  makemigrations"
 *  3 -- as described in the README. This  3 -- as described in the README. This 
 *  . file should nevertheless be checked  . file should nevertheless be checked 
 *  . in to version control.               . in to version control.
 *  4 --                                   4 --
 *  5 -- Overall schema hash: c192cfffc5d0 5 -- Overall schema hash: 501675659a25
 *  . 7ae27caf1477da048644                 . e292d63216f08d78c445
 *  6                                      6 
 *  7 -- Accepted on 2024-04-25T07:56:39.0 . 
 *  . 00Z by 20240425T075639.add_people_di . 
 *  . rectory.ts                           . 
 *  8                                      . 
 *  9 -- Extension "btree_gin", hash: 8833 7 -- Extension "btree_gin", hash: 8833
 *  . dd03dc128e186d2c560d248354fb         . dd03dc128e186d2c560d248354fb
 * 10 CREATE EXTENSION IF NOT EXISTS "btre 8 CREATE EXTENSION IF NOT EXISTS "btre
 * .. e_gin" CASCADE;                      . e_gin" CASCADE;
 * 11                                      9 
 * 
 * /Users/vlad/coding/dance/fm/ForumMagnum/schema/schema_to_accept.sql --- 2/3 --- Text (8 SQL parse errors, exceeded DFT_PARSE_ERROR_LIMIT)
 * 1339     "legacyData" jsonb             1337     "legacyData" jsonb
 * 1340 );                                 1338 );
 * 1341                                    1339 
 * 1342 -- Schema for "Users", hash: 20c57 1340 -- Schema for "Users", hash: 9fdf3
 * .... 044088f779a4667f0ef064ad255        .... 0c97e114fa7115c58cfab5497bf
 * 1343 CREATE TABLE "Users" (             1341 CREATE TABLE "Users" (
 * 1344     _id varchar(27) PRIMARY KEY,   1342     _id varchar(27) PRIMARY KEY,
 * 1345     "username" text,               1343     "username" text,
 * 
 * /Users/vlad/coding/dance/fm/ForumMagnum/schema/schema_to_accept.sql --- 3/3 --- Text (8 SQL parse errors, exceeded DFT_PARSE_ERROR_LIMIT)
 * 1556 1554     "afSubmittedApplication" bool,
 * 1557 1555     "hideSunshineSidebar" bool NOT NULL DEFAULT false,
 * 1558 1556     "inactiveSurveyEmailSentAt" timestamptz,
 * .... 1557     "wsdcNumber" double precision,
 * 1559 1558     "schemaVersion" double precision NOT NULL DEFAULT 1,
 * 1560 1559     "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
 * 1561 1560     "legacyData" jsonb,
 * 
 * 
 * -------------------------------------------
 * (run `git diff --no-index schema/accepted_schema.sql schema/schema_to_accept.sql` to see this more clearly)
 *
 * - [ ] Write a migration to represent these changes
 * - [ ] Rename this file to something more readable
 * - [ ] Uncomment `acceptsSchemaHash` below
 * - [ ] Run `yarn acceptmigrations` to update the accepted schema hash (running makemigrations again will also do this)
 */
export const acceptsSchemaHash = "501675659a25e292d63216f08d78c445";

export const up = async ({db}: MigrationContext) => {
  await addField(db, Users, "wsdcNumber");
}

export const down = async ({db}: MigrationContext) => {
  await dropField(db, Users, "wsdcNumber");
}

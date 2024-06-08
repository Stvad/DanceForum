import SurveySchedules from "@/lib/collections/surveySchedules/collection";
import AbstractRepo from "./AbstractRepo";
import { recordPerfMetrics } from "./perfMetricWrapper";

export type SurveyScheduleWithSurvey = DbSurveySchedule & {
  survey: DbSurvey,
};

class SurveySchedulesRepo extends AbstractRepo<"SurveySchedules"> {
  constructor() {
    super(SurveySchedules);
  }

  getCurrentFrontpageSurvey(
    currentUser: DbUser | null,
    clientId: string,
  ): Promise<SurveyScheduleWithSurvey | null> {
    const isLoggedIn = !!currentUser;
    const userJoin = isLoggedIn
      ? `LEFT JOIN "Users" u ON u."_id" = $3`
      : "";
    const karmaClause = isLoggedIn
      ? `
        CASE
          WHEN ss."minKarma" IS NULL THEN TRUE
          ELSE ss."minKarma" < COALESCE(u."karma", 0)
        END AND
        CASE
          WHEN ss."maxKarma" IS NULL THEN TRUE
          ELSE ss."maxKarma" > COALESCE(u."karma", 0)
        END AND
      `
      : ""
    return this.getRawDb().oneOrNone(`
      SELECT ss.*, ROW_TO_JSON(s.*) "survey"
      FROM "SurveySchedules" ss
      JOIN "Surveys" s ON
        s."_id" = ss."surveyId"
      LEFT JOIN "SurveyResponses" sr ON
        sr."surveyScheduleId" = ss."_id" AND
        (sr."clientId" = $2 OR (sr."userId" IS NOT NULL AND sr."userId" = $3))
      ${userJoin}
      WHERE
        -- Check the schedule is currently running
        (ss."endDate" IS NULL OR ss."endDate" > CURRENT_TIMESTAMP) AND
        (ss."startDate" IS NULL OR ss."startDate" < CURRENT_TIMESTAMP) AND
        ss."deactivated" IS NOT TRUE AND
        -- Check the user meets karma requirements
        ${karmaClause}
        -- Check the user is in the target group
        CASE ss."target"
          WHEN 'loggedInOnly' THEN $1
          WHEN 'loggedOutOnly' THEN NOT $1
          ELSE TRUE
        END AND
        -- Check the user hasn't already responsed to this schedule
        sr."_id" IS NULL AND
        -- Check the user hasn't responded to any scheduled survey in the last week
        NOT EXISTS (
          SELECT 1
          FROM "SurveyResponses"
          WHERE
            ("clientId" = $2 OR ("userId" IS NOT NULL AND "userId" = $3)) AND
            "createdAt" + '1 week'::INTERVAL > CURRENT_TIMESTAMP AND
            "surveyScheduleId" IS NOT NULL
          LIMIT 1
        )
      ORDER BY
        ss."clientIds" @> ('{' || $2 || '}')::VARCHAR[] DESC,
        "endDate" ASC,
        "_id" DESC
      LIMIT 1
    `, [isLoggedIn, clientId, currentUser?._id]);
  }

  async assignClientToSurveySchedule(
    surveyScheduleId: string,
    clientId: string,
  ): Promise<void> {
    await this.none(`
      UPDATE "SurveySchedules"
      SET "clientIds" = FM_ADD_TO_SET("clientIds", $2)
      WHERE "_id" = $1
    `, [surveyScheduleId, clientId]);
  }
}

recordPerfMetrics(SurveySchedulesRepo);

export default SurveySchedulesRepo;

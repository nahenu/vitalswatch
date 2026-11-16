import { boolean, doublePrecision, index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import type { Diagnostics } from "@/lib/diagnostics";
import type { FieldData, Opportunity, Strategy, Trigger } from "@/lib/vitals";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

// ---- Better Auth tables (names and fields follow its Drizzle adapter) -------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

// ---- VitalsWatch --------------------------------------------------------------

export const sites = pgTable(
  "sites",
  {
    /** Short public id, used in report and screenshot links. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    /** Anyone with the link can view a read-only report at /r/[id]. */
    isPublic: boolean("is_public").default(false).notNull(),
    /** Email the owner when the mobile score falls this many points below its recent median. 0 = off. */
    alertDrop: integer("alert_drop").default(10).notNull(),
    lastAlertAt: timestamp("last_alert_at", { withTimezone: true }),
    /** Secret for the deploy webhook (POST /api/deploys). */
    deployToken: text("deploy_token").notNull(),
    ...timestamps,
  },
  (t) => [index("sites_user_idx").on(t.userId, t.createdAt)],
);

/** One Lighthouse run (lab) plus the Chrome UX Report snapshot (field) PageSpeed returned with it. */
export const checks = pgTable(
  "checks",
  {
    id: serial("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    strategy: text("strategy").$type<Strategy>().notNull(),
    trigger: text("trigger").$type<Trigger>().notNull(),
    /** Lighthouse performance score, 0–100. Null when the run failed. */
    score: integer("score"),
    lcp: doublePrecision("lcp"),
    cls: doublePrecision("cls"),
    tbt: doublePrecision("tbt"),
    fcp: doublePrecision("fcp"),
    si: doublePrecision("si"),
    ttfb: doublePrecision("ttfb"),
    field: jsonb("field").$type<FieldData>(),
    opportunities: jsonb("opportunities").$type<Opportunity[]>(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("checks_site_idx").on(t.siteId, t.strategy, t.createdAt)],
);

/**
 * The detailed half of a run (elements, files, fixes, screenshots). Kept in its
 * own table because it's ~100x bigger than the numbers, and pruned to the most
 * recent runs per site and device.
 */
export const checkDetails = pgTable(
  "check_details",
  {
    checkId: integer("check_id")
      .primaryKey()
      .references(() => checks.id, { onDelete: "cascade" }),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    strategy: text("strategy").$type<Strategy>().notNull(),
    data: jsonb("data").$type<Diagnostics>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("check_details_site_idx").on(t.siteId, t.strategy, t.createdAt)],
);

export const deploys = pgTable(
  "deploys",
  {
    id: serial("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    /** Commit SHA, tag or any short label. */
    ref: text("ref").notNull(),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("deploys_site_idx").on(t.siteId, t.createdAt)],
);

export type SiteRow = typeof sites.$inferSelect;
export type CheckRow = typeof checks.$inferSelect;
export type DeployRow = typeof deploys.$inferSelect;

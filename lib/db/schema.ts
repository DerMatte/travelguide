import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const airportReviews = pgTable(
  "airport_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    iata: varchar("iata", { length: 3 }).notNull(),
    author: text("author").notNull(),
    tripType: text("trip_type").notNull(),
    rating: smallint("rating").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // Moderation kill switch: flip to "hidden" in SQL to pull a review.
    status: text("status", { enum: ["published", "hidden"] })
      .notNull()
      .default("published"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("airport_reviews_iata_created_at_idx").on(table.iata, table.createdAt.desc()),
    index("airport_reviews_ip_hash_created_at_idx").on(table.ipHash, table.createdAt.desc()),
    check("airport_reviews_rating_check", sql`${table.rating} BETWEEN 1 AND 5`),
  ],
);

export type AirportReviewRow = typeof airportReviews.$inferSelect;
export type NewAirportReviewRow = typeof airportReviews.$inferInsert;

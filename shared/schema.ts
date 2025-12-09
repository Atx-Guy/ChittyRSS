import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Categories for organizing feeds
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").default("#6366f1"),
  order: integer("order").default(0),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  feeds: many(feeds),
}));

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// RSS Feeds
export const feeds = pgTable("feeds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  siteUrl: text("site_url"),
  description: text("description"),
  favicon: text("favicon"),
  categoryId: varchar("category_id").references(() => categories.id, { onDelete: "set null" }),
  lastFetched: timestamp("last_fetched"),
  errorCount: integer("error_count").default(0),
  isActive: boolean("is_active").default(true),
});

export const feedsRelations = relations(feeds, ({ one, many }) => ({
  category: one(categories, {
    fields: [feeds.categoryId],
    references: [categories.id],
  }),
  articles: many(articles),
}));

export const insertFeedSchema = createInsertSchema(feeds).omit({
  id: true,
  lastFetched: true,
  errorCount: true,
});

export type InsertFeed = z.infer<typeof insertFeedSchema>;
export type Feed = typeof feeds.$inferSelect;

// Articles from feeds
export const articles = pgTable("articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  feedId: varchar("feed_id").notNull().references(() => feeds.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  content: text("content"),
  summary: text("summary"),
  author: text("author"),
  imageUrl: text("image_url"),
  publishedAt: timestamp("published_at"),
  isRead: boolean("is_read").default(false),
  isBookmarked: boolean("is_bookmarked").default(false),
  guid: text("guid").notNull(),
});

export const articlesRelations = relations(articles, ({ one }) => ({
  feed: one(feeds, {
    fields: [articles.feedId],
    references: [feeds.id],
  }),
}));

export const insertArticleSchema = createInsertSchema(articles).omit({
  id: true,
});

export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articles.$inferSelect;

// Extended types for frontend use
export type FeedWithCategory = Feed & {
  category: Category | null;
  unreadCount?: number;
};

export type ArticleWithFeed = Article & {
  feed: Feed;
};

// Users table (kept from template)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

import {
  users,
  feeds,
  articles,
  categories,
  type User,
  type InsertUser,
  type Feed,
  type InsertFeed,
  type Article,
  type InsertArticle,
  type Category,
  type InsertCategory,
  type FeedWithCategory,
  type ArticleWithFeed,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ilike, or, sql, count } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;

  // Feeds
  getFeeds(): Promise<FeedWithCategory[]>;
  getFeed(id: string): Promise<Feed | undefined>;
  getFeedByUrl(url: string): Promise<Feed | undefined>;
  createFeed(feed: InsertFeed): Promise<Feed>;
  updateFeed(id: string, feed: Partial<InsertFeed & { lastFetched?: Date; errorCount?: number }>): Promise<Feed | undefined>;
  deleteFeed(id: string): Promise<boolean>;

  // Articles
  getArticles(options?: {
    feedId?: string;
    unread?: boolean;
    bookmarked?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<ArticleWithFeed[]>;
  getArticle(id: string): Promise<ArticleWithFeed | undefined>;
  getArticleByGuid(feedId: string, guid: string): Promise<Article | undefined>;
  createArticle(article: InsertArticle): Promise<Article>;
  updateArticle(id: string, article: Partial<InsertArticle>): Promise<Article | undefined>;
  markAllArticlesRead(feedId?: string): Promise<void>;
  getArticleStats(): Promise<{ unread: number; bookmarked: number }>;
  getFeedHealthStats(): Promise<{ totalFeeds: number; failingFeeds: number; feedsWithErrors: Feed[] }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories).orderBy(categories.order, categories.name);
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updated] = await db.update(categories).set(category).where(eq(categories.id, id)).returning();
    return updated || undefined;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id)).returning();
    return result.length > 0;
  }

  // Feeds
  async getFeeds(): Promise<FeedWithCategory[]> {
    const feedsWithCategories = await db.query.feeds.findMany({
      with: {
        category: true,
      },
      orderBy: [feeds.title],
    });

    // Get unread counts for each feed
    const unreadCounts = await db
      .select({
        feedId: articles.feedId,
        count: count(),
      })
      .from(articles)
      .where(eq(articles.isRead, false))
      .groupBy(articles.feedId);

    const unreadMap = new Map(unreadCounts.map((uc) => [uc.feedId, Number(uc.count)]));

    return feedsWithCategories.map((feed) => ({
      ...feed,
      unreadCount: unreadMap.get(feed.id) || 0,
    }));
  }

  async getFeed(id: string): Promise<Feed | undefined> {
    const [feed] = await db.select().from(feeds).where(eq(feeds.id, id));
    return feed || undefined;
  }

  async getFeedByUrl(url: string): Promise<Feed | undefined> {
    const [feed] = await db.select().from(feeds).where(eq(feeds.url, url));
    return feed || undefined;
  }

  async createFeed(feed: InsertFeed): Promise<Feed> {
    const [newFeed] = await db.insert(feeds).values(feed).returning();
    return newFeed;
  }

  async updateFeed(
    id: string,
    feed: Partial<InsertFeed & { lastFetched?: Date; errorCount?: number }>
  ): Promise<Feed | undefined> {
    const [updated] = await db.update(feeds).set(feed).where(eq(feeds.id, id)).returning();
    return updated || undefined;
  }

  async deleteFeed(id: string): Promise<boolean> {
    const result = await db.delete(feeds).where(eq(feeds.id, id)).returning();
    return result.length > 0;
  }

  // Articles
  async getArticles(options?: {
    feedId?: string;
    unread?: boolean;
    bookmarked?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<ArticleWithFeed[]> {
    const conditions = [];

    if (options?.feedId) {
      conditions.push(eq(articles.feedId, options.feedId));
    }

    if (options?.unread) {
      conditions.push(eq(articles.isRead, false));
    }

    if (options?.bookmarked) {
      conditions.push(eq(articles.isBookmarked, true));
    }

    if (options?.search) {
      const searchPattern = `%${options.search}%`;
      conditions.push(
        or(
          ilike(articles.title, searchPattern),
          ilike(articles.summary, searchPattern)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db.query.articles.findMany({
      where: whereClause,
      with: {
        feed: true,
      },
      orderBy: [desc(articles.publishedAt)],
      limit: options?.limit || 100,
      offset: options?.offset || 0,
    });

    return result;
  }

  async getArticle(id: string): Promise<ArticleWithFeed | undefined> {
    const result = await db.query.articles.findFirst({
      where: eq(articles.id, id),
      with: {
        feed: true,
      },
    });

    return result || undefined;
  }

  async getArticleByGuid(feedId: string, guid: string): Promise<Article | undefined> {
    const [article] = await db
      .select()
      .from(articles)
      .where(and(eq(articles.feedId, feedId), eq(articles.guid, guid)));
    return article || undefined;
  }

  async createArticle(article: InsertArticle): Promise<Article> {
    const [newArticle] = await db.insert(articles).values(article).returning();
    return newArticle;
  }

  async updateArticle(id: string, article: Partial<InsertArticle>): Promise<Article | undefined> {
    const [updated] = await db.update(articles).set(article).where(eq(articles.id, id)).returning();
    return updated || undefined;
  }

  async markAllArticlesRead(feedId?: string): Promise<void> {
    if (feedId) {
      await db.update(articles).set({ isRead: true }).where(eq(articles.feedId, feedId));
    } else {
      await db.update(articles).set({ isRead: true });
    }
  }

  async getArticleStats(): Promise<{ unread: number; bookmarked: number }> {
    const [unreadResult] = await db
      .select({ count: count() })
      .from(articles)
      .where(eq(articles.isRead, false));

    const [bookmarkedResult] = await db
      .select({ count: count() })
      .from(articles)
      .where(eq(articles.isBookmarked, true));

    return {
      unread: Number(unreadResult?.count || 0),
      bookmarked: Number(bookmarkedResult?.count || 0),
    };
  }

  async getFeedHealthStats(): Promise<{ totalFeeds: number; failingFeeds: number; feedsWithErrors: Feed[] }> {
    const allFeeds = await db.select().from(feeds);
    const feedsWithErrors = allFeeds.filter(feed => (feed.errorCount || 0) >= 3);
    
    return {
      totalFeeds: allFeeds.length,
      failingFeeds: feedsWithErrors.length,
      feedsWithErrors,
    };
  }
}

export const storage = new DatabaseStorage();

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import Parser from "rss-parser";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { insertFeedSchema, insertCategorySchema } from "@shared/schema";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "ModernFeed RSS Reader/1.0",
  },
});

// Helper to extract favicon URL from a website
async function getFaviconUrl(siteUrl: string): Promise<string | null> {
  try {
    const url = new URL(siteUrl);
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
  } catch {
    return null;
  }
}

// Helper to extract a summary from content
function extractSummary(content: string | undefined, maxLength = 200): string | null {
  if (!content) return null;
  
  // Strip HTML tags
  const text = content.replace(/<[^>]*>/g, "").trim();
  
  if (text.length <= maxLength) return text;
  
  // Find the last space before maxLength to avoid cutting words
  const lastSpace = text.lastIndexOf(" ", maxLength);
  return text.substring(0, lastSpace > 0 ? lastSpace : maxLength) + "...";
}

// Parse and fetch a feed
async function parseFeed(url: string) {
  try {
    const feed = await parser.parseURL(url);
    return { success: true, feed };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to parse feed" };
  }
}

// Concurrent processing with limit
async function mapConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item)).then(result => {
      results.push(result);
    });
    const e = p.then(() => {
      executing.splice(executing.indexOf(e), 1);
    });
    executing.push(e);
    
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
  return results;
}

// Normalize a URL - add protocol if missing
function normalizeUrl(input: string): string {
  let url = input.trim();
  
  // Remove any leading/trailing whitespace and invisible characters
  url = url.replace(/^[\s\u200B]+|[\s\u200B]+$/g, '');
  
  // If it doesn't start with a protocol, add https://
  if (!url.match(/^https?:\/\//i)) {
    url = `https://${url}`;
  }
  
  return url;
}

// Discover RSS feeds from a website URL
async function discoverFeeds(url: string): Promise<{ url: string; title: string; type: string }[]> {
  const feeds: { url: string; title: string; type: string }[] = [];
  
  try {
    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ModernFeed RSS Reader/1.0",
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      return feeds;
    }
    
    const html = await response.text();
    const baseUrl = new URL(url);
    
    // Look for RSS/Atom link tags in the HTML
    const linkRegex = /<link[^>]+(?:type=["'](?:application\/(?:rss|atom)\+xml|text\/xml)["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*type=["'](?:application\/(?:rss|atom)\+xml|text\/xml)["'])[^>]*\/?>/gi;
    const titleRegex = /<link[^>]+title=["']([^"']+)["'][^>]*>/gi;
    
    // Find all link tags with RSS/Atom types
    let match;
    const processedUrls = new Set<string>();
    
    // Pattern 1: type before href
    const pattern1 = /<link[^>]+type=["'](application\/(?:rss|atom)\+xml|text\/xml)["'][^>]*href=["']([^"']+)["'][^>]*(?:title=["']([^"']+)["'])?[^>]*\/?>/gi;
    while ((match = pattern1.exec(html)) !== null) {
      const type = match[1];
      let href = match[2];
      const title = match[3] || "RSS Feed";
      
      // Resolve relative URLs
      if (!href.startsWith("http")) {
        href = new URL(href, baseUrl).toString();
      }
      
      if (!processedUrls.has(href)) {
        processedUrls.add(href);
        feeds.push({
          url: href,
          title: title,
          type: type.includes("atom") ? "Atom" : "RSS",
        });
      }
    }
    
    // Pattern 2: href before type
    const pattern2 = /<link[^>]*href=["']([^"']+)["'][^>]*type=["'](application\/(?:rss|atom)\+xml|text\/xml)["'][^>]*(?:title=["']([^"']+)["'])?[^>]*\/?>/gi;
    while ((match = pattern2.exec(html)) !== null) {
      let href = match[1];
      const type = match[2];
      const title = match[3] || "RSS Feed";
      
      if (!href.startsWith("http")) {
        href = new URL(href, baseUrl).toString();
      }
      
      if (!processedUrls.has(href)) {
        processedUrls.add(href);
        feeds.push({
          url: href,
          title: title,
          type: type.includes("atom") ? "Atom" : "RSS",
        });
      }
    }
    
    // Also check common RSS paths if no feeds found
    if (feeds.length === 0) {
      const commonPaths = [
        "/feed",
        "/feed/",
        "/rss",
        "/rss.xml",
        "/atom.xml",
        "/feed.xml",
        "/index.xml",
        "/blog/feed",
        "/blog/rss",
      ];
      
      for (const path of commonPaths) {
        try {
          const feedUrl = new URL(path, baseUrl).toString();
          const result = await parseFeed(feedUrl);
          if (result.success && result.feed) {
            feeds.push({
              url: feedUrl,
              title: result.feed.title || "RSS Feed",
              type: "RSS",
            });
            break; // Found one, stop looking
          }
        } catch {
          // Continue trying other paths
        }
      }
    }
  } catch (error) {
    console.error("Error discovering feeds:", error);
  }
  
  return feeds;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Categories
  app.get("/api/categories", async (_req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const parsed = insertCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const category = await storage.createCategory(parsed.data);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCategory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Feeds
  app.get("/api/feeds", async (_req, res) => {
    try {
      const feeds = await storage.getFeeds();
      res.json(feeds);
    } catch (error) {
      console.error("Error fetching feeds:", error);
      res.status(500).json({ error: "Failed to fetch feeds" });
    }
  });

  // Feed discovery endpoint
  app.post("/api/feeds/discover", async (req, res) => {
    try {
      const { url: rawUrl } = req.body;
      
      if (!rawUrl) {
        return res.status(400).json({ error: "URL is required" });
      }
      
      // Normalize the URL
      const url = normalizeUrl(rawUrl);
      
      // First, try to parse it directly as an RSS feed
      const directResult = await parseFeed(url);
      if (directResult.success && directResult.feed) {
        // It's already a valid RSS feed
        return res.json({ 
          directFeed: true, 
          feeds: [{
            url,
            title: directResult.feed.title || "RSS Feed",
            type: "RSS"
          }]
        });
      }
      
      // Not a direct feed, try to discover feeds from the website
      const discoveredFeeds = await discoverFeeds(url);
      
      res.json({ 
        directFeed: false, 
        feeds: discoveredFeeds 
      });
    } catch (error) {
      console.error("Error discovering feeds:", error);
      res.status(500).json({ error: "Failed to discover feeds" });
    }
  });

  app.post("/api/feeds", async (req, res) => {
    try {
      let { url, categoryId } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      // Normalize the URL
      url = normalizeUrl(url);

      // Check if feed already exists
      const existingFeed = await storage.getFeedByUrl(url);
      if (existingFeed) {
        return res.status(409).json({ error: "Feed already exists" });
      }

      // Parse the feed to get metadata
      const result = await parseFeed(url);
      if (!result.success || !result.feed) {
        return res.status(400).json({ error: result.error || "Invalid feed URL" });
      }

      const { feed: parsedFeed } = result;

      // Get favicon
      const siteUrl = parsedFeed.link || url;
      const favicon = await getFaviconUrl(siteUrl);

      // Create the feed
      const feed = await storage.createFeed({
        title: parsedFeed.title || "Untitled Feed",
        url,
        siteUrl: parsedFeed.link || null,
        description: parsedFeed.description || null,
        favicon,
        categoryId: categoryId || null,
        isActive: true,
      });

      // Add articles from the feed
      const items = parsedFeed.items || [];
      for (const item of items.slice(0, 50)) {
        const guid = item.guid || item.link || item.title || "";
        
        // Check if article already exists
        const existingArticle = await storage.getArticleByGuid(feed.id, guid);
        if (existingArticle) continue;

        await storage.createArticle({
          feedId: feed.id,
          title: item.title || "Untitled",
          url: item.link || "",
          content: item["content:encoded"] || item.content || null,
          summary: extractSummary(item.contentSnippet || item.content),
          author: item.creator || item.author || null,
          imageUrl: item.enclosure?.url || null,
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          isRead: false,
          isBookmarked: false,
          guid,
        });
      }

      // Update last fetched
      await storage.updateFeed(feed.id, { lastFetched: new Date() });

      res.status(201).json(feed);
    } catch (error) {
      console.error("Error creating feed:", error);
      res.status(500).json({ error: "Failed to create feed" });
    }
  });

  app.delete("/api/feeds/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteFeed(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Feed not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting feed:", error);
      res.status(500).json({ error: "Failed to delete feed" });
    }
  });

  app.post("/api/feeds/refresh", async (_req, res) => {
    try {
      const feeds = await storage.getFeeds();
      const activeFeeds = feeds.filter(f => f.isActive);
      let totalNewArticles = 0;

      // Process 5 feeds concurrently for better performance
      await mapConcurrency(activeFeeds, 5, async (feed) => {
        try {
          const result = await parseFeed(feed.url);
          if (!result.success || !result.feed) {
            await storage.updateFeed(feed.id, { 
              errorCount: (feed.errorCount || 0) + 1 
            });
            return;
          }

          const items = result.feed.items || [];
          for (const item of items.slice(0, 50)) {
            const guid = item.guid || item.link || item.title || "";
            
            const existingArticle = await storage.getArticleByGuid(feed.id, guid);
            if (existingArticle) continue;

            await storage.createArticle({
              feedId: feed.id,
              title: item.title || "Untitled",
              url: item.link || "",
              content: item["content:encoded"] || item.content || null,
              summary: extractSummary(item.contentSnippet || item.content),
              author: item.creator || item.author || null,
              imageUrl: item.enclosure?.url || null,
              publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
              isRead: false,
              isBookmarked: false,
              guid,
            });
            totalNewArticles++;
          }

          await storage.updateFeed(feed.id, { 
            lastFetched: new Date(),
            errorCount: 0,
          });
        } catch (feedError) {
          console.error(`Error refreshing feed ${feed.id}:`, feedError);
          await storage.updateFeed(feed.id, { 
            errorCount: (feed.errorCount || 0) + 1 
          });
        }
      });

      res.json({ success: true, newArticles: totalNewArticles });
    } catch (error) {
      console.error("Error refreshing feeds:", error);
      res.status(500).json({ error: "Failed to refresh feeds" });
    }
  });

  // Articles
  app.get("/api/articles", async (req, res) => {
    try {
      const { feedId, unread, bookmarked, search } = req.query;

      const articles = await storage.getArticles({
        feedId: feedId as string | undefined,
        unread: unread === "true",
        bookmarked: bookmarked === "true",
        search: search as string | undefined,
      });

      res.json(articles);
    } catch (error) {
      console.error("Error fetching articles:", error);
      res.status(500).json({ error: "Failed to fetch articles" });
    }
  });

  app.get("/api/articles/stats", async (_req, res) => {
    try {
      const stats = await storage.getArticleStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching article stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/articles/:id", async (req, res) => {
    try {
      const article = await storage.getArticle(req.params.id);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      res.json(article);
    } catch (error) {
      console.error("Error fetching article:", error);
      res.status(500).json({ error: "Failed to fetch article" });
    }
  });

  app.patch("/api/articles/:id", async (req, res) => {
    try {
      const { isRead, isBookmarked } = req.body;
      
      const updateData: { isRead?: boolean; isBookmarked?: boolean } = {};
      if (typeof isRead === "boolean") updateData.isRead = isRead;
      if (typeof isBookmarked === "boolean") updateData.isBookmarked = isBookmarked;

      const article = await storage.updateArticle(req.params.id, updateData);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      res.json(article);
    } catch (error) {
      console.error("Error updating article:", error);
      res.status(500).json({ error: "Failed to update article" });
    }
  });

  app.post("/api/articles/mark-all-read", async (req, res) => {
    try {
      const { feedId } = req.body;
      await storage.markAllArticlesRead(feedId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking articles as read:", error);
      res.status(500).json({ error: "Failed to mark articles as read" });
    }
  });

  // Feed health stats
  app.get("/api/feeds/health", async (_req, res) => {
    try {
      const health = await storage.getFeedHealthStats();
      res.json(health);
    } catch (error) {
      console.error("Error fetching feed health:", error);
      res.status(500).json({ error: "Failed to fetch feed health" });
    }
  });

  // OPML Export
  app.get("/api/opml/export", async (_req, res) => {
    try {
      const feeds = await storage.getFeeds();
      const categories = await storage.getCategories();

      let opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>ModernFeed RSS Subscriptions</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>`;

      // Group feeds by category
      const feedsByCategory = new Map<string | null, typeof feeds>();
      for (const feed of feeds) {
        const catId = feed.categoryId;
        if (!feedsByCategory.has(catId)) {
          feedsByCategory.set(catId, []);
        }
        feedsByCategory.get(catId)!.push(feed);
      }

      // Add categorized feeds
      for (const category of categories) {
        const categoryFeeds = feedsByCategory.get(category.id) || [];
        if (categoryFeeds.length > 0) {
          opml += `\n    <outline text="${escapeXml(category.name)}" title="${escapeXml(category.name)}">`;
          for (const feed of categoryFeeds) {
            opml += `\n      <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}"${feed.siteUrl ? ` htmlUrl="${escapeXml(feed.siteUrl)}"` : ""} />`;
          }
          opml += `\n    </outline>`;
        }
      }

      // Add uncategorized feeds
      const uncategorizedFeeds = feedsByCategory.get(null) || [];
      for (const feed of uncategorizedFeeds) {
        opml += `\n    <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}"${feed.siteUrl ? ` htmlUrl="${escapeXml(feed.siteUrl)}"` : ""} />`;
      }

      opml += `\n  </body>
</opml>`;

      res.setHeader("Content-Type", "application/xml");
      res.setHeader("Content-Disposition", "attachment; filename=modernfeed-subscriptions.opml");
      res.send(opml);
    } catch (error) {
      console.error("Error exporting OPML:", error);
      res.status(500).json({ error: "Failed to export OPML" });
    }
  });

  // OPML Import
  app.post("/api/opml/import", async (req, res) => {
    try {
      const { opml } = req.body;
      if (!opml || typeof opml !== "string") {
        return res.status(400).json({ error: "OPML content is required" });
      }

      // Simple XML parsing for OPML
      const feedUrls: { url: string; title?: string; category?: string }[] = [];
      
      // Match outline elements with xmlUrl (RSS feeds)
      const outlineRegex = /<outline[^>]*>/gi;
      const matches = opml.match(outlineRegex) || [];
      
      let currentCategory: string | null = null;
      
      for (const match of matches) {
        const xmlUrlMatch = match.match(/xmlUrl=["']([^"']+)["']/i);
        const textMatch = match.match(/text=["']([^"']+)["']/i);
        const titleMatch = match.match(/title=["']([^"']+)["']/i);
        const typeMatch = match.match(/type=["']([^"']+)["']/i);
        
        if (xmlUrlMatch) {
          // This is a feed
          feedUrls.push({
            url: xmlUrlMatch[1],
            title: titleMatch?.[1] || textMatch?.[1],
            category: currentCategory || undefined,
          });
        } else if (!typeMatch && textMatch) {
          // This might be a category folder
          currentCategory = textMatch[1];
        }
      }

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const feedInfo of feedUrls) {
        try {
          // Check if feed already exists
          const existing = await storage.getFeedByUrl(feedInfo.url);
          if (existing) {
            skipped++;
            continue;
          }

          // Try to parse the feed
          const result = await parseFeed(feedInfo.url);
          if (!result.success || !result.feed) {
            errors.push(`Failed to parse: ${feedInfo.url}`);
            continue;
          }

          const { feed: parsedFeed } = result;
          const siteUrl = parsedFeed.link || feedInfo.url;
          const favicon = await getFaviconUrl(siteUrl);

          // Create category if needed
          let categoryId: string | null = null;
          if (feedInfo.category) {
            const categories = await storage.getCategories();
            const existingCategory = categories.find(c => c.name.toLowerCase() === feedInfo.category!.toLowerCase());
            if (existingCategory) {
              categoryId = existingCategory.id;
            } else {
              const newCategory = await storage.createCategory({ name: feedInfo.category });
              categoryId = newCategory.id;
            }
          }

          // Create the feed
          const feed = await storage.createFeed({
            title: feedInfo.title || parsedFeed.title || "Untitled Feed",
            url: feedInfo.url,
            siteUrl: parsedFeed.link || null,
            description: parsedFeed.description || null,
            favicon,
            categoryId,
            isActive: true,
          });

          // Add articles
          const items = parsedFeed.items || [];
          for (const item of items.slice(0, 20)) {
            const guid = item.guid || item.link || item.title || "";
            
            const existingArticle = await storage.getArticleByGuid(feed.id, guid);
            if (existingArticle) continue;

            await storage.createArticle({
              feedId: feed.id,
              title: item.title || "Untitled",
              url: item.link || "",
              content: item["content:encoded"] || item.content || null,
              summary: extractSummary(item.contentSnippet || item.content),
              author: item.creator || item.author || null,
              imageUrl: item.enclosure?.url || null,
              publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
              isRead: false,
              isBookmarked: false,
              guid,
            });
          }

          await storage.updateFeed(feed.id, { lastFetched: new Date() });
          imported++;
        } catch (err) {
          errors.push(`Error importing ${feedInfo.url}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }

      res.json({
        success: true,
        imported,
        skipped,
        total: feedUrls.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Error importing OPML:", error);
      res.status(500).json({ error: "Failed to import OPML" });
    }
  });

  // Article content extraction endpoint (Reader Mode)
  app.get("/api/extract", async (req, res) => {
    try {
      const { url } = req.query;
      
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }

      // Fetch the article page
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ModernFeed/1.0)",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return res.status(400).json({ error: "Failed to fetch article" });
      }

      const html = await response.text();
      
      // Parse with Readability
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article) {
        return res.json({ content: null, title: null });
      }

      res.json({
        content: article.content,
        title: article.title,
        excerpt: article.excerpt,
        byline: article.byline,
        siteName: article.siteName,
      });
    } catch (error) {
      console.error("Error extracting article:", error);
      res.status(500).json({ error: "Failed to extract article content" });
    }
  });

  return httpServer;
}

// Helper function to escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

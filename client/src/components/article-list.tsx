import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Circle,
  CircleDot,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Rss,
} from "lucide-react";
import type { ArticleWithFeed } from "@shared/schema";

interface ArticleListProps {
  selectedFeedId: string | null;
  selectedFilter: "all" | "unread" | "bookmarked";
  searchQuery: string;
  selectedArticleId: string | null;
  onArticleSelect: (articleId: string) => void;
  viewMode: "card" | "list";
}

export function ArticleList({
  selectedFeedId,
  selectedFilter,
  searchQuery,
  selectedArticleId,
  onArticleSelect,
  viewMode,
}: ArticleListProps) {
  const queryParams = new URLSearchParams();
  if (selectedFeedId) queryParams.set("feedId", selectedFeedId);
  if (selectedFilter === "unread") queryParams.set("unread", "true");
  if (selectedFilter === "bookmarked") queryParams.set("bookmarked", "true");
  if (searchQuery) queryParams.set("search", searchQuery);

  const { data: articles = [], isLoading } = useQuery<ArticleWithFeed[]>({
    queryKey: ["/api/articles", selectedFeedId, selectedFilter, searchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/articles?${queryParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch articles");
      return response.json();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async ({ id, isRead }: { id: string; isRead: boolean }) => {
      await apiRequest("PATCH", `/api/articles/${id}`, { isRead });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/stats"] });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async ({ id, isBookmarked }: { id: string; isBookmarked: boolean }) => {
      await apiRequest("PATCH", `/api/articles/${id}`, { isBookmarked });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/stats"] });
    },
  });

  const handleArticleClick = (article: ArticleWithFeed) => {
    onArticleSelect(article.id);
    if (!article.isRead) {
      markReadMutation.mutate({ id: article.id, isRead: true });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-4">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <ArticleCardSkeleton key={i} viewMode={viewMode} />
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Rss className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No articles found</h3>
          <p className="text-muted-foreground text-sm">
            {selectedFilter === "unread"
              ? "You've read all your articles! Check back later for new content."
              : selectedFilter === "bookmarked"
              ? "You haven't bookmarked any articles yet."
              : searchQuery
              ? "No articles match your search. Try different keywords."
              : "Add some RSS feeds to start reading articles."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className={`p-4 ${viewMode === "card" ? "space-y-4" : "space-y-2"}`}>
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            isSelected={selectedArticleId === article.id}
            viewMode={viewMode}
            onClick={() => handleArticleClick(article)}
            onToggleRead={() =>
              markReadMutation.mutate({ id: article.id, isRead: !article.isRead })
            }
            onToggleBookmark={() =>
              bookmarkMutation.mutate({ id: article.id, isBookmarked: !article.isBookmarked })
            }
          />
        ))}
      </div>
    </ScrollArea>
  );
}

interface ArticleCardProps {
  article: ArticleWithFeed;
  isSelected: boolean;
  viewMode: "card" | "list";
  onClick: () => void;
  onToggleRead: () => void;
  onToggleBookmark: () => void;
}

function ArticleCard({
  article,
  isSelected,
  viewMode,
  onClick,
  onToggleRead,
  onToggleBookmark,
}: ArticleCardProps) {
  const publishedDate = article.publishedAt
    ? formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
    : "Unknown date";

  if (viewMode === "list") {
    return (
      <div
        onClick={onClick}
        className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover-elevate ${
          isSelected ? "bg-accent" : ""
        } ${!article.isRead ? "bg-card" : ""}`}
        data-testid={`article-${article.id}`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleRead();
          }}
          className="flex-shrink-0"
          data-testid={`button-toggle-read-${article.id}`}
        >
          {article.isRead ? (
            <Circle className="h-3 w-3 text-muted-foreground" />
          ) : (
            <CircleDot className="h-3 w-3 text-primary" />
          )}
        </button>

        {article.imageUrl && (
          <img
            src={article.imageUrl}
            alt=""
            className="h-12 w-12 rounded object-cover flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}

        <div className="flex-1 min-w-0">
          <h4
            className={`text-sm font-medium truncate ${
              article.isRead ? "text-muted-foreground" : ""
            }`}
          >
            {article.title}
          </h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground truncate">
              {article.feed.title}
            </span>
            <span className="text-xs text-muted-foreground">{publishedDate}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark();
            }}
            data-testid={`button-bookmark-${article.id}`}
          >
            {article.isBookmarked ? (
              <BookmarkCheck className="h-4 w-4 text-primary" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              window.open(article.url, "_blank");
            }}
            data-testid={`button-open-${article.id}`}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card
      onClick={onClick}
      className={`group cursor-pointer transition-all overflow-hidden hover-elevate ${
        isSelected ? "ring-2 ring-primary" : ""
      } ${!article.isRead ? "border-l-2 border-l-primary" : ""}`}
      data-testid={`article-${article.id}`}
    >
      {article.imageUrl && (
        <div className="aspect-video relative overflow-hidden">
          <img
            src={article.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).parentElement!.style.display = "none";
            }}
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleRead();
            }}
            className="flex-shrink-0 mt-1"
            data-testid={`button-toggle-read-${article.id}`}
          >
            {article.isRead ? (
              <Circle className="h-3 w-3 text-muted-foreground" />
            ) : (
              <CircleDot className="h-3 w-3 text-primary" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <h3
              className={`text-lg font-semibold line-clamp-2 leading-snug ${
                article.isRead ? "text-muted-foreground" : ""
              }`}
            >
              {article.title}
            </h3>
            {article.summary && (
              <p className="text-sm text-muted-foreground line-clamp-3 mt-2">
                {article.summary}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 min-w-0">
            {article.feed.favicon ? (
              <img
                src={article.feed.favicon}
                alt=""
                className="h-4 w-4 rounded flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Rss className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <span className="text-xs text-muted-foreground truncate">
              {article.feed.title}
            </span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {publishedDate}
            </span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark();
              }}
              data-testid={`button-bookmark-${article.id}`}
            >
              {article.isBookmarked ? (
                <BookmarkCheck className="h-4 w-4 text-primary" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                window.open(article.url, "_blank");
              }}
              data-testid={`button-open-${article.id}`}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ArticleCardSkeleton({ viewMode }: { viewMode: "card" | "list" }) {
  if (viewMode === "list") {
    return (
      <div className="flex items-center gap-3 p-3">
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-12 w-12 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-video" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex items-center gap-2 mt-4">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </Card>
  );
}

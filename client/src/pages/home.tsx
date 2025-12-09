import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Feed } from "@shared/schema";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { ArticleList } from "@/components/article-list";
import { ArticleReader, ArticleReaderEmpty } from "@/components/article-reader";
import { AddFeedModal } from "@/components/add-feed-modal";
import { SearchBar } from "@/components/search-bar";
import { ViewToggle } from "@/components/view-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { RefreshCw, Check, AlertTriangle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface FeedHealthStats {
  totalFeeds: number;
  failingFeeds: number;
  feedsWithErrors: Feed[];
}

export default function Home() {
  const { toast } = useToast();
  const [showAddFeedModal, setShowAddFeedModal] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<"all" | "unread" | "bookmarked">("all");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [dismissedHealthWarning, setDismissedHealthWarning] = useState(false);

  const { data: feedHealth } = useQuery<FeedHealthStats>({
    queryKey: ["/api/feeds/health"],
    refetchInterval: 60000,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/feeds/refresh");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/stats"] });
      toast({
        title: "Feeds refreshed",
        description: "All your feeds have been updated with the latest articles.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Refresh failed",
        description: error.message || "Could not refresh feeds. Please try again.",
        variant: "destructive",
      });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/articles/mark-all-read", {
        feedId: selectedFeedId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/stats"] });
      toast({
        title: "Marked all as read",
        description: "All articles have been marked as read.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Action failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFeedSelect = useCallback((feedId: string | null) => {
    setSelectedFeedId(feedId);
    setSelectedArticleId(null);
  }, []);

  const handleFilterChange = useCallback((filter: "all" | "unread" | "bookmarked") => {
    setSelectedFilter(filter);
    setSelectedArticleId(null);
  }, []);

  const handleArticleSelect = useCallback((articleId: string) => {
    setSelectedArticleId(articleId);
  }, []);

  const handleCloseReader = useCallback(() => {
    setSelectedArticleId(null);
  }, []);

  // Mutation for keyboard shortcuts - updates cache optimistically
  const keyboardMutation = useMutation({
    mutationFn: async ({ articleId, updates }: { articleId: string; updates: { isRead?: boolean; isBookmarked?: boolean } }) => {
      await apiRequest("PATCH", `/api/articles/${articleId}`, updates);
      return { articleId, updates };
    },
    onMutate: async ({ articleId, updates }) => {
      // Optimistically update the article in cache
      const queryKey = ["/api/articles", selectedFeedId, selectedFilter, searchQuery];
      const previousArticles = queryClient.getQueryData<Array<{ id: string; isRead: boolean; isBookmarked: boolean }>>(queryKey);
      
      if (previousArticles) {
        queryClient.setQueryData(queryKey, previousArticles.map(article =>
          article.id === articleId ? { ...article, ...updates } : article
        ));
      }
      
      return { previousArticles, queryKey };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousArticles) {
        queryClient.setQueryData(context.queryKey, context.previousArticles);
      }
    },
    onSettled: () => {
      // Refetch stats and feeds for count updates (debounced by react-query)
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/stats"] });
    },
  });

  // Keyboard navigation - uses same query key as ArticleList for proper filtering
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Escape - close reader
      if (e.key === "Escape" && selectedArticleId) {
        setSelectedArticleId(null);
        return;
      }

      // Get cached articles matching current view (same key as ArticleList)
      const articlesQueryKey = ["/api/articles", selectedFeedId, selectedFilter, searchQuery];
      const articles = queryClient.getQueryData<Array<{ id: string; isRead: boolean; isBookmarked: boolean; url: string }>>(articlesQueryKey) || [];
      
      if (!articles.length) return;

      const currentIndex = selectedArticleId 
        ? articles.findIndex((a) => a.id === selectedArticleId)
        : -1;

      // j - next article
      if (e.key === "j") {
        e.preventDefault();
        const nextIndex = currentIndex < articles.length - 1 ? currentIndex + 1 : 0;
        const nextArticle = articles[nextIndex];
        setSelectedArticleId(nextArticle.id);
        if (!nextArticle.isRead) {
          keyboardMutation.mutate({ articleId: nextArticle.id, updates: { isRead: true } });
        }
        return;
      }

      // k - previous article
      if (e.key === "k") {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : articles.length - 1;
        const prevArticle = articles[prevIndex];
        setSelectedArticleId(prevArticle.id);
        if (!prevArticle.isRead) {
          keyboardMutation.mutate({ articleId: prevArticle.id, updates: { isRead: true } });
        }
        return;
      }

      // Only handle following shortcuts if an article is selected
      if (!selectedArticleId || currentIndex === -1) return;

      const currentArticle = articles[currentIndex];

      // m - toggle read/unread
      if (e.key === "m") {
        e.preventDefault();
        keyboardMutation.mutate({ 
          articleId: selectedArticleId, 
          updates: { isRead: !currentArticle.isRead } 
        });
        toast({
          title: currentArticle.isRead ? "Marked as unread" : "Marked as read",
        });
        return;
      }

      // b - toggle bookmark
      if (e.key === "b") {
        e.preventDefault();
        keyboardMutation.mutate({ 
          articleId: selectedArticleId, 
          updates: { isBookmarked: !currentArticle.isBookmarked } 
        });
        toast({
          title: currentArticle.isBookmarked ? "Removed from bookmarks" : "Added to bookmarks",
        });
        return;
      }

      // o - open original article
      if (e.key === "o") {
        e.preventDefault();
        window.open(currentArticle.url, "_blank");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedArticleId, selectedFeedId, selectedFilter, searchQuery, toast, keyboardMutation]);

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar
          onAddFeed={() => setShowAddFeedModal(true)}
          selectedFeedId={selectedFeedId}
          selectedFilter={selectedFilter}
          onFilterChange={handleFilterChange}
          onFeedSelect={handleFeedSelect}
        />

        <SidebarInset className="flex-1 flex flex-col overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Separator orientation="vertical" className="h-6" />
              <h2 className="text-sm font-medium text-muted-foreground">
                {selectedFeedId 
                  ? "Feed Articles" 
                  : selectedFilter === "all" 
                  ? "All Articles" 
                  : selectedFilter === "unread"
                  ? "Unread Articles"
                  : "Bookmarked Articles"}
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-1 justify-center">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>

            <div className="flex items-center gap-2">
              <ViewToggle
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                data-testid="button-mark-all-read"
              >
                <Check className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                data-testid="button-refresh-feeds"
              >
                <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              </Button>
              <ThemeToggle />
            </div>
          </header>

          {feedHealth && feedHealth.failingFeeds > 0 && !dismissedHealthWarning && (
            <Alert variant="destructive" className="mx-3 mt-3 flex items-center justify-between" data-testid="alert-feed-health">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {feedHealth.failingFeeds} feed{feedHealth.failingFeeds > 1 ? "s are" : " is"} having trouble updating. 
                  Check the sidebar for feeds with warning icons.
                </AlertDescription>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setDismissedHealthWarning(true)}
                data-testid="button-dismiss-health-warning"
              >
                <X className="h-4 w-4" />
              </Button>
            </Alert>
          )}

          <div className="flex-1 flex overflow-hidden">
            <div className={`flex-1 flex flex-col overflow-hidden ${selectedArticleId ? "hidden lg:flex lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl border-r" : ""}`}>
              <ArticleList
                selectedFeedId={selectedFeedId}
                selectedFilter={selectedFilter}
                searchQuery={searchQuery}
                selectedArticleId={selectedArticleId}
                onArticleSelect={handleArticleSelect}
                viewMode={viewMode}
              />
            </div>

            {selectedArticleId ? (
              <ArticleReader
                articleId={selectedArticleId}
                onClose={handleCloseReader}
              />
            ) : (
              <div className="hidden lg:flex flex-1">
                <ArticleReaderEmpty />
              </div>
            )}
          </div>
        </SidebarInset>
      </div>

      <AddFeedModal
        open={showAddFeedModal}
        onOpenChange={setShowAddFeedModal}
      />
    </SidebarProvider>
  );
}

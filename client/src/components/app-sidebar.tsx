import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Rss,
  Plus,
  Inbox,
  BookOpen,
  Bookmark,
  ChevronRight,
  Settings,
  Folder,
  AlertTriangle,
  Download,
  Upload,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Category, FeedWithCategory } from "@shared/schema";

interface AppSidebarProps {
  onAddFeed: () => void;
  selectedFeedId: string | null;
  selectedFilter: "all" | "unread" | "bookmarked";
  onFilterChange: (filter: "all" | "unread" | "bookmarked") => void;
  onFeedSelect: (feedId: string | null) => void;
}

export function AppSidebar({ 
  onAddFeed, 
  selectedFeedId, 
  selectedFilter,
  onFilterChange,
  onFeedSelect 
}: AppSidebarProps) {
  const [location] = useLocation();
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: feeds = [], isLoading: feedsLoading } = useQuery<FeedWithCategory[]>({
    queryKey: ["/api/feeds"],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: stats } = useQuery<{ unread: number; bookmarked: number }>({
    queryKey: ["/api/articles/stats"],
  });

  const importMutation = useMutation({
    mutationFn: async (opmlContent: string) => {
      const res = await apiRequest("POST", "/api/opml/import", { opml: opmlContent });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      toast({
        title: "Import complete",
        description: `Imported ${data.imported} feeds${data.skipped > 0 ? `, ${data.skipped} already existed` : ""}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import OPML",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        importMutation.mutate(content);
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExport = () => {
    window.location.href = "/api/opml/export";
  };

  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const getFeedsByCategory = (categoryId: string | null) => {
    return feeds.filter(feed => feed.categoryId === categoryId);
  };

  const uncategorizedFeeds = getFeedsByCategory(null);

  const isLoading = feedsLoading || categoriesLoading;

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Rss className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">ModernFeed</span>
        </div>
        <Button 
          onClick={onAddFeed} 
          className="mt-4 w-full gap-2"
          data-testid="button-add-feed"
        >
          <Plus className="h-4 w-4" />
          Add Feed
        </Button>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => {
                    onFeedSelect(null);
                    onFilterChange("all");
                  }}
                  isActive={selectedFilter === "all" && !selectedFeedId}
                  data-testid="nav-all-items"
                >
                  <Inbox className="h-4 w-4" />
                  <span>All Items</span>
                  {stats?.unread && stats.unread > 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {stats.unread}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    onFeedSelect(null);
                    onFilterChange("unread");
                  }}
                  isActive={selectedFilter === "unread" && !selectedFeedId}
                  data-testid="nav-unread"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Unread</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    onFeedSelect(null);
                    onFilterChange("bookmarked");
                  }}
                  isActive={selectedFilter === "bookmarked" && !selectedFeedId}
                  data-testid="nav-bookmarked"
                >
                  <Bookmark className="h-4 w-4" />
                  <span>Bookmarked</span>
                  {stats?.bookmarked && stats.bookmarked > 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {stats.bookmarked}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Feeds
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {isLoading ? (
              <div className="space-y-2 px-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <SidebarMenu>
                {categories.map(category => {
                  const categoryFeeds = getFeedsByCategory(category.id);
                  const unreadCount = categoryFeeds.reduce((acc, feed) => acc + (feed.unreadCount || 0), 0);
                  const isOpen = openCategories[category.id] ?? true;

                  return (
                    <Collapsible
                      key={category.id}
                      open={isOpen}
                      onOpenChange={() => toggleCategory(category.id)}
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            className="w-full"
                            data-testid={`category-${category.id}`}
                          >
                            <ChevronRight 
                              className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} 
                            />
                            <Folder 
                              className="h-4 w-4" 
                              style={{ color: category.color || undefined }}
                            />
                            <span className="flex-1 truncate">{category.name}</span>
                            {unreadCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {unreadCount}
                              </Badge>
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenu className="pl-6 mt-1">
                            {categoryFeeds.map(feed => (
                              <SidebarMenuItem key={feed.id}>
                                <SidebarMenuButton
                                  onClick={() => onFeedSelect(feed.id)}
                                  isActive={selectedFeedId === feed.id}
                                  data-testid={`feed-${feed.id}`}
                                >
                                  <div className="relative">
                                    {feed.favicon ? (
                                      <img 
                                        src={feed.favicon} 
                                        alt="" 
                                        className="h-4 w-4 rounded"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <Rss className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    {feed.errorCount && feed.errorCount > 0 && (
                                      <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                                    )}
                                  </div>
                                  <span className="flex-1 truncate">{feed.title}</span>
                                  {feed.errorCount && feed.errorCount >= 3 ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center">
                                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Feed has failed to update {feed.errorCount} times</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : feed.unreadCount && feed.unreadCount > 0 ? (
                                    <Badge variant="secondary" className="text-xs">
                                      {feed.unreadCount}
                                    </Badge>
                                  ) : null}
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                })}

                {uncategorizedFeeds.length > 0 && (
                  <>
                    {uncategorizedFeeds.map(feed => (
                      <SidebarMenuItem key={feed.id}>
                        <SidebarMenuButton
                          onClick={() => onFeedSelect(feed.id)}
                          isActive={selectedFeedId === feed.id}
                          data-testid={`feed-${feed.id}`}
                        >
                          <div className="relative">
                            {feed.favicon ? (
                              <img 
                                src={feed.favicon} 
                                alt="" 
                                className="h-4 w-4 rounded"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Rss className="h-4 w-4 text-muted-foreground" />
                            )}
                            {feed.errorCount && feed.errorCount > 0 && (
                              <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                            )}
                          </div>
                          <span className="flex-1 truncate">{feed.title}</span>
                          {feed.errorCount && feed.errorCount >= 3 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center">
                                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Feed has failed to update {feed.errorCount} times</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : feed.unreadCount && feed.unreadCount > 0 ? (
                            <Badge variant="secondary" className="text-xs">
                              {feed.unreadCount}
                            </Badge>
                          ) : null}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </>
                )}

                {feeds.length === 0 && !isLoading && (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No feeds yet. Add your first feed!
                  </div>
                )}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".opml,.xml"
          className="hidden"
          data-testid="input-opml-file"
        />
        <div className="flex gap-2 mb-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={importMutation.isPending}
                data-testid="button-import-opml"
              >
                <Upload className="h-4 w-4" />
                Import
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Import feeds from OPML file</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={handleExport}
                data-testid="button-export-opml"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Export feeds as OPML file</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton data-testid="nav-settings">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

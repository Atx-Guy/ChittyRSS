import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  X,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Circle,
  CircleDot,
  Share2,
  Rss,
  Link2,
  Check,
  FileText,
  Loader2,
} from "lucide-react";
import { SiX, SiLinkedin, SiFacebook } from "react-icons/si";
import { Mail } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { ArticleWithFeed } from "@shared/schema";

interface ArticleReaderProps {
  articleId: string;
  onClose: () => void;
}

export function ArticleReader({ articleId, onClose }: ArticleReaderProps) {
  const { toast } = useToast();
  const [extractedContent, setExtractedContent] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  
  const { data: article, isLoading } = useQuery<ArticleWithFeed>({
    queryKey: ["/api/articles", articleId],
    queryFn: async () => {
      const response = await fetch(`/api/articles/${articleId}`);
      if (!response.ok) throw new Error("Failed to fetch article");
      return response.json();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async ({ isRead }: { isRead: boolean }) => {
      await apiRequest("PATCH", `/api/articles/${articleId}`, { isRead });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/stats"] });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async ({ isBookmarked }: { isBookmarked: boolean }) => {
      await apiRequest("PATCH", `/api/articles/${articleId}`, { isBookmarked });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/stats"] });
    },
  });

  const handleCopyLink = async () => {
    if (article) {
      await navigator.clipboard.writeText(article.url);
      toast({
        title: "Link copied",
        description: "Article link has been copied to clipboard.",
      });
    }
  };

  const handleShareTwitter = () => {
    if (article) {
      const text = encodeURIComponent(article.title);
      const url = encodeURIComponent(article.url);
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
    }
  };

  const handleShareLinkedIn = () => {
    if (article) {
      const url = encodeURIComponent(article.url);
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, "_blank");
    }
  };

  const handleShareFacebook = () => {
    if (article) {
      const url = encodeURIComponent(article.url);
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank");
    }
  };

  const handleShareEmail = () => {
    if (article) {
      const subject = encodeURIComponent(article.title);
      const body = encodeURIComponent(`Check out this article: ${article.url}`);
      window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
    }
  };

  const handleExtractContent = async () => {
    if (!article) return;
    setIsExtracting(true);
    try {
      const response = await fetch(`/api/extract?url=${encodeURIComponent(article.url)}`);
      if (!response.ok) throw new Error("Failed to extract content");
      const data = await response.json();
      if (data.content) {
        setExtractedContent(data.content);
        toast({
          title: "Full article loaded",
          description: "The complete article content has been extracted.",
        });
      } else {
        toast({
          title: "Could not extract content",
          description: "The original article may be behind a paywall or restricted.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Extraction failed",
        description: "Could not load the full article content.",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  // Sanitize HTML content to prevent XSS attacks
  const sanitizeHtml = (html: string) => {
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target'],
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-prose mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="aspect-video w-full" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Article not found</h3>
          <p className="text-muted-foreground text-sm">
            The article you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={onClose} className="mt-4">
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const publishedDate = article.publishedAt
    ? format(new Date(article.publishedAt), "MMMM d, yyyy 'at' h:mm a")
    : null;

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          {article.feed.favicon ? (
            <img
              src={article.feed.favicon}
              alt=""
              className="h-5 w-5 rounded flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Rss className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{article.feed.title}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => markReadMutation.mutate({ isRead: !article.isRead })}
            data-testid="button-toggle-read-reader"
          >
            {article.isRead ? (
              <Circle className="h-4 w-4" />
            ) : (
              <CircleDot className="h-4 w-4 text-primary" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => bookmarkMutation.mutate({ isBookmarked: !article.isBookmarked })}
            data-testid="button-bookmark-reader"
          >
            {article.isBookmarked ? (
              <BookmarkCheck className="h-4 w-4 text-primary" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-testid="button-share-reader"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopyLink} data-testid="share-copy-link">
                <Link2 className="h-4 w-4 mr-2" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleShareTwitter} data-testid="share-twitter">
                <SiX className="h-4 w-4 mr-2" />
                Share on X
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShareLinkedIn} data-testid="share-linkedin">
                <SiLinkedin className="h-4 w-4 mr-2" />
                Share on LinkedIn
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShareFacebook} data-testid="share-facebook">
                <SiFacebook className="h-4 w-4 mr-2" />
                Share on Facebook
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleShareEmail} data-testid="share-email">
                <Mail className="h-4 w-4 mr-2" />
                Share via Email
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open(article.url, "_blank")}
            data-testid="button-open-original"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-reader"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <article className="max-w-prose mx-auto px-6 py-8">
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
              {article.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {article.author && (
                <span>By {article.author}</span>
              )}
              {publishedDate && (
                <span>{publishedDate}</span>
              )}
            </div>
          </header>

          {article.imageUrl && (
            <div className="mb-8 rounded-lg overflow-hidden">
              <img
                src={article.imageUrl}
                alt=""
                className="w-full h-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.display = "none";
                }}
              />
            </div>
          )}

          <div className="prose prose-lg dark:prose-invert max-w-none
            prose-img:rounded-xl prose-img:shadow-lg prose-img:mx-auto
            prose-headings:font-bold prose-headings:tracking-tight
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
            {extractedContent ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(extractedContent) }} />
            ) : article.content ? (
              <>
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }} />
                <div className="mt-6 pt-4 border-t not-prose">
                  <Button
                    variant="outline"
                    onClick={handleExtractContent}
                    disabled={isExtracting}
                    data-testid="button-extract-content"
                  >
                    {isExtracting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    {isExtracting ? "Loading..." : "Load Full Article"}
                  </Button>
                </div>
              </>
            ) : article.summary ? (
              <>
                <p className="text-lg leading-relaxed">{article.summary}</p>
                <div className="mt-6 pt-4 border-t not-prose">
                  <Button
                    variant="outline"
                    onClick={handleExtractContent}
                    disabled={isExtracting}
                    data-testid="button-extract-content"
                  >
                    {isExtracting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    {isExtracting ? "Loading..." : "Load Full Article"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Full content not available.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    onClick={handleExtractContent}
                    disabled={isExtracting}
                    data-testid="button-extract-content"
                  >
                    {isExtracting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    {isExtracting ? "Loading..." : "Load Full Article"}
                  </Button>
                  <Button
                    onClick={() => window.open(article.url, "_blank")}
                    data-testid="button-read-original"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Read Original
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Separator className="my-8" />

          <footer className="flex flex-wrap items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => markReadMutation.mutate({ isRead: !article.isRead })}
            >
              {article.isRead ? (
                <>
                  <CircleDot className="h-4 w-4 mr-2" />
                  Mark as Unread
                </>
              ) : (
                <>
                  <Circle className="h-4 w-4 mr-2" />
                  Mark as Read
                </>
              )}
            </Button>
            <Button
              onClick={() => window.open(article.url, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Original
            </Button>
          </footer>
        </article>
      </ScrollArea>
    </div>
  );
}

export function ArticleReaderEmpty() {
  return (
    <div className="flex-1 flex items-center justify-center bg-muted/30">
      <div className="text-center max-w-md px-4">
        <div className="mx-auto h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
          <Rss className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Select an article</h3>
        <p className="text-muted-foreground">
          Choose an article from the list to start reading. You can also use keyboard
          shortcuts to navigate between articles.
        </p>
      </div>
    </div>
  );
}

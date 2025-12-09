import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Rss, Plus, Check, Search, Globe } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { Category } from "@shared/schema";

// Flexible URL validation - accepts bare domains like "example.com"
const addFeedSchema = z.object({
  url: z.string().min(1, "Please enter a website or feed URL"),
  categoryId: z.string().optional(),
});

type AddFeedForm = z.infer<typeof addFeedSchema>;

interface DiscoveredFeed {
  url: string;
  title: string;
  type: string;
}

interface AddFeedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFeedModal({ open, onOpenChange }: AddFeedModalProps) {
  const { toast } = useToast();
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [discoveredFeeds, setDiscoveredFeeds] = useState<DiscoveredFeed[]>([]);
  const [selectedFeedUrl, setSelectedFeedUrl] = useState<string>("");
  const [showDiscovery, setShowDiscovery] = useState(false);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const form = useForm<AddFeedForm>({
    resolver: zodResolver(addFeedSchema),
    defaultValues: {
      url: "",
      categoryId: "",
    },
  });

  // Reset discovery state when modal closes
  useEffect(() => {
    if (!open) {
      setDiscoveredFeeds([]);
      setSelectedFeedUrl("");
      setShowDiscovery(false);
    }
  }, [open]);

  const discoverMutation = useMutation({
    mutationFn: async (url: string): Promise<{ feeds: DiscoveredFeed[]; directFeed?: boolean }> => {
      const response = await apiRequest("POST", "/api/feeds/discover", { url });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.directFeed) {
        // URL was already a valid RSS feed, add it directly
        const url = form.getValues("url");
        addFeedMutation.mutate({ url, categoryId: form.getValues("categoryId") });
      } else if (data.feeds && data.feeds.length > 0) {
        setDiscoveredFeeds(data.feeds);
        setSelectedFeedUrl(data.feeds[0].url);
        setShowDiscovery(true);
      } else {
        toast({
          title: "No feeds found",
          description: "Could not find any RSS feeds on this website. Try entering the feed URL directly.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to discover feeds",
        description: error.message || "Please check the URL and try again.",
        variant: "destructive",
      });
    },
  });

  const addFeedMutation = useMutation({
    mutationFn: async (data: AddFeedForm) => {
      const response = await apiRequest("POST", "/api/feeds", {
        url: data.url,
        categoryId: data.categoryId || null,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/stats"] });
      toast({
        title: "Feed added successfully",
        description: "Your feed has been added and articles are being fetched.",
      });
      form.reset();
      setDiscoveredFeeds([]);
      setSelectedFeedUrl("");
      setShowDiscovery(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add feed",
        description: error.message || "Please check the URL and try again.",
        variant: "destructive",
      });
    },
  });

  const addCategoryMutation = useMutation({
    mutationFn: async (name: string): Promise<Category> => {
      const response = await apiRequest("POST", "/api/categories", { name });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      form.setValue("categoryId", data.id);
      setNewCategoryName("");
      setShowNewCategory(false);
      toast({
        title: "Category created",
        description: `"${data.name}" has been created.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create category",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddFeedForm) => {
    // If we have discovered feeds and a selection, use that
    if (showDiscovery && selectedFeedUrl) {
      addFeedMutation.mutate({ ...data, url: selectedFeedUrl });
    } else {
      // Try to discover feeds from the URL
      discoverMutation.mutate(data.url);
    }
  };

  const handleAddSelectedFeed = () => {
    if (selectedFeedUrl) {
      addFeedMutation.mutate({ 
        url: selectedFeedUrl, 
        categoryId: form.getValues("categoryId") 
      });
    }
  };

  const handleCreateCategory = () => {
    if (newCategoryName.trim()) {
      addCategoryMutation.mutate(newCategoryName.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rss className="h-5 w-5" />
            Add RSS Feed
          </DialogTitle>
          <DialogDescription>
            Enter a website URL or RSS feed URL. We'll automatically find available feeds.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website or Feed URL</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        placeholder="example.com or https://example.com/feed.xml"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          // Reset discovery when URL changes
                          if (showDiscovery) {
                            setShowDiscovery(false);
                            setDiscoveredFeeds([]);
                            setSelectedFeedUrl("");
                          }
                        }}
                        data-testid="input-feed-url"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Discovered feeds list */}
            {showDiscovery && discoveredFeeds.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Found {discoveredFeeds.length} feed{discoveredFeeds.length > 1 ? "s" : ""}
                </Label>
                <RadioGroup
                  value={selectedFeedUrl}
                  onValueChange={setSelectedFeedUrl}
                  className="space-y-2"
                >
                  {discoveredFeeds.map((feed, index) => (
                    <div
                      key={feed.url}
                      className="flex items-center space-x-3 rounded-md border p-3 hover-elevate"
                    >
                      <RadioGroupItem
                        value={feed.url}
                        id={`feed-${index}`}
                        data-testid={`radio-feed-${index}`}
                      />
                      <Label
                        htmlFor={`feed-${index}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium">{feed.title || "Untitled Feed"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {feed.type} - {feed.url}
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category (optional)</FormLabel>
                  {showNewCategory ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        data-testid="input-new-category"
                      />
                      <Button
                        type="button"
                        size="icon"
                        onClick={handleCreateCategory}
                        disabled={addCategoryMutation.isPending || !newCategoryName.trim()}
                        data-testid="button-confirm-category"
                      >
                        {addCategoryMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setShowNewCategory(false);
                          setNewCategoryName("");
                        }}
                        data-testid="button-cancel-category"
                      >
                        <span className="sr-only">Cancel</span>
                        &times;
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem
                              key={category.id}
                              value={category.id}
                              data-testid={`category-option-${category.id}`}
                            >
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowNewCategory(true)}
                        data-testid="button-new-category"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-add-feed"
              >
                Cancel
              </Button>
              {showDiscovery && discoveredFeeds.length > 0 ? (
                <Button
                  type="button"
                  onClick={handleAddSelectedFeed}
                  disabled={addFeedMutation.isPending || !selectedFeedUrl}
                  data-testid="button-submit-feed"
                >
                  {addFeedMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Rss className="h-4 w-4 mr-2" />
                      Add Selected Feed
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={discoverMutation.isPending || addFeedMutation.isPending}
                  data-testid="button-submit-feed"
                >
                  {discoverMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Finding feeds...
                    </>
                  ) : addFeedMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4 mr-2" />
                      Find Feeds
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

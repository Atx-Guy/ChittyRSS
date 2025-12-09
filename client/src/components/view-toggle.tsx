import { Button } from "@/components/ui/button";
import { LayoutGrid, List } from "lucide-react";

interface ViewToggleProps {
  viewMode: "card" | "list";
  onViewModeChange: (mode: "card" | "list") => void;
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 border rounded-md p-0.5">
      <Button
        variant={viewMode === "card" ? "secondary" : "ghost"}
        size="icon"
        className="h-7 w-7"
        onClick={() => onViewModeChange("card")}
        data-testid="button-view-card"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant={viewMode === "list" ? "secondary" : "ghost"}
        size="icon"
        className="h-7 w-7"
        onClick={() => onViewModeChange("list")}
        data-testid="button-view-list"
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}

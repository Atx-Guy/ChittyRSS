import { useIsFetching } from "@tanstack/react-query";

export function GlobalLoadingIndicator() {
  const isFetching = useIsFetching();

  if (!isFetching) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 overflow-hidden bg-primary/20">
      <div 
        className="h-full bg-primary animate-loading-bar"
        style={{
          width: "30%",
        }}
      />
    </div>
  );
}

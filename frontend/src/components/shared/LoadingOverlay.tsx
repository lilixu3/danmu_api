import { Loader2 } from "lucide-react";

export function LoadingOverlay({
  open,
  title,
  detail,
}: {
  open: boolean;
  title?: string;
  detail?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col items-center rounded-2xl bg-card p-8 text-card-foreground shadow-xl">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        {title && <div className="mt-4 font-semibold">{title}</div>}
        {detail && <div className="mt-1 text-sm text-muted-foreground">{detail}</div>}
      </div>
    </div>
  );
}

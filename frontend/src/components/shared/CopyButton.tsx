import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CopyButton({
  text,
  children,
}: {
  text: string;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("已复制到剪贴板");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      className="text-white hover:bg-white/20"
    >
      {copied ? <Check className="h-4 w-4" /> : children || <Copy className="h-4 w-4" />}
    </Button>
  );
}

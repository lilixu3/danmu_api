import { escapeHtml } from "@/lib/utils";

export function JsonViewer({ data }: { data: unknown }) {
  const json = JSON.stringify(data, null, 2);
  const highlighted = escapeHtml(json).replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = "text-orange-400";
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = "text-blue-400";
        } else {
          cls = "text-green-400";
        }
      } else if (/true|false/.test(match)) {
        cls = "text-purple-400";
      } else if (/null/.test(match)) {
        cls = "text-red-400";
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
  return (
    <pre
      className="max-h-[500px] overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-sm text-slate-50"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

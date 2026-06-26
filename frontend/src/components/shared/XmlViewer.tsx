export function XmlViewer({ xml }: { xml: string }) {
  const formatted = xml
    .replace(/></g, ">\n<")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  return (
    <pre className="max-h-[500px] overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-sm text-slate-50 whitespace-pre-wrap">
      {formatted}
    </pre>
  );
}

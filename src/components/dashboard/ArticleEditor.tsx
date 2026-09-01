import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote, Link2, Eye, PenLine } from "lucide-react";
import { htmlToMarkdown } from "@/lib/article-markdown";
import { ArticleContent } from "@/components/articles/ArticleContent";

type Props = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

/**
 * Éditeur d'article : mise en page simple (titres, gras, listes) en Markdown
 * léger, avec conversion automatique des copier-coller riches (Word, Docs, web).
 */
export function ArticleEditor({ id = "article-body", value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [preview, setPreview] = useState(false);

  const apply = (kind: "h2" | "h3" | "bold" | "italic" | "ul" | "ol" | "quote" | "link") => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = value.slice(start, end);

    const wrap = (before: string, after = before, fallback = "texte") => {
      const inner = selected || fallback;
      const next = value.slice(0, start) + before + inner + after + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + before.length, start + before.length + inner.length);
      });
    };

    const prefixLines = (prefix: (i: number) => string) => {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = value.indexOf("\n", end) === -1 ? value.length : value.indexOf("\n", end);
      const chunk = value.slice(lineStart, lineEnd) || "Votre texte";
      const updated = chunk
        .split("\n")
        .map((l) => l.replace(/^(#{1,6}\s+|[-*]\s+|\d+[.)]\s+|>\s?)/, "").trim())
        .map((l, i) => prefix(i) + (l || "Votre texte"))
        .join("\n");
      const next = value.slice(0, lineStart) + updated + value.slice(lineEnd);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(lineStart, lineStart + updated.length);
      });
    };

    switch (kind) {
      case "bold": return wrap("**");
      case "italic": return wrap("*");
      case "h2": return prefixLines(() => "## ");
      case "h3": return prefixLines(() => "### ");
      case "ul": return prefixLines(() => "- ");
      case "ol": return prefixLines((i) => `${i + 1}. `);
      case "quote": return prefixLines(() => "> ");
      case "link": {
        const url = window.prompt("Adresse du lien (https://…)");
        if (!url) return;
        const label = selected || "texte du lien";
        const next = value.slice(0, start) + `[${label}](${url})` + value.slice(end);
        onChange(next);
        return;
      }
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData("text/html");
    if (!html) return; // collage texte brut : comportement natif
    const md = htmlToMarkdown(html);
    if (!md) return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + md + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + md.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); apply("bold"); }
    if (k === "i") { e.preventDefault(); apply("italic"); }
  };

  const tools: Array<{ key: Parameters<typeof apply>[0]; label: string; Icon: typeof Bold }> = [
    { key: "h2", label: "Titre de section (H2)", Icon: Heading2 },
    { key: "h3", label: "Sous-titre (H3)", Icon: Heading3 },
    { key: "bold", label: "Gras", Icon: Bold },
    { key: "italic", label: "Italique", Icon: Italic },
    { key: "ul", label: "Liste à puces", Icon: List },
    { key: "ol", label: "Liste numérotée", Icon: ListOrdered },
    { key: "quote", label: "Citation", Icon: Quote },
    { key: "link", label: "Lien", Icon: Link2 },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/60 bg-background/40 p-1">
        {tools.map(({ key, label, Icon }) => (
          <Button
            key={key}
            type="button"
            variant="ghost"
            size="sm"
            aria-label={label}
            title={label}
            disabled={preview}
            onClick={() => apply(key)}
            className="h-11 w-11 p-0"
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPreview((p) => !p)}
          className="h-11 px-3"
          aria-pressed={preview}
        >
          {preview
            ? <><PenLine className="h-4 w-4 mr-2" />Rédiger</>
            : <><Eye className="h-4 w-4 mr-2" />Aperçu</>}
        </Button>
      </div>

      {preview ? (
        <div className="min-h-[220px] rounded-lg border border-border/60 bg-background/30 px-4 py-3 text-foreground">
          {value.trim()
            ? <ArticleContent source={value} />
            : <p className="text-muted-foreground">Rien à prévisualiser pour le moment.</p>}
        </div>
      ) : (
        <Textarea
          id={id}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          rows={14}
          className="min-h-[220px] font-normal leading-relaxed"
          placeholder={placeholder ?? "Rédigez votre article…"}
          required
          minLength={20}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Mise en page conservée au copier-coller (titres, gras, listes). Le titre principal de la page (H1)
        est votre titre d'article&nbsp;: utilisez H2 pour les sections et H3 pour les sous-sections — c'est ce
        que privilégient Google et les moteurs de réponse IA.
      </p>
    </div>
  );
}

export default ArticleEditor;

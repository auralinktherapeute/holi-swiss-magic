import { Fragment } from "react";
import { parseArticleMarkdown, type ArticleBlock, type InlineToken } from "@/lib/article-markdown";

function Inline({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((tk, i) => {
        if (tk.type === "strong") return <strong key={i} className="font-semibold">{tk.value}</strong>;
        if (tk.type === "em") return <em key={i}>{tk.value}</em>;
        if (tk.type === "link") {
          const external = /^https?:\/\//i.test(tk.href);
          return (
            <a
              key={i}
              href={tk.href}
              className="underline underline-offset-2 hover:opacity-80"
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {tk.value}
            </a>
          );
        }
        return <Fragment key={i}>{tk.value}</Fragment>;
      })}
    </>
  );
}

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "heading": {
      const cls =
        block.level === 2
          ? "mt-10 mb-3 text-2xl md:text-3xl font-bold leading-snug"
          : block.level === 3
            ? "mt-8 mb-2 text-xl md:text-2xl font-semibold leading-snug"
            : "mt-6 mb-2 text-lg font-semibold leading-snug";
      if (block.level === 2) return <h2 className={cls}><Inline tokens={block.tokens} /></h2>;
      if (block.level === 3) return <h3 className={cls}><Inline tokens={block.tokens} /></h3>;
      return <h4 className={cls}><Inline tokens={block.tokens} /></h4>;
    }
    case "quote":
      return (
        <blockquote className="my-6 border-l-4 border-primary/60 pl-4 italic opacity-90">
          <Inline tokens={block.tokens} />
        </blockquote>
      );
    case "list":
      return block.ordered ? (
        <ol className="my-4 list-decimal space-y-1 pl-6">
          {block.items.map((it, i) => <li key={i}><Inline tokens={it} /></li>)}
        </ol>
      ) : (
        <ul className="my-4 list-disc space-y-1 pl-6">
          {block.items.map((it, i) => <li key={i}><Inline tokens={it} /></li>)}
        </ul>
      );
    default:
      return <p className="my-4 leading-relaxed whitespace-pre-line"><Inline tokens={block.tokens} /></p>;
  }
}

/** Rendu sémantique (h2/h3/ul/strong…) d'un article rédigé en Markdown léger. */
export function ArticleContent({ source, className = "" }: { source: string; className?: string }) {
  const blocks = parseArticleMarkdown(source);
  return (
    <div className={className}>
      {blocks.map((b, i) => <Block key={i} block={b} />)}
    </div>
  );
}

export default ArticleContent;

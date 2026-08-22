import { Link } from "@tanstack/react-router";

/**
 * Texto de comunidade com links clicáveis:
 * - markdown `[Etiqueta](/caminho)` ou `[Etiqueta](https://...)`
 * - URLs simples colados no texto (`https://...`)
 * Links internos usam o router; externos abrem em nova aba.
 */
const TOKEN_RE =
  /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)|(https?:\/\/[^\s<>()"']+)/g;

const linkClass =
  "break-words font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary";

export function RichTextInline({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE);

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const bare = match[3];
    const label = bare ?? match[1]!;
    const href = bare ?? match[2]!;
    const key = `${match.index}-${href}`;
    if (href.startsWith("/")) {
      nodes.push(
        <Link key={key} to={href as never} className={linkClass}>
          {label}
        </Link>,
      );
    } else {
      nodes.push(
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          {label}
        </a>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return <>{nodes}</>;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={className}>
      <RichTextInline text={text} />
    </p>
  );
}

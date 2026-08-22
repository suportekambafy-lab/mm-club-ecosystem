import { Link } from "@tanstack/react-router";

/**
 * Texto de comunidade com links markdown clicáveis: `[Etiqueta](/caminho)`.
 * Links internos usam o router; externos abrem em nova aba. O resto do texto
 * mantém-se tal como foi escrito (incluindo linhas).
 */
const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g;

export function RichText({ text, className }: { text: string; className?: string }) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(LINK_RE);

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const label = match[1];
    const href = match[2];
    const key = `${match.index}-${href}`;
    if (href.startsWith("/")) {
      nodes.push(
        <Link
          key={key}
          to={href as never}
          className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
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
          className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          {label}
        </a>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return <p className={className}>{nodes}</p>;
}

import Link from 'next/link';
import { extractHashtags } from '@/lib/post-text';

export type RenderedMention = {
  actorId: string;
  start: number; // Unicode code-point offset from Postgres
  label: string;
  href: string;
};

/** Renders verified @references and #hashtags without interpreting HTML. */
export function PostBody({ body, className = '', mentions = [] }: {
  body: string; className?: string; mentions?: RenderedMention[];
}) {
  type Token = { start: number; end: number; text: string; href: string; priority: number };
  const tokens: Token[] = [];
  for (const item of mentions) {
    const start = Array.from(body).slice(0, item.start).join('').length;
    const text = '@' + item.label;
    if (start < 0 || body.slice(start, start + text.length) !== text) continue;
    if (!/^\/(people|organizations)\/[0-9a-f-]{36}$/i.test(item.href)) continue;
    tokens.push({ start, end: start + text.length, text, href: item.href, priority: 0 });
  }
  for (const tag of extractHashtags(body)) {
    tokens.push({ start: tag.start, end: tag.end, text: body.slice(tag.start, tag.end),
      href: '/hashtags/' + encodeURIComponent(tag.key), priority: 1 });
  }
  tokens.sort((a, b) => a.start - b.start || a.priority - b.priority);
  let offset = 0;
  const fragments: React.ReactNode[] = [];
  for (const token of tokens) {
    if (token.start < offset) continue;
    if (token.start > offset) fragments.push(body.slice(offset, token.start));
    fragments.push(<Link key={token.start + ':' + token.priority}
      href={token.href} className="text-gold hover:underline">{token.text}</Link>);
    offset = token.end;
  }
  if (offset < body.length) fragments.push(body.slice(offset));
  return <p className={'whitespace-pre-wrap break-words text-ink ' + className}>{fragments}</p>;
}

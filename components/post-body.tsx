import Link from 'next/link';
import { extractHashtags } from '@/lib/post-text';

/** Renders hashtags without interpreting post text as HTML. */
export function PostBody({ body, className = '' }: { body: string; className?: string }) {
  const tokens = extractHashtags(body);
  let offset = 0;
  const fragments: React.ReactNode[] = [];
  for (const token of tokens) {
    if (token.start < offset) continue;
    if (token.start > offset) fragments.push(body.slice(offset, token.start));
    fragments.push(<Link
      key={token.start}
      href={'/hashtags/' + encodeURIComponent(token.key)}
      className="text-gold hover:underline"
    >{body.slice(token.start, token.end)}</Link>);
    offset = token.end;
  }
  if (offset < body.length) fragments.push(body.slice(offset));
  return <p className={'whitespace-pre-wrap break-words text-ink ' + className}>{fragments}</p>;
}

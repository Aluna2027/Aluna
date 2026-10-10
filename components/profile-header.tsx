import Link from 'next/link';
import { safeUrl } from '@/lib/profiles';

type Score = { label: string; value: number | null | undefined };

function displayScore(value: number | null | undefined) {
  return value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(1);
}

function scoreWidth(value: number | null | undefined) {
  return value == null || !Number.isFinite(Number(value))
    ? 0
    : Math.max(0, Math.min(100, Number(value) * 10));
}

function WbaScorePanel({ scores }: { scores: Score[] }) {
  const [total, ...categories] = scores;

  return (
    <section aria-label="World Benchmarking Alliance scores" className="mt-7 rounded-2xl border border-line bg-navy/50 p-5 sm:p-6">
      <div>
        <p className="deck-label">WORLD BENCHMARKING ALLIANCE</p>
        <h2 className="mt-2 text-xl font-bold text-ink">Social Benchmark Scores</h2>
        <p className="mt-2 text-sm text-muted">An overview of the company's WBA assessment results, scored out of 10.</p>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)]">
        <div className="flex flex-col justify-between rounded-2xl border border-gold/30 bg-panel-raised p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Total WBA Score</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="metric-number text-5xl leading-none text-gold sm:text-6xl">{displayScore(total?.value)}</span>
              <span className="text-sm text-muted">/ 10</span>
            </div>
          </div>
          <div className="mt-5">
            <div className="h-2.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div className="h-full rounded-full bg-gold" style={{ width: `${scoreWidth(total?.value)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">{total?.value == null ? 'No WBA total score available' : 'Overall assessment result'}</p>
          </div>
        </div>
        <div className="space-y-5 rounded-2xl border border-line bg-panel-raised p-5">
          {categories.map((score) => (
            <div key={score.label}>
              <div className="mb-2 flex items-end justify-between gap-4">
                <p className="text-sm font-medium leading-snug text-ink">{score.label}</p>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-gold">
                  {displayScore(score.value)} <span className="font-normal text-muted">/ 10</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <div className="h-full rounded-full bg-gold/80" style={{ width: `${scoreWidth(score.value)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">WBA scores are external benchmark results and are separate from Aluna's organization verification status.</p>
    </section>
  );
}

export function ProfileHeader({
  name, kind, country, location, website, imageUrl, editHref, unverified = false, scores = [],
}: {
  name: string;
  kind: string;
  country?: string | null;
  location?: string | null;
  website?: string | null;
  imageUrl?: string | null;
  editHref?: string;
  unverified?: boolean;
  scores?: Score[];
}) {
  const href = safeUrl(website);
  const image = safeUrl(imageUrl);

  return (
    <header className="rounded-3xl border border-line bg-panel p-7 sm:p-10">
      <div className="flex items-start gap-5">
        {image && (
          <div
            role="img"
            aria-label={`${name} profile image`}
            className="h-20 w-20 shrink-0 rounded-full border border-line bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(image)})` }}
          />
        )}
        <div>
          <p className="deck-label">
            ALUNA GLOBAL NETWORK · {kind}
            {country && <> · <span className="text-gold">{country}</span></>}
          </p>
          <h1 className="mt-5 text-4xl sm:text-5xl">{name}</h1>
          {unverified && <p className="mt-2 text-xs text-muted">Organization details have not been verified by Aluna.</p>}
        </div>
      </div>
      {scores.length > 0 && <WbaScorePanel scores={scores} />}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
        {location && <span>{location}</span>}
        {href && <a className="text-gold hover:underline" href={href} target="_blank" rel="noopener noreferrer">Website ↗</a>}
        {editHref && <Link className="ml-auto rounded-lg border border-gold px-4 py-2 text-gold hover:bg-gold/10" href={editHref}>Edit profile</Link>}
      </div>
    </header>
  );
}

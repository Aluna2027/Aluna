export function Card({ title, children, className = '' }: {title:string;children:React.ReactNode;className?:string}) {
  return <section className={`glass rounded-3xl p-6 sm:p-8 ${className}`}><h2 className="text-lg font-semibold">{title}</h2><div className="mt-4 text-muted">{children}</div></section>;
}
export function Placeholder({ title, description }: {title:string;description:string}) {
  return <Card title={title} className="min-h-64"><p className="max-w-xl leading-relaxed">{description}</p><span className="mt-8 inline-block rounded-sm bg-gold/20 px-4 py-2 text-xs font-semibold tracking-wide text-ink">COMING SOON</span></Card>;
}

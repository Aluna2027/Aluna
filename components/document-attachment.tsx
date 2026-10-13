import { FileText } from 'lucide-react';

export function DocumentAttachment({url,path}:{url:string;path:string}){
 const encoded=path.split('/').pop()??'';
 const filename=encoded.replace(/^[0-9a-f]{8}-[0-9a-f-]{27}-/i,'').replaceAll('_',' ')||'Document';
 return <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex max-w-full items-center gap-3 rounded-xl border border-line bg-panel-raised p-3 text-gold hover:underline">
  <FileText size={22} aria-hidden="true"/><span className="min-w-0 truncate">{filename}</span><span className="shrink-0 text-xs text-muted">Open / download</span>
 </a>;
}

'use client';
import { useState } from 'react';
export function ShareLink({path}:{path:string}) {const [copied,setCopied]=useState(false);return <button type="button" className="text-sm text-gold hover:underline" onClick={async()=>{const url=new URL(path,window.location.origin).toString();if(navigator.share){try{await navigator.share({url});return;}catch{/* user cancelled */}}try{await navigator.clipboard.writeText(url);setCopied(true);}catch{window.prompt('Copy link',url);}}}>{copied?'Link copied':'Share link'}</button>}

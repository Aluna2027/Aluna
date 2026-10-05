'use client';

import { useState } from 'react';
import { sdgs } from '@/lib/sdgs';

export function SdgMultiSelect({selected=[]}:{selected?:number[]}){
 const [values,setValues]=useState<number[]>(selected);
 const toggle=(number:number)=>setValues(current=>current.includes(number)?current.filter(v=>v!==number):[...current,number].sort((a,b)=>a-b));
 return <label className="block text-sm">SDG number:
  <details className="mt-2 rounded-xl border border-line bg-panel-raised">
   <summary className="cursor-pointer list-none p-3 text-ink">{values.length?`${values.length} SDG${values.length===1?'':'s'} selected`:'Select one or more SDGs'}</summary>
   <div className="max-h-80 space-y-2 overflow-y-auto border-t border-line p-3">
    {sdgs.map(s=><label key={s.number} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-panel">
     <input type="checkbox" name="sdg_numbers" value={s.number} checked={values.includes(s.number)} onChange={()=>toggle(s.number)} className="mt-1"/>
     <span>SDG {s.number}: {s.title}</span>
    </label>)}
   </div>
  </details>
  <span className="mt-2 block text-xs text-muted">Select one or more United Nations Sustainable Development Goals.</span>
 </label>;
}

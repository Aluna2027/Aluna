'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import countries from 'world-atlas/countries-110m.json';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { cities, formatPopulation, populationCategories, populationCategory } from '@/lib/cities';

const projection = geoEqualEarth().fitExtent([[22,25],[938,460]], {type:'Sphere'});
const path = geoPath(projection);
const geo = feature(countries as unknown as Topology, (countries.objects as unknown as {countries:GeometryCollection}).countries);
const features = geo.type === 'FeatureCollection' ? geo.features : [geo];
const regions = ['All regions', ...Array.from(new Set(cities.map(city=>city.region))).sort()];

export function WorldMap({theme='application'}:{theme?:'application'|'landing'}) {
  const isLanding=theme==='landing';
  const [search,setSearch]=useState('');
  const [region,setRegion]=useState('All regions');
  const [category,setCategory]=useState('All populations');
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState({x:0,y:0});
  const drag=useRef<{x:number;y:number;panX:number;panY:number}|null>(null);
  const [dragged,setDragged]=useState(false);
  const filtered=useMemo(()=>cities.filter(city=>
    (!search || `${city.name} ${city.country}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())) &&
    (region==='All regions'||city.region===region) &&
    (category==='All populations'||populationCategory(city.population).label===category)
  ),[search,region,category]);
  function startDrag(event:React.PointerEvent<SVGSVGElement>) { if (event.button!==0)return; drag.current={x:event.clientX,y:event.clientY,panX:pan.x,panY:pan.y};setDragged(false);event.currentTarget.setPointerCapture(event.pointerId); }
  function moveDrag(event:React.PointerEvent<SVGSVGElement>) { if (!drag.current)return;const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;if(Math.abs(dx)+Math.abs(dy)>4)setDragged(true);setPan({x:drag.current.panX+dx,y:drag.current.panY+dy}); }
  function endDrag() {drag.current=null;}
  return <div className={`space-y-5 ${isLanding?'public-map':''}`}>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm font-medium">Search cities<input type="search" placeholder="City or country" value={search} onChange={e=>setSearch(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-panel p-3"/></label>
      <label className="text-sm font-medium">Region<select value={region} onChange={e=>setRegion(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-panel p-3">{regions.map(r=><option key={r}>{r}</option>)}</select></label>
      <label className="text-sm font-medium">Population<select value={category} onChange={e=>setCategory(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-panel p-3"><option>All populations</option>{populationCategories.map(c=><option key={c.label}>{c.label}</option>)}</select></label>
    </div>
    <div className="glass overflow-hidden rounded-3xl"><div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><p><span className="deck-number text-base">{filtered.length}</span> <span className="text-sm text-muted">cities shown</span></p><div className="flex gap-2"><button aria-label="Zoom out" onClick={()=>setZoom(v=>Math.max(1,v/1.5))} className="rounded-lg border border-line px-3 py-1">−</button><button aria-label="Reset map" onClick={()=>{setZoom(1);setPan({x:0,y:0});}} className="rounded-lg border border-line px-3 py-1 text-xs">Reset</button><button aria-label="Zoom in" onClick={()=>setZoom(v=>Math.min(6,v*1.5))} className="rounded-lg border border-line px-3 py-1">+</button></div></div>
      <svg viewBox="0 0 960 490" role="img" aria-label="Interactive map showing cities in emerging economies" className={`w-full touch-none cursor-grab active:cursor-grabbing ${isLanding?'bg-[#e9f9fd]':'bg-[#090d17]'}`} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <defs><radialGradient id="ocean"><stop stopColor="#111b2c"/><stop offset="1" stopColor="#090d17"/></radialGradient><filter id="pin-glow"><feGaussianBlur stdDeviation="4"/></filter></defs>
        <rect width="960" height="490" fill={isLanding?'#e9f9fd':'url(#ocean)'}/>
        <g transform={`translate(${480+pan.x} ${245+pan.y}) scale(${zoom}) translate(-480 -245)`}>
          <path d={path({type:'Sphere'}) || ''} fill="none" stroke={isLanding?'#bedee8':'#354765'} strokeWidth="1"/>
          {features.map((f,i)=><path key={i} d={path(f)||''} fill={isLanding?'#d4e9f0':'#1b293c'} stroke={isLanding?'#9cc3d1':'#405273'} strokeWidth=".65"/>)}
          {filtered.map(city=>{const point=projection([city.longitude,city.latitude]);if(!point)return null;const color=isLanding?['#22b8ce','#13afa9','#8a4dff','#0796b2','#196d9b'][populationCategories.findIndex(c=>c.label===populationCategory(city.population).label)]:populationCategory(city.population).color;return <a key={city.id} href={`/cities/${city.id}`} onClick={event=>{if(dragged){event.preventDefault();setDragged(false);}}} aria-label={`${city.name}, ${city.country}: ${formatPopulation(city.population)} people`}><circle cx={point[0]} cy={point[1]} r="9" fill={color} opacity=".25" filter="url(#pin-glow)"/><circle cx={point[0]} cy={point[1]} r="5" fill={color} stroke={isLanding?'#ffffff':'#0a0c14'} strokeWidth="1.8"/><title>{city.name}, {city.country} · {formatPopulation(city.population)}</title></a>})}
        </g>
      </svg>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line px-5 py-4 text-xs text-muted">{populationCategories.map((c,index)=><span key={c.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{background:isLanding?['#22b8ce','#13afa9','#8a4dff','#0796b2','#196d9b'][index]:c.color}}/>{c.label}</span>)}</div>
    </div>
    <section aria-label="Cities" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(city=><Link key={city.id} href={`/cities/${city.id}`} className="glass rounded-2xl p-4 hover:border-gold/40"><span className="text-xs font-medium text-gold">{city.region} · {populationCategory(city.population).label}</span><h2 className="mt-1 font-semibold">{city.name}</h2><p className="text-sm text-muted">{city.country} · {formatPopulation(city.population)} people</p></Link>)}</section>
    {filtered.length===0&&<p className="py-10 text-center text-muted">No cities match these filters.</p>}
  </div>;
}

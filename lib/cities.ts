import cityData from '@/data/cities.json';

export type City = { id:string; name:string; country:string; countryCode:string; region:string; population:number; latitude:number; longitude:number; source:string };
export const cities: City[] = cityData;
export const populationCategories = [
  { label:'1–5M', min:1_000_000, max:6_000_000, color:'#7186ab' },
  { label:'6–10M', min:6_000_000, max:11_000_000, color:'#a7b9ce' },
  { label:'11–15M', min:11_000_000, max:16_000_000, color:'#d8ca9f' },
  { label:'16–20M', min:16_000_000, max:20_000_000, color:'#f2a65a' },
  { label:'20M+', min:20_000_000, max:Infinity, color:'#ffc53d' },
] as const;
export function populationCategory(population:number) { return populationCategories.find(c=>population>=c.min && population<c.max) ?? populationCategories[0]; }
export function formatPopulation(population:number) { return `${(population/1_000_000).toFixed(1)}M`; }
export function getCity(id:string) { return cities.find(c=>c.id===id); }
export const cityTabs = [
  { slug:'overview', title:'Overview' },{ slug:'feed', title:'Feed' },{ slug:'users', title:'Users' },{ slug:'universities', title:'Universities' },{ slug:'ngos', title:'NGOs' },{ slug:'companies', title:'Companies' },{ slug:'wifi-mesh-communities', title:'Wi-Fi Mesh Communities' },{ slug:'missions', title:'Missions' },{ slug:'fundraising', title:'Fundraising' },{ slug:'impact', title:'Impact' },{ slug:'resources', title:'Resources' },
] as const;

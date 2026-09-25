import Link from 'next/link';
import { WorldMap } from '@/components/world-map';
import { cities } from '@/lib/cities';
import './landing.css';

const navigation=[['World','#world'],['Feed','/feed'],['Missions','/missions'],['Network','/organizations'],['Impact','/impact'],['Fundraise','/fundraising']] as const;
const actions=[
  {name:'EXPLORE',detail:'Discover cities and the places where communities connect.',href:'#world'},
  {name:'CONNECT',detail:'Meet people, universities, NGOs and companies.',href:'/organizations'},
  {name:'JOIN',detail:'Take part in a mission or a local Wi-Fi mesh community.',href:'/missions'},
  {name:'FUND',detail:'Support fundraising linked to a mission.',href:'/fundraising'},
  {name:'PROVE',detail:'Follow contributions through evidence and verification.',href:'/proofs'},
] as const;
const destinations=[
  {name:'People',description:'Profiles and connections',href:'/search'},
  {name:'Universities',description:'Research and local participation',href:'/organizations'},
  {name:'NGOs',description:'Partners on the ground',href:'/organizations'},
  {name:'Companies',description:'Resources and collaboration',href:'/organizations'},
  {name:'Wi-Fi Mesh Communities',description:'Physical networks rooted in a city',href:'/communities'},
  {name:'Missions',description:'Teams, roles and shared goals',href:'/missions'},
  {name:'Fundraising',description:'Support a mission',href:'/fundraising'},
  {name:'Proof & Verification',description:'Evidence and review history',href:'/proofs'},
  {name:'Impact',description:'Reported and verified results',href:'/impact'},
] as const;

export default function Home(){return <div className="aluna-landing min-h-screen">
  <header className="landing-header"><div className="landing-container flex flex-wrap items-center justify-between gap-4 py-5"><Link href="/" className="landing-logo" aria-label="Aluna home">ALUNA<span>.</span></Link><nav className="landing-nav" aria-label="Public navigation">{navigation.map(([label,href])=><Link key={label} href={href}>{label}</Link>)}</nav><div className="flex items-center gap-3"><Link href="/login" className="landing-login">Log in</Link><Link href="/login?mode=signup" className="landing-button">Join Aluna</Link></div></div></header>
  <main><section className="landing-hero landing-container"><div className="landing-eyebrow">THE GLOBAL NETWORK FOR SUSTAINABILITY</div><h1>A connected world.<br/><span>One community at a time.</span></h1><p>Explore cities, connect with people and organizations, and help build community-owned Wi-Fi mesh networks with measurable impact.</p><div className="landing-hero-actions"><Link href="#world" className="landing-button">EXPLORE THE WORLD</Link><Link href="/login?mode=signup" className="landing-button landing-button-outline">JOIN ALUNA</Link></div></section>
  <section id="world" className="landing-container landing-world" aria-labelledby="world-heading"><div className="landing-section-heading"><div><div className="landing-eyebrow">WORLD / CITIES</div><h2 id="world-heading">Explore the Aluna world</h2><p>Search {cities.length.toLocaleString('en-US')} cities from the existing Aluna city dataset. City Hubs open after sign in.</p></div></div><WorldMap theme="landing"/></section>
  <section className="landing-container landing-section" aria-labelledby="actions-heading"><div className="landing-eyebrow">EXPLORE · CONNECT · JOIN · FUND · PROVE</div><h2 id="actions-heading">One network. Connected actions.</h2><div className="landing-action-grid">{actions.map((action,index)=><Link key={action.name} href={action.href} className="landing-action"><span className="landing-index">0{index+1}</span><h3>{action.name}</h3><p>{action.detail}</p><span aria-hidden="true" className="landing-arrow">↗</span></Link>)}</div></section>
  <section className="landing-container landing-section landing-last" aria-labelledby="network-heading"><div className="landing-eyebrow">THE ALUNA NETWORK</div><h2 id="network-heading">People, places and proof</h2><p>Explore the existing network tools. Sign in to view community activity and participate.</p><div className="landing-destinations">{destinations.map(destination=><Link key={destination.name} href={destination.href} className="landing-destination"><strong>{destination.name}</strong><span>{destination.description}</span><span aria-hidden="true">↗</span></Link>)}</div></section></main>
  <footer className="landing-footer"><div className="landing-container flex flex-wrap justify-between gap-3"><span>ALUNA GLOBAL NETWORK</span><span>From access to ownership.</span></div></footer>
 </div>}

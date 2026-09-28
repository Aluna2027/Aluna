import Link from 'next/link';
import { WorldMap } from '@/components/world-map';
import './landing.css';

const navigation=[
  ['WORLD','#world'],
  ['NETWORK','#network'],
  ['MISSION STATEMENT','#mission-statement'],
  ['CHOOSE YOUR PATH','#choose-your-path'],
  ['EXPLORE THE WORLD','#explore-world'],
  ['PEOPLE, PLACES AND PROOF','#people-places-proof'],
  ['HOW IT WORKS','#how-it-works'],
  ['IMPACT','#impact'],
] as const;

const paths=[
  {number:'01',name:'EXPLORE',detail:'Discover cities, communities and opportunities.',image:'explore'},
  {number:'02',name:'CONNECT',detail:'People, universities, NGOs and companies.',image:'connect'},
  {number:'03',name:'JOIN',detail:'Be part of a mission on the ground.',image:'join'},
  {number:'04',name:'FUND',detail:'Support projects and create impact.',image:'fund'},
  {number:'05',name:'PROVE',detail:'Show your contribution. Real results. Verified.',image:'prove'},
] as const;

const network=[
  ['01','People','people'],['02','Universities','universities'],['03','NGOs','ngos'],
  ['04','Companies','companies'],['05','Wi-Fi Mesh Communities','communities'],['06','Missions','missions'],
  ['07','Fundraising','fundraising'],['08','Proof & Verification','proof'],['09','Impact','impact'],
] as const;

const system=[
  ['01','PEOPLE & ORGANIZATIONS','CONNECT'],['02','WI-FI MESH COMMUNITIES','CREATE'],
  ['03','MISSIONS','JOIN'],['04','CONTRIBUTIONS','CONTRIBUTE'],['05','PROOF','DOCUMENT'],
  ['06','VERIFICATION','VERIFY'],['07','IMPACT','SCALE'],
] as const;

export default function Home(){return <div className="aluna-landing">
  <section id="top" className="landing-hero landing-layer landing-dark">
    <header className="landing-header">
      <Link href="#top" className="landing-logo" aria-label="Aluna home"><img src="/aluna-logo.svg" alt="ALUNA"/></Link>
      <nav className="landing-nav" aria-label="Landing page navigation">
        <div>{navigation.slice(0,4).map(([label,href])=><Link key={label} href={href}>{label}</Link>)}</div>
        <div>{navigation.slice(4).map(([label,href])=><Link key={label} href={href}>{label}</Link>)}</div>
      </nav>
      <div className="landing-account-actions">
        <Link href="/login" className="landing-account landing-account-login">LOG IN</Link>
        <Link href="/login?mode=signup" className="landing-account landing-account-join">JOIN ALUNA</Link>
      </div>
    </header>
    <div className="landing-hero-content">
      <div className="landing-hero-copy">
        <p className="landing-kicker">A GLOBAL MOVEMENT</p>
        <h1>A CONNECTED<br/>WORLD BELONGS<br/>TO <span>ITS PEOPLE.</span></h1>
        <p className="landing-lead">Aluna builds community-owned Wi-Fi mesh networks that connect the unconnected — and turn access into opportunity, ownership and real impact.</p>
      </div>
      <div className="landing-hero-visual" aria-hidden="true"><div className="landing-orbit landing-orbit-one"/><div className="landing-orbit landing-orbit-two"/><div className="landing-hero-portrait"/></div>
    </div>
  </section>

  <section id="world" className="landing-world-story landing-layer">
    <div className="landing-world-photo" aria-hidden="true"/>
    <div className="landing-world-copy">
      <p className="landing-kicker">02 · WORLD</p>
      <h2 className="landing-fill-line">A FAIRER,<br/>MORE CONNECTED<br/>WORLD IS <span>POSSIBLE.</span></h2>
      <p>Community-owned infrastructure turns connectivity into opportunity, ownership and resilience.</p>
    </div>
  </section>

  <section id="network" className="landing-network-statement landing-layer landing-dark">
    <div className="landing-network-photo" aria-hidden="true"/>
    <div className="landing-network-copy">
      <p className="landing-kicker">03 · NETWORK</p>
      <p className="landing-spaced">REAL PEOPLE. REAL PLACES.</p>
      <h2>REAL IMPACT.</h2>
      <h3>AND WE COVER ALL YOUR COSTS.</h3>
      <p>People and organizations connect to real places, missions and communities — turning participation into measurable impact.</p>
    </div>
  </section>

  <section id="mission-statement" className="landing-mission landing-layer landing-light">
    <div>
      <p className="landing-kicker">04 · MISSION STATEMENT</p>
      <p className="landing-mission-line"><span>FROM ACCESS</span><b>→</b><strong>TO OWNERSHIP</strong></p>
      <p className="landing-mission-line"><span>FROM CONNECTION</span><b>→</b><strong>TO EMPOWERMENT</strong></p>
      <p className="landing-mission-line"><span>FROM SPECTATORS</span><b>→</b><strong>TO FOUNDERS</strong></p>
    </div>
    <p className="landing-mission-copy">People don&apos;t just use the internet, they own it. From communities to global impact, Aluna turns access into participation and ownership.</p>
  </section>

  <section id="choose-your-path" className="landing-paths landing-layer landing-dark">
    <div className="landing-section-head"><div><p className="landing-kicker">05 · GET INVOLVED</p><h2>CHOOSE YOUR PATH.</h2></div><p>Five ways to be part of the Aluna Movement.<br/>Different roles. One mission.</p></div>
    <div className="landing-path-grid">{paths.map(path=><article key={path.name} className={`landing-path-card landing-path-${path.image}`}><div className="landing-card-shade"/><div className="landing-card-copy"><span className="landing-number">{path.number}</span><h3>{path.name}</h3><p>{path.detail}</p></div></article>)}</div>
  </section>

  <section id="explore-world" className="landing-map-section landing-layer landing-dark">
    <div className="landing-section-head"><div><p className="landing-kicker">06 · WORLD / CITIES</p><h2>EXPLORE<br/>THE WORLD.</h2></div><p>Discover cities, communities and projects where Aluna is building community-owned networks. Featured cities are shown first; all 162 remain available on demand.</p></div>
    <WorldMap theme="landing"/>
  </section>

  <section id="people-places-proof" className="landing-network-grid-section landing-layer landing-dark">
    <div className="landing-section-head"><div><p className="landing-kicker">07 · THE ALUNA NETWORK</p><h2>PEOPLE, PLACES<br/>AND PROOF.</h2></div><p>Explore the people, organizations, communities and systems that make the network real.</p></div>
    <div className="landing-network-grid">{network.map(([number,name,image])=><article key={name} className={`landing-network-card landing-network-${image}`}><div className="landing-card-shade"/><div className="landing-card-copy"><span className="landing-number">{number}</span><h3>{name}</h3></div></article>)}</div>
  </section>

  <section id="how-it-works" className="landing-system landing-layer landing-dark">
    <div className="landing-section-head"><div><p className="landing-kicker">08 · THE SYSTEM</p><h2>HOW THE<br/>NETWORK WORKS.</h2></div><p>From people to global impact. A transparent system powered by community data.</p></div>
    <div className="landing-system-flow">{system.map(([number,label,verb],index)=><div className="landing-system-step" key={label}><span className="landing-number">{number}</span><strong>{label}</strong><small>{verb}</small>{index<system.length-1&&<i aria-hidden="true">→</i>}</div>)}</div>
  </section>

  <section id="impact" className="landing-impact landing-layer landing-dark">
    <div className="landing-impact-story"><div><p className="landing-kicker">09 · PROOF & IMPACT</p><h2>PROOF CREATES<br/>REAL IMPACT.</h2><p>Community-generated data. Indepently verified. Real results for people and the planet.</p></div><div className="landing-impact-metrics"><div><span>1.5B</span><small>PEOPLE TO CONNECT</small></div><div><span>1,500</span><small>COMMUNITY PROJECTS</small></div><div><span>1,420</span><small>LOCAL WOMEN OWNERS / PROJECT</small></div><div><span>L1–L4</span><small>VERIFICATION</small></div></div></div>
    <div className="landing-join"><div><p className="landing-kicker">JOIN ALUNA</p><h2>JOIN THE<br/>GLOBAL NETWORK.</h2><p>Be part of a fairer, more connected world. People, communities and organizations building real impact together.</p></div><div className="landing-join-actions"><Link href="/login?mode=signup" className="landing-account landing-account-join">JOIN ALUNA</Link><Link href="/login" className="landing-account landing-account-login">LOG IN</Link></div></div>
  </section>

  <footer className="landing-footer landing-layer landing-dark"><Link href="#top" className="landing-footer-logo" aria-label="Back to top"><img src="/aluna-logo.svg" alt="ALUNA"/></Link><div className="landing-footer-meta"><span>A CONNECTED HUMAN FUTURE.</span><span>© 2027 ALUNA. ALL RIGHTS RESERVED.</span></div></footer>
</div>}

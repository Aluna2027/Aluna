import {
  BriefcaseBusiness, Building2, Droplets, Earth, Equal, Factory, Fish,
  GraduationCap, HandHeart, Handshake, HeartPulse, Recycle, Scale,
  ShieldCheck, Sun, Trees, Wheat, type LucideIcon,
} from 'lucide-react';

const icons:Record<number,LucideIcon>={
  1:HandHeart,2:Wheat,3:HeartPulse,4:GraduationCap,5:Scale,
  6:Droplets,7:Sun,8:BriefcaseBusiness,9:Factory,10:Equal,
  11:Building2,12:Recycle,13:Earth,14:Fish,15:Trees,
  16:ShieldCheck,17:Handshake,
};

// Aluna's concept icons use the three-brand-accent palette, not UN SDG tile colors.
export const alunaSdgAccent:Record<number,string>={
  1:'#FFC43D',2:'#A78BFA',3:'#26E7D4',4:'#FFC43D',
  5:'#A78BFA',6:'#26E7D4',7:'#FFC43D',8:'#A78BFA',
  9:'#26E7D4',10:'#FFC43D',11:'#A78BFA',12:'#26E7D4',
  13:'#FFC43D',14:'#A78BFA',15:'#26E7D4',16:'#FFC43D',17:'#A78BFA',
};

export function DirectorySdgIcon({number,size=25,className=''}:{number:number;size?:number;className?:string}) {
  const Graphic=icons[number]??Factory;
  return <Graphic aria-hidden="true" size={size} strokeWidth={2} color={alunaSdgAccent[number]??'#26E7D4'} className={className}/>;
}

"""Generate checked map data from the supplied Aluna workbook plus GeoNames coordinates."""
import json, re, unicodedata, openpyxl
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'data/source/Aluna_1M_Plus_Cities_Emerging_Economies repaired.xlsx'
GAZ=Path('/tmp/aluna-geodata/package/cities.json')
COUNTRIES={
 'Indonesia':('ID','Asia'),'Bangladesh':('BD','Asia'),'India':('IN','Asia'),'China':('CN','Asia'),'Egypt':('EG','Africa'),'Philippines':('PH','Asia'),'Pakistan':('PK','Asia'),'Brazil':('BR','South America'),'Thailand':('TH','Asia'),'Mexico':('MX','North America'),'Türkiye':('TR','Europe'),'Vietnam':('VN','Asia'),'Argentina':('AR','South America'),'Nigeria':('NG','Africa'),'Angola':('AO','Africa'),'DR Congo':('CD','Africa'),'Colombia':('CO','South America'),'Peru':('PE','South America'),'Iran':('IR','Asia'),'Malaysia':('MY','Asia'),'Tanzania':('TZ','Africa'),'South Africa':('ZA','Africa'),'Sudan':('SD','Africa'),'Ethiopia':('ET','Africa'),"Côte d'Ivoire":('CI','Africa'),'Jordan':('JO','Asia'),'Iraq':('IQ','Asia'),'Kenya':('KE','Africa'),'Afghanistan':('AF','Asia'),'Myanmar':('MM','Asia'),'Ghana':('GH','Africa'),'Sri Lanka':('LK','Asia'),'Cameroon':('CM','Africa'),'Uganda':('UG','Africa'),'Dominican Republic':('DO','North America'),'Morocco':('MA','Africa'),'Somalia':('SO','Africa'),'Syria':('SY','Asia'),'Mali':('ML','Africa'),'Yemen':('YE','Asia'),'Uzbekistan':('UZ','Asia'),'Madagascar':('MG','Africa'),'Senegal':('SN','Africa'),'Congo, Rep.':('CG','Africa'),'Zambia':('ZM','Africa'),'Algeria':('DZ','Africa'),'Nepal':('NP','Asia'),'Burkina Faso':('BF','Africa'),'Mozambique':('MZ','Africa'),'Ecuador':('EC','South America'),'North Korea':('KP','Asia'),'Guatemala':('GT','North America'),'Guinea':('GN','Africa'),'Ukraine':('UA','Europe'),'Venezuela':('VE','South America'),'Benin':('BJ','Africa')}
ALIASES={'Al-Qahirah (Cairo)':'Cairo','Krung Thep Maha Nakhon (Bangkok)':'Bangkok','Ciudad de México (Mexico City)':'Mexico City','Tehrān (Tehran)':'Tehran','Al-Kharṭūm (Khartoum)':'Khartoum','Ādīs Ᾱbeba (Addis Ababa)':'Addis Ababa','Ammān (Amman)':'Amman','Baghdād (Baghdad)':'Baghdad','Kābul (Kabul)':'Kabul','Hà Nội (Hanoi)':'Hanoi','Islāmābād':'Islamabad','Muqdisho (Mogadishu)':'Mogadishu','Dimashq (Damascus)':'Damascus',"Şan'ā' (Sana'a)":'Sanaa','Toshkent (Tashkent)':'Tashkent','Ürümqi':'Urumqi','El Djazaïr (Algiers)':'Algiers',"P'yŏngyang (Pyongyang)":'Pyongyang','Ciudad de Guatemala (Guatemala City)':'Guatemala City','Coyah (Conacry)':'Conakry','Kyiv (Kiev)':'Kyiv','Sri Jayawardenepura Kotte - Colombo':'Colombo','Kasaï-Oriental':'Mbuji-Mayi','Kalyan-Dombivli':'Kalyan','Cebu City':'Cebu City'}
OVERRIDES={
 # Urban-area labels that do not match a single gazetteer point.
 ('China','Suzhou'):(31.30408,120.59538),('Indonesia','Bandung'):(-6.92222,107.60694),('China','Quanzhou'):(24.91389,118.58583),('China','Changsha'):(28.19874,112.97087),('China','Fuzhou'):(26.06139,119.30611),('Mexico','Monterrey'):(25.68435,-100.31721),('India','Hajipur'):(25.685,85.210),('DR Congo','Kasaï-Oriental'):(-6.136,23.590),('Guinea','Coyah (Conacry)'):(9.537,-13.678),('Sri Lanka','Sri Jayawardenepura Kotte - Colombo'):(6.927,79.862),
}
def norm(v):
 v=unicodedata.normalize('NFKD',v).encode('ascii','ignore').decode().lower()
 return re.sub(r'[^a-z0-9]+','',v)
by_name=defaultdict(list)
for city in json.load(open(GAZ)):
 by_name[(city['country'],norm(city['name']))].append(city)
workbook=openpyxl.load_workbook(SOURCE,read_only=True,data_only=True)
output=[]; missing=[]; aliases=[]
for row in list(workbook['Cities 1M+'].values)[4:]:
 country,name,pop,category,_,_,source=row
 if not country or not name or not isinstance(pop,(int,float)):continue
 code,region=COUNTRIES[country]
 target=ALIASES.get(name,name)
 matches=by_name[(code,norm(target))]
 if (country,name) in OVERRIDES:
  lat,lng=OVERRIDES[country,name]
 elif matches:
  # A name may occur multiple times; inspect such records before relying on the first.
  lat,lng=float(matches[0]['lat']),float(matches[0]['lng'])
  if len(matches)>1:aliases.append(f'{country}: {name} ({len(matches)} candidate places)')
 else:
  missing.append(f'{country}: {name} -> {target}');continue
 slug=norm(name) or 'city'
 output.append({'id':f'{code.lower()}-{slug}','name':name,'country':country,'countryCode':code,'region':region,'population':int(pop),'latitude':lat,'longitude':lng,'source':source})
(ROOT/'data/cities.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
print('Imported:',len(output),'Missing:',missing,'Multiple names:',aliases)

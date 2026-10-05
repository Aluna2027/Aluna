export const countryGroups = [
  {letter:'A',countries:['Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan']},
  {letter:'B',countries:['Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi']},
  {letter:'C',countries:['Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic (CAR)','Chad','Chile','China','Colombia','Comoros','Congo (Congo-Brazzaville)','Costa Rica',"Cote d'Ivoire (Ivory Coast)",'Croatia','Cuba','Cyprus','Czechia (Czech Republic)']},
  {letter:'D',countries:['Democratic Republic of the Congo (Congo-Kinshasa)','Denmark','Djibouti','Dominica','Dominican Republic']},
  {letter:'E',countries:['Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini (formerly Swaziland)','Ethiopia']},
  {letter:'F',countries:['Fiji','Finland','France']},
  {letter:'G',countries:['Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana']},
  {letter:'H',countries:['Haiti','Holy See (Vatican City) – UN Observer State','Honduras','Hungary']},
  {letter:'I',countries:['Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy']},
  {letter:'J',countries:['Jamaica','Japan','Jordan']},
  {letter:'K',countries:['Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan']},
  {letter:'L',countries:['Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg']},
  {letter:'M',countries:['Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar (formerly Burma)']},
  {letter:'N',countries:['Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia (formerly Macedonia)','Norway']},
  {letter:'O',countries:['Oman']},
  {letter:'P',countries:['Pakistan','Palau','Palestine – UN Observer State','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal']},
  {letter:'Q',countries:['Qatar']},
  {letter:'R',countries:['Romania','Russia','Rwanda']},
  {letter:'S',countries:['Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria']},
  {letter:'T',countries:['Tajikistan','Tanzania','Thailand','Timor-Leste (East Timor)','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey (Türkiye)','Turkmenistan','Tuvalu']},
  {letter:'U',countries:['Uganda','Ukraine','United Arab Emirates (UAE)','United Kingdom (UK)','United States of America (USA)','Uruguay','Uzbekistan']},
  {letter:'V',countries:['Vanuatu','Venezuela','Vietnam']},
  {letter:'Y',countries:['Yemen']},
  {letter:'Z',countries:['Zambia','Zimbabwe']},
] as const;

export const countries = countryGroups.flatMap(group=>group.countries);
export const countrySet = new Set<string>(countries);

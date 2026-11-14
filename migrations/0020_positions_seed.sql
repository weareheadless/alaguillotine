INSERT INTO positions (id, slug, person, role, org, kind, from_date, to_date, date_precision, source_url, note, created_at)
VALUES
 ('jared-kushner:whitehouse:senior-adviser', 'jared-kushner', 'Jared Kushner',
  'Senior Adviser to the President', 'The White House', 'state',
  '2017-01-20', '2021-01-20', 'day',
  'https://ballotpedia.org/Jared_Kushner',
  'Unpaid; no Senate confirmation. Resigned with the first administration.', '2026-11-14T00:00:00Z'),

 ('jared-kushner:state:peace-envoy', 'jared-kushner', 'Jared Kushner',
  'Special envoy for peace', 'US Department of State', 'state',
  '2026-02-19', NULL, 'day',
  'https://www.politico.com/news/2026/02/19/trump-jared-kushner-peace-envoy-00788606',
  'Announced 19 February 2026. Before that date he took part in negotiations as a private citizen, by his own account and CREW''s.', '2026-11-14T00:00:00Z'),

 ('jared-kushner:affinity:founder', 'jared-kushner', 'Jared Kushner',
  'Founder and chief executive', 'Affinity Partners', 'firm',
  '2021-01-01', NULL, 'year',
  'https://www.cnn.com/2026/10/01/us/jared-kushner-israel-gaza-investments-invs-vis',
  'Founded on leaving the White House; he is the sole owner.', '2026-11-14T00:00:00Z'),

 ('elon-musk:doge:special-employee', 'elon-musk', 'Elon Musk',
  'Special government employee, Department of Government Efficiency', 'Executive Office of the President', 'state',
  '2025-01-20', '2025-05-30', 'day',
  'https://oversightdemocrats.house.gov/news/press-releases/musk-spent-130-days-bringing-chaos-cruelty-and-corruption-government',
  '130 days. Never confirmed; treated as a special government employee, which is the classification the White House used in court.', '2026-11-14T00:00:00Z'),

 ('elon-musk:tesla:ceo', 'elon-musk', 'Elon Musk',
  'Chief executive', 'Tesla', 'firm',
  '2008-01-01', NULL, 'year',
  'https://www.britannica.com/money/Elon-Musk',
  'Chief executive since October 2008; also the company''s largest individual shareholder.', '2026-11-14T00:00:00Z'),

 ('elon-musk:spacex:ceo', 'elon-musk', 'Elon Musk',
  'Chief executive and chief engineer', 'SpaceX', 'firm',
  '2002-01-01', NULL, 'year',
  'https://www.britannica.com/money/Elon-Musk',
  'Founded 2002. Holds federal contracts, which is why the term matters here.', '2026-11-14T00:00:00Z'),

 ('donald-trump:whitehouse:president-45', 'donald-trump', 'Donald Trump',
  'President', 'United States', 'state',
  '2017-01-20', '2021-01-20', 'day',
  'https://ballotpedia.org/Donald_Trump',
  '', '2026-11-14T00:00:00Z'),

 ('donald-trump:whitehouse:president-47', 'donald-trump', 'Donald Trump',
  'President', 'United States', 'state',
  '2025-01-20', NULL, 'day',
  'https://www.whitehouse.gov/administration/donald-j-trump/',
  'Second, non-consecutive term.', '2026-11-14T00:00:00Z'),

 ('mohammed-bin-salman:saudi:crown-prince', 'mohammed-bin-salman', 'Mohammed bin Salman',
  'Crown Prince', 'Kingdom of Saudi Arabia', 'state',
  '2017-06-21', NULL, 'day',
  'https://www.britannica.com/biography/Mohammed-bin-Salman',
  'Also defence minister from 2015.', '2026-11-14T00:00:00Z'),

 ('mohammed-bin-salman:saudi:prime-minister', 'mohammed-bin-salman', 'Mohammed bin Salman',
  'Prime Minister', 'Kingdom of Saudi Arabia', 'state',
  '2022-09-27', NULL, 'day',
  'https://www.britannica.com/biography/Mohammed-bin-Salman',
  '', '2026-11-14T00:00:00Z'),

 ('mohammed-bin-salman:pif:chair', 'mohammed-bin-salman', 'Mohammed bin Salman',
  'Chairman', 'Public Investment Fund', 'fund',
  '2015-01-01', NULL, 'year',
  'https://www.britannica.com/biography/Mohammed-bin-Salman',
  'The fund that committed $2bn to Affinity Partners.', '2026-11-14T00:00:00Z'),

 ('narendra-modi:india:prime-minister', 'narendra-modi', 'Narendra Modi',
  'Prime Minister', 'Republic of India', 'state',
  '2014-05-26', NULL, 'day',
  'https://www.britannica.com/biography/Narendra-Modi',
  '', '2026-11-14T00:00:00Z'),

 ('emmanuel-macron:france:president', 'emmanuel-macron', 'Emmanuel Macron',
  'President', 'French Republic', 'state',
  '2017-05-14', NULL, 'day',
  'https://www.britannica.com/biography/Emmanuel-Macron',
  '', '2026-11-14T00:00:00Z'),

 ('emmanuel-macron:france:economy-minister', 'emmanuel-macron', 'Emmanuel Macron',
  'Minister of the Economy, Industry and Digital Affairs', 'French Republic', 'state',
  '2014-08-26', '2016-08-30', 'day',
  'https://www.britannica.com/biography/Emmanuel-Macron',
  'Resigned to run for president.', '2026-11-14T00:00:00Z'),

 ('darren-woods:exxonmobil:ceo', 'darren-woods', 'Darren Woods',
  'Chairman and chief executive', 'ExxonMobil', 'firm',
  '2017-01-01', NULL, 'day',
  'https://corporate.exxonmobil.com/who-we-are/leadership/darren-woods',
  'Chief executive from 1 January 2017; chairman from 2017.', '2026-11-14T00:00:00Z')
ON CONFLICT(id) DO NOTHING;

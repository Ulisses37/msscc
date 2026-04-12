export type PartnerLink = {
  name: string;
  href: string;
  pair?: { name: string; href: string };
};

export const samplePartnerLinks: PartnerLink[] = [
  { name: 'City of Sacramento',                           href: 'https://www.cityofsacramento.gov/mayor-council'                                },
  { name: 'Consulate-General of Japan, San Francisco',    href: 'https://www.sf.us.emb-japan.go.jp/itprtop_en/index.html'                      },
  { name: 'Japanese American Citizens League Sacramento', href: 'https://www.facebook.com/sacjacl/'                                            },
  { name: 'California-Japan Sister Cities Network',       href: 'https://www.caljapansistercities.org'                                         },
  { name: 'Matsuyama International Center (MIC)',         href: 'https://www.mic.ehime.jp/MIC/Foreigner/Matsuyama%20International%20Center.html'},
  { name: 'Sacramento Camellia Society',                  href: 'https://camelliasocietyofsacramento.org'                                      },
  { name: 'Sacramento Boy Scout Troop 50B',               href: 'https://www.buddhistchurch.org/organizations'                                 },
  { name: 'Sacramento Buddhist Church',                   href: 'https://www.buddhistchurch.org'                                               },
  { name: 'Orchard Elementary School',                    href: 'https://orchard.trusd.net',
    pair: { name: 'Matsuyama Elementary School',          href: 'https://matsuyama.scusd.edu' }                                                },
  { name: 'C.K. McClatchy High School',                   href: 'https://ckm.scusd.edu',
    pair: { name: 'Rosemont High School',                 href: 'https://rosemont.scusd.edu' }                                                 },
  { name: 'Sacramento Tree Foundation',                   href: 'https://sactree.org',
    pair: { name: 'Hanami Line',                          href: 'https://sactree.org/hanami/' }                                                },
];

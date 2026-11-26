from dataclasses import dataclass


@dataclass(frozen=True)
class PartnerSeed:
    """Describe a public acknowledgment copied from the client's website."""

    display_name_en: str
    website_url: str | None = None


PARTNER_SEED_GROUPS = (
    (
        "Partner",
        "パートナー",
        (
            PartnerSeed(
                "City of Sacramento",
                "https://www.cityofsacramento.gov/mayor-council",
            ),
            PartnerSeed(
                "Consulate-General of Japan, San Francisco",
                "https://www.sf.us.emb-japan.go.jp/itprtop_en/index.html",
            ),
            PartnerSeed(
                "Japanese American Citizens League Sacramento",
                "https://www.facebook.com/sacjacl/",
            ),
            PartnerSeed(
                "California-Japan Sister Cities Network",
                "https://www.caljapansistercities.org",
            ),
            PartnerSeed(
                "Matsuyama International Center (MIC)",
                "https://www.mic.ehime.jp/MIC/Foreigner/Matsuyama%20International%20Center.html",
            ),
            PartnerSeed(
                "Sacramento Camellia Society",
                "https://camelliasocietyofsacramento.org",
            ),
            PartnerSeed(
                "Sacramento Boy Scout Troop 50B",
                "https://www.buddhistchurch.org/organizations",
            ),
            PartnerSeed("Sacramento Buddhist Church", "https://www.buddhistchurch.org"),
            PartnerSeed("Orchard Elementary School", "https://orchard.trusd.net"),
            PartnerSeed("Matsuyama Elementary School", "https://matsuyama.scusd.edu"),
            PartnerSeed("C.K. McClatchy High School", "https://ckm.scusd.edu"),
            PartnerSeed("Rosemont High School", "https://rosemont.scusd.edu"),
            PartnerSeed("Sacramento Tree Foundation", "https://sactree.org"),
            PartnerSeed("Hanami Line", "https://sactree.org/hanami/"),
        ),
    ),
    (
        "Donor",
        "寄付者",
        (
            PartnerSeed("Miko Sawamura"),
            PartnerSeed("Charles and Doris Kobayashi"),
            PartnerSeed("Mary Caniglia"),
            PartnerSeed("Christine Umeda"),
            PartnerSeed("Francis M. Lee"),
            PartnerSeed("Aileen Nishio"),
            PartnerSeed("Donald and Linda Honda"),
            PartnerSeed("Fusako and Henry Mizushima"),
            PartnerSeed("Michael and Janice Yamaoka-Luszczak"),
        ),
    ),
    (
        "Sponsor",
        "スポンサー",
        (
            PartnerSeed("Salad Cosmo"),
            PartnerSeed("Propp Christensen Caniglia LLP"),
            PartnerSeed("Freeport Bakery"),
            PartnerSeed("Kazumi Wines LLC"),
            PartnerSeed("North American Food Distributing Co., Inc."),
        ),
    ),
)

"""Editable placeholder data for preproduction BoardMember initialization."""

from dataclasses import dataclass
from datetime import date

PLACEHOLDER_START_DATE = date(2000, 1, 1)


@dataclass(frozen=True)
class BoardMemberSeed:
    """The model fields needed to create one placeholder board member."""

    display_name_en: str
    role_en: str
    display_order: int

## Initial seed data for board members
## Name, Role, Display Order
INITIAL_OFFICER_SEEDS = (
    BoardMemberSeed("President Placeholder", "President", 0),
    BoardMemberSeed("Vice President Placeholder", "Vice President", 1),
    BoardMemberSeed("Secretary Placeholder", "Secretary", 2),
    BoardMemberSeed("Treasurer Placeholder", "Treasurer", 3),
)


# Initial seed data for directors; Seperation based on seeding role.en = "Director"
# role.jp is not accounted for in the seed data, nor in app/local/about/page
INITIAL_DIRECTOR_SEEDS = tuple(
    BoardMemberSeed(f"Director {index}", "Director", index + 3)
    for index in range(1, 9)
)


INITIAL_BOARD_MEMBER_SEEDS = INITIAL_OFFICER_SEEDS + INITIAL_DIRECTOR_SEEDS

#Display order is append to end of list automatically from seeding function
REFILL_OFFICER_SEED = BoardMemberSeed(
    "Officer Placeholder",
    "Officer",
    0,
)

import unicodedata

ENCRYPTED_PII_SEARCH_RESULT_LIMIT = 100

DONATION_SEARCH_FIELDS = (
    "donor_first_name_encrypted", "donor_last_name_encrypted", "donor_email_encrypted",
)
MEMBERSHIP_SEARCH_FIELDS = (
    "first_name_encrypted", "last_name_encrypted", "email_encrypted",
)


def normalize_search_text(value: str | None) -> str:
    """Compare canonical Unicode text without case or surrounding whitespace differences."""
    return unicodedata.normalize("NFC", value or "").strip().casefold()


def phone_digits(value: str | None) -> str:
    """Remove phone formatting without changing stored values."""
    return "".join(character for character in value or "" if character.isdecimal())


def search_encrypted_pii(queryset, query: str, text_fields: tuple[str, ...], phone_field=None):
    """Scan only the authorized resource and bound matches, not candidate rows."""
    expected = normalize_search_text(query)
    if not expected:
        return queryset
    fields = (*text_fields, phone_field) if phone_field else text_fields
    digits = phone_digits(query)
    matches = []
    # Preserve queryset ordering so the same first matches are returned on each request.
    for record in queryset.only("pk", *fields).iterator(chunk_size=100):
        values = [normalize_search_text(getattr(record, field)) for field in text_fields]
        first_name, last_name = values[:2]
        values.extend((f"{first_name} {last_name}", f"{last_name} {first_name}"))
        text_match = any(expected in value for value in values)
        phone_match = (
            phone_field and digits and digits in phone_digits(getattr(record, phone_field))
        )
        if text_match or phone_match:
            matches.append(record.pk)
            if len(matches) == ENCRYPTED_PII_SEARCH_RESULT_LIMIT:
                break
    return queryset.filter(pk__in=matches)

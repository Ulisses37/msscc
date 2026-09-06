from rest_framework import serializers

from partners.models import Partner

# serializer allows for easier access to partner metadata
class PartnerSerializer(serializers.ModelSerializer):
    """Serializer for partner records."""

    class Meta:
        model = Partner
        fields = [
            "partner_id",
            "display_name_en",
            "display_name_ja",
            "category_en",
            "category_ja",
            "website_url",
            "contribution_amount",
            "is_visible",
            "display_order",
            "created_at",
            "updated_at",
            "media_asset",
        ]

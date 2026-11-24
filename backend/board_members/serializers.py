from rest_framework import serializers

from board_members.models import BoardMember
from media.models import StaticImage

PLACEHOLDER_STATIC_IMAGE_ID = 2


# serializer allows for easy access to board member metadata
class BoardMemberSerializer(serializers.ModelSerializer):
    """Serializer for board member records."""

    def create(self, validated_data: dict) -> BoardMember:
        """Assign the MSSCC placeholder image when a new member has no portrait."""
        if not validated_data.get("media_asset"):
            placeholder = (
                StaticImage.objects.select_related("media_asset")
                .filter(static_image_id=PLACEHOLDER_STATIC_IMAGE_ID)
                .first()
            )
            if placeholder and placeholder.media_asset_id:
                validated_data["media_asset"] = placeholder.media_asset

        return super().create(validated_data)

    class Meta:
        model = BoardMember
        fields = [
            "board_member_id",
            "display_name_en",
            "display_name_ja",
            "display_order",
            "external_link",
            "media_asset",
            "role_en",
            "role_ja",
            "start_date",
            "caption_en",
            "caption_ja",
        ]

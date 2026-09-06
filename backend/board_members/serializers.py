from rest_framework import serializers

from board_members.models import BoardMember

# serializer allows for easy access to board member metadata
class BoardMemberSerializer(serializers.ModelSerializer):
    """Serializer for board member records."""

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

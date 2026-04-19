from rest_framework import serializers

from board_members.models import BoardMember

# serializer allows for easy access to board member metadata
class BoardMemberSerializer(serializers.ModelSerializer):
    """Serializer for board member records."""

    class Meta:
        model = BoardMember
        fields = [
            "board_member_id",
            "display_name",
            "display_order",
            "external_link",
            "media_asset_id",
            "role",
            "start_date",
            "caption",
        ]

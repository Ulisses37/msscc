from rest_framework import generics

from board_members.models import BoardMember
from board_members.serializers import BoardMemberSerializer


class BoardMemberListView(generics.ListAPIView):
    """Return board member records as a JSON list."""

    queryset = BoardMember.objects.all().order_by("display_order", "board_member_id")
    serializer_class = BoardMemberSerializer

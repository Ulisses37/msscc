from rest_framework import generics

from board_members.models import BoardMember
from board_members.serializers import BoardMemberSerializer


class BoardMemberListView(generics.ListAPIView):
    """Return board member records as a JSON list."""

    queryset = BoardMember.objects.all().order_by("display_order", "board_member_id")
    serializer_class = BoardMemberSerializer


class BoardMemberDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update a single board member."""

    queryset = BoardMember.objects.all()
    serializer_class = BoardMemberSerializer
    lookup_field = "board_member_id"

class BoardMemberCreateView(generics.CreateAPIView):
    """Create a new board member."""
    queryset = BoardMember.objects.all()
    serializer_class = BoardMemberSerializer

class BoardMemberDeleteView(generics.DestroyAPIView):
    """Delete a single board member."""
    queryset = BoardMember.objects.all()
    serializer_class = BoardMemberSerializer
    lookup_field = "board_member_id"

class BoardMemberUpdateView(generics.UpdateAPIView):
    """Update a single board member."""
    queryset = BoardMember.objects.all()
    serializer_class = BoardMemberSerializer
    lookup_field = "board_member_id"

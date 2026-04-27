from django.urls import path

from board_members.views import (
    BoardMemberListView,
    BoardMemberDetailView,
    BoardMemberCreateView,
    BoardMemberDeleteView,
    BoardMemberUpdateView,
)

urlpatterns = [
    path("", BoardMemberListView.as_view(), name="board-member-list"),
    path("<int:board_member_id>/", BoardMemberDetailView.as_view(), name="board-member-detail"),
    path("create/", BoardMemberCreateView.as_view(), name="board-member-create"),
    path("<int:board_member_id>/delete/", BoardMemberDeleteView.as_view(), name="board-member-delete"),
    path("<int:board_member_id>/update/", BoardMemberUpdateView.as_view(), name="board-member-update"),
]

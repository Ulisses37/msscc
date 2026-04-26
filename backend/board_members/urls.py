from django.urls import path

from board_members.views import BoardMemberListView, BoardMemberDetailView

urlpatterns = [
    path("", BoardMemberListView.as_view(), name="board-member-list"),
    path("<int:board_member_id>/", BoardMemberDetailView.as_view(), name="board-member-detail"),
]

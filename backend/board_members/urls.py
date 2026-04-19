from django.urls import path

from board_members.views import BoardMemberListView

urlpatterns = [
    path("", BoardMemberListView.as_view(), name="board-member-list"),
]

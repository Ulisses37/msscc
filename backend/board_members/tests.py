from django.test import TestCase

from board_members.models import BoardMember


class BoardMemberCreateAPITests(TestCase):
    """Tests for creating board members through the admin-facing API."""

    def test_create_board_member_from_scratch(self):
        """A complete officer payload creates a record returned by the list endpoint."""
        payload = {
            "display_name_en": "Aiko Smith",
            "display_name_ja": "アイコ・スミス",
            "display_order": 3,
            "role_en": "President",
            "role_ja": "会長",
            "start_date": "2026-10-30",
            "caption_en": "Leads the organization.",
            "caption_ja": "組織を率いています。",
        }

        response = self.client.post(
            "/api/board-members/create/",
            payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        board_member = BoardMember.objects.get()
        self.assertEqual(board_member.display_name_en, "Aiko Smith")
        self.assertEqual(board_member.role_en, "President")

        list_response = self.client.get("/api/board-members/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json()[0]["board_member_id"], board_member.pk)

    def test_create_board_member_requires_english_name(self):
        """The create endpoint rejects a board member without an English name."""
        response = self.client.post(
            "/api/board-members/create/",
            {
                "display_order": 0,
                "role_en": "President",
                "start_date": "2026-10-30",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("display_name_en", response.json())
        self.assertEqual(BoardMember.objects.count(), 0)

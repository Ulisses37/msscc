# Run from the repository root with:
# backend\venv\Scripts\python.exe -m pytest -v backend/content/test_content_api.py

from django.test import TestCase
from rest_framework.test import APIClient

from content.models import Content
from media.models import MediaAsset
from page.models import Page


class ContentAPITests(TestCase):
    """Test the content API contract used by the admin page editor."""

    def setUp(self) -> None:
        self.client = APIClient()
        self.page = Page.objects.create(
            page_slug="home",
            page_title_en="Home",
            page_title_ja="ホーム",
        )
        self.media_asset = MediaAsset.objects.create(
            file_name="delegation.png",
            file="public/delegation.png",
            file_type="image/png",
            file_size=128,
        )

    def create_content(self, **overrides) -> Content:
        """Create a content record while allowing each test to vary relevant fields."""
        values = {
            "page_id": self.page,
            "display_order": 0,
            "content_type": "paragraph",
            "content_en": "English content",
            "content_ja": "日本語コンテンツ",
            "image_alignment": "left",
            "image_width": 100,
        }
        values.update(overrides)
        return Content.objects.create(**values)

    def test_get_content_for_page_returns_blocks_in_display_order(self) -> None:
        # Tests: GET /api/content/page/{page_id}/ and ordering used by the page editor.
        # Expected output: status 200 with complete bilingual records sorted by display_order.
        second_content = self.create_content(
            display_order=1,
            content_en="Second block",
            content_ja="2番目のブロック",
        )
        first_content = self.create_content(
            display_order=0,
            content_type="header",
            content_en="First block",
            content_ja="最初のブロック",
        )

        response = self.client.get(f"/api/content/page/{self.page.page_id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [block["content_id"] for block in response.data],
            [first_content.content_id, second_content.content_id],
        )
        self.assertEqual([block["display_order"] for block in response.data], [0, 1])
        self.assertEqual(response.data[0]["content_en"], "First block")
        self.assertEqual(response.data[0]["content_ja"], "最初のブロック")

    def test_get_content_for_page_returns_empty_list_when_page_has_no_blocks(self) -> None:
        # Tests: loading a valid page before any content has been added.
        # Expected output: status 200 with an empty list rather than an error or null value.
        response = self.client.get(f"/api/content/page/{self.page.page_id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_create_text_content_persists_page_editor_payload(self) -> None:
        # Tests: POST /api/content/create/ for a newly added non-image block.
        # Expected output: status 201 with a database ID and every editor payload field persisted.
        payload = {
            "page_id": self.page.page_id,
            "display_order": 2,
            "content_type": "subheader",
            "content_en": "Student Exchange",
            "content_ja": "学生交流",
            "media_asset": None,
            "image_alignment": "left",
            "image_width": 100,
        }

        response = self.client.post("/api/content/create/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        content = Content.objects.get(content_id=response.data["content_id"])
        self.assertEqual(content.page_id, self.page)
        self.assertEqual(content.display_order, 2)
        self.assertEqual(content.content_type, "subheader")
        self.assertEqual(content.content_en, "Student Exchange")
        self.assertEqual(content.content_ja, "学生交流")
        self.assertIsNone(content.media_asset)
        self.assertEqual(content.image_alignment, "left")
        self.assertEqual(content.image_width, 100)

    def test_create_image_content_persists_media_and_layout_fields(self) -> None:
        # Tests: POST /api/content/create/ for a new image after media upload succeeds.
        # Expected output: status 201 with the media asset, bilingual captions, alignment, and width
        # connected to the new content record.
        payload = {
            "page_id": self.page.page_id,
            "display_order": 3,
            "content_type": "image",
            "content_en": "Sister city delegation",
            "content_ja": "姉妹都市代表団",
            "media_asset": self.media_asset.pk,
            "image_alignment": "right",
            "image_width": 75,
        }

        response = self.client.post("/api/content/create/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        content = Content.objects.get(content_id=response.data["content_id"])
        self.assertEqual(content.media_asset, self.media_asset)
        self.assertEqual(content.content_en, "Sister city delegation")
        self.assertEqual(content.content_ja, "姉妹都市代表団")
        self.assertEqual(content.image_alignment, "right")
        self.assertEqual(content.image_width, 75)
        self.assertEqual(response.data["media_asset"], self.media_asset.pk)
        self.assertTrue(response.data["media_url"])

    def test_create_content_rejects_invalid_image_layout_values(self) -> None:
        # Tests: serializer validation for layout values that the page editor does not support.
        # Expected output: status 400 naming the invalid field, with no content record created.
        invalid_cases = (
            ({"image_alignment": "top"}, "image_alignment"),
            ({"image_width": 60}, "image_width"),
        )

        for invalid_value, expected_field in invalid_cases:
            with self.subTest(field=expected_field):
                payload = {
                    "page_id": self.page.page_id,
                    "display_order": 0,
                    "content_type": "image",
                    "content_en": "Caption",
                    "content_ja": "キャプション",
                    "media_asset": self.media_asset.pk,
                    "image_alignment": "left",
                    "image_width": 100,
                    **invalid_value,
                }

                response = self.client.post("/api/content/create/", payload, format="json")

                self.assertEqual(response.status_code, 400)
                self.assertIn(expected_field, response.data)

        self.assertEqual(Content.objects.count(), 0)

    def test_update_content_persists_bilingual_media_and_order_changes(self) -> None:
        # Tests: PATCH /api/content/update/{content_id}/ with the fields sent by handleSave.
        # Expected output: status 200 and the existing record updated without creating a duplicate.
        content = self.create_content(content_type="paragraph")
        payload = {
            "page_id": self.page.page_id,
            "display_order": 4,
            "content_type": "image",
            "content_en": "Updated English caption",
            "content_ja": "更新された日本語キャプション",
            "media_asset": self.media_asset.pk,
            "image_alignment": "center",
            "image_width": 50,
        }

        response = self.client.patch(
            f"/api/content/update/{content.content_id}/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        content.refresh_from_db()
        self.assertEqual(Content.objects.count(), 1)
        self.assertEqual(content.display_order, 4)
        self.assertEqual(content.content_type, "image")
        self.assertEqual(content.content_en, "Updated English caption")
        self.assertEqual(content.content_ja, "更新された日本語キャプション")
        self.assertEqual(content.media_asset, self.media_asset)
        self.assertEqual(content.image_alignment, "center")
        self.assertEqual(content.image_width, 50)

    def test_update_content_rejects_invalid_layout_without_changing_record(self) -> None:
        # Tests: PATCH validation when an unsupported image width is submitted.
        # Expected output: status 400 and the existing record retains its previous valid values.
        content = self.create_content(image_alignment="right", image_width=75)

        response = self.client.patch(
            f"/api/content/update/{content.content_id}/",
            {"image_alignment": "top", "image_width": 60},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("image_alignment", response.data)
        self.assertIn("image_width", response.data)
        content.refresh_from_db()
        self.assertEqual(content.image_alignment, "right")
        self.assertEqual(content.image_width, 75)

    def test_delete_content_removes_the_persisted_record(self) -> None:
        # Tests: DELETE /api/content/delete/{content_id}/ after editor deletion is confirmed.
        # Expected output: status 204 and the selected content no longer exists in the database.
        content = self.create_content()

        response = self.client.delete(f"/api/content/delete/{content.content_id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Content.objects.filter(content_id=content.content_id).exists())

    def test_delete_content_returns_404_for_an_unknown_content_id(self) -> None:
        # Tests: deleting a content ID that has already been removed or never existed.
        # Expected output: status 404 with a safe message and no database changes.
        existing_content = self.create_content()

        response = self.client.delete("/api/content/delete/999999/")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data, {"error": "Content not found"})
        self.assertTrue(
            Content.objects.filter(content_id=existing_content.content_id).exists()
        )

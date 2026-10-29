# Run from the repository root with:
# backend\venv\Scripts\python.exe -m pytest backend/page/test_page_api.py

from django.test import TestCase
from rest_framework.test import APIClient

from content.models import Content
from page.models import Page


class PageAPITests(TestCase):
    """Test the page records consumed by the editor and public content pages."""

    def setUp(self) -> None:
        self.client = APIClient()
        self.home_page = Page.objects.create(
            page_slug="home",
            page_title_en="Home",
            page_title_ja="ホーム",
        )
        self.about_page = Page.objects.create(
            page_slug="about",
            page_title_en="About",
            page_title_ja="当団体について",
        )

    def test_get_all_pages_returns_ordered_bilingual_page_records(self) -> None:
        # Tests: GET /api/page/get-all/ and the page metadata used by the editor dropdown.
        # Expected output: status 200 with pages in model order and both language titles intact.
        response = self.client.get("/api/page/get-all/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [page["page_id"] for page in response.data],
            [self.home_page.page_id, self.about_page.page_id],
        )
        self.assertEqual(response.data[0]["page_slug"], "home")
        self.assertEqual(response.data[0]["page_title_en"], "Home")
        self.assertEqual(response.data[0]["page_title_ja"], "ホーム")
        self.assertEqual(response.data[1]["page_slug"], "about")
        self.assertEqual(response.data[1]["page_title_en"], "About")
        self.assertEqual(response.data[1]["page_title_ja"], "当団体について")

    def test_get_page_returns_the_requested_page_and_its_content(self) -> None:
        # Tests: GET /api/page/get/{page_id}/ and the nested content serializer contract.
        # Expected output: status 200 with the requested bilingual page and its content block.
        content = Content.objects.create(
            page_id=self.home_page,
            display_order=0,
            content_type="header",
            content_en="Welcome to MSSCC",
            content_ja="MSSCCへようこそ",
        )

        response = self.client.get(f"/api/page/get/{self.home_page.page_id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["page_id"], self.home_page.page_id)
        self.assertEqual(response.data["page_title_en"], "Home")
        self.assertEqual(response.data["page_title_ja"], "ホーム")
        self.assertEqual(len(response.data["content"]), 1)
        self.assertEqual(response.data["content"][0]["content_id"], content.content_id)
        self.assertEqual(response.data["content"][0]["content_en"], "Welcome to MSSCC")
        self.assertEqual(response.data["content"][0]["content_ja"], "MSSCCへようこそ")

    def test_get_page_by_slug_orders_content_for_public_rendering(self) -> None:
        # Tests: GET /api/page/get-by-slug/{slug}/ and explicit display_order sorting.
        # Expected output: status 200 with lower display_order content returned first, regardless of
        # the order in which the database records were created.
        second_content = Content.objects.create(
            page_id=self.about_page,
            display_order=1,
            content_type="paragraph",
            content_en="Second block",
            content_ja="2番目のブロック",
        )
        first_content = Content.objects.create(
            page_id=self.about_page,
            display_order=0,
            content_type="header",
            content_en="First block",
            content_ja="最初のブロック",
        )

        response = self.client.get("/api/page/get-by-slug/about/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["page_id"], self.about_page.page_id)
        self.assertEqual(
            [block["content_id"] for block in response.data["content"]],
            [first_content.content_id, second_content.content_id],
        )
        self.assertEqual(
            [block["display_order"] for block in response.data["content"]],
            [0, 1],
        )

    def test_get_page_returns_404_for_an_unknown_page_id(self) -> None:
        # Tests: requesting a page ID that does not exist.
        # Expected output: status 404 with the API's safe not-found response.
        response = self.client.get("/api/page/get/999999/")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data, {"detail": "Not found."})

    def test_get_page_by_slug_returns_404_for_an_unknown_slug(self) -> None:
        # Tests: requesting a page slug that does not exist.
        # Expected output: status 404 with the API's safe not-found response.
        response = self.client.get("/api/page/get-by-slug/missing-page/")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data, {"detail": "Not found."})

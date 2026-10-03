from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from events.models import Event, EventImage
from events.serializers import EventImageSerializer
from media.models import MediaAsset


TEST_STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.InMemoryStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}


@override_settings(STORAGES=TEST_STORAGES)
class TestEventImageApi(APITestCase):
    """Test additional event-image persistence and API behavior."""

    def setUp(self) -> None:
        """Create events and reusable media assets for each test."""
        start_datetime = timezone.now() + timedelta(days=1)
        end_datetime = start_datetime + timedelta(hours=2)
        self.event = Event.objects.create(
            title_en="Community Festival",
            title_ja="コミュニティ祭り",
            start_datetime=start_datetime,
            end_datetime=end_datetime,
        )
        self.other_event = Event.objects.create(
            title_en="Exchange Dinner",
            start_datetime=start_datetime,
            end_datetime=end_datetime,
        )
        self.media_asset = MediaAsset.objects.create(
            file_name="festival.jpg",
            file=SimpleUploadedFile(
                "festival.jpg",
                b"event-image-content",
                content_type="image/jpeg",
            ),
            file_type="image/jpeg",
        )

    def test_serializer_exposes_media_url_and_bilingual_captions(self) -> None:
        """The serializer includes captions and a directly usable media URL."""
        event_image = EventImage.objects.create(
            event=self.event,
            media_asset=self.media_asset,
            caption_en="<strong>Festival guests</strong>",
            caption_ja="<em>祭りの参加者</em>",
        )

        data = EventImageSerializer(event_image).data

        self.assertEqual(data["caption_en"], "<strong>Festival guests</strong>")
        self.assertEqual(data["caption_ja"], "<em>祭りの参加者</em>")
        self.assertIn("festival", data["media_url"])

    def test_list_filters_images_by_event_in_display_order(self) -> None:
        """The list endpoint returns only the requested event's ordered images."""
        later_image = EventImage.objects.create(
            event=self.event,
            media_asset=self.media_asset,
            display_order=2,
        )
        earlier_image = EventImage.objects.create(
            event=self.event,
            media_asset=self.media_asset,
            display_order=1,
        )
        EventImage.objects.create(
            event=self.other_event,
            media_asset=self.media_asset,
            display_order=0,
        )

        response = self.client.get(
            reverse("event-image-list"),
            {"event_id": self.event.event_id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["event_image_id"] for item in response.data],
            [earlier_image.event_image_id, later_image.event_image_id],
        )

    def test_create_and_update_image_layout(self) -> None:
        """The API persists supported width, alignment, order, and caption values."""
        create_response = self.client.post(
            reverse("event-image-list"),
            {
                "event": self.event.event_id,
                "media_asset": self.media_asset.pk,
                "caption_en": "Event volunteers",
                "caption_ja": "イベントボランティア",
                "display_order": 3,
                "image_width": 75,
                "image_alignment": "center",
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        event_image_id = create_response.data["event_image_id"]

        update_response = self.client.patch(
            reverse("event-image-detail", args=[event_image_id]),
            {
                "image_width": 50,
                "image_alignment": "right",
                "display_order": 1,
            },
            format="json",
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        event_image = EventImage.objects.get(event_image_id=event_image_id)
        self.assertEqual(event_image.image_width, 50)
        self.assertEqual(event_image.image_alignment, "right")
        self.assertEqual(event_image.display_order, 1)

    def test_delete_removes_association_but_preserves_media_asset(self) -> None:
        """Deleting an event image leaves its reusable media asset intact."""
        event_image = EventImage.objects.create(
            event=self.event,
            media_asset=self.media_asset,
        )

        response = self.client.delete(
            reverse("event-image-detail", args=[event_image.event_image_id]),
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            EventImage.objects.filter(
                event_image_id=event_image.event_image_id,
            ).exists(),
        )
        self.assertTrue(MediaAsset.objects.filter(pk=self.media_asset.pk).exists())

    def test_serializer_rejects_unsupported_layout_values(self) -> None:
        """Unsupported width and alignment values fail serializer validation."""
        serializer = EventImageSerializer(
            data={
                "event": self.event.event_id,
                "media_asset": self.media_asset.pk,
                "image_width": 60,
                "image_alignment": "top",
            },
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("image_width", serializer.errors)
        self.assertIn("image_alignment", serializer.errors)

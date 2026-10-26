from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import transaction
from django.template.loader import render_to_string
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from events import services
from events.models import Event, VolunteerSignup, VolunteerSlot

User = get_user_model()


class EventListAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="admin@example.com",
            password="TestPass123!",
            first_name="Admin",
            last_name="User",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_get_list_returns_empty_on_no_events(self):
        response = self.client.get("/api/events/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_post_event_requires_title_en(self):
        response = self.client.post(
            "/api/events/",
            {
                "title_ja": "タイトル",
                "start_datetime": "2026-12-25T10:00:00Z",
                "end_datetime": "2026-12-25T12:00:00Z",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_post_event_requires_start_datetime(self):
        response = self.client.post(
            "/api/events/",
            {
                "title_en": "Event",
                "title_ja": "イベント",
                "end_datetime": "2026-12-25T12:00:00Z",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_post_create_event_succeeds(self):
        response = self.client.post(
            "/api/events/",
            {
                "title_en": "Cultural Exchange",
                "title_ja": "文化交流",
                "start_datetime": "2026-12-25T10:00:00Z",
                "end_datetime": "2026-12-25T12:00:00Z",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Event.objects.count(), 1)
        event = Event.objects.first()
        self.assertEqual(event.title_en, "Cultural Exchange")
        self.assertEqual(event.title_ja, "文化交流")
        self.assertFalse(event.is_published)


@override_settings(FRONTEND_URL="https://example.test")
class VolunteerSignupEmailTests(TestCase):
    """Verify volunteer signup confirmation emails include cancellation links."""

    def setUp(self):
        self.client = APIClient()
        self.event = Event.objects.create(
            title_en="Cultural Exchange",
            title_ja="文化交流",
            start_datetime=datetime(2026, 12, 25, 10, 0, tzinfo=UTC),
            end_datetime=datetime(2026, 12, 25, 12, 0, tzinfo=UTC),
        )
        self.slot = VolunteerSlot.objects.create(
            event=self.event,
            position_name="Greeter",
            start_datetime=datetime(2026, 12, 25, 10, 0, tzinfo=UTC),
            end_datetime=datetime(2026, 12, 25, 12, 0, tzinfo=UTC),
        )

    @patch("events.views.send_volunteer_thanks_email")
    def test_successful_signup_sends_confirmation_email(self, mock_send_email):
        response = self.client.post(
            "/api/events/signups/",
            {
                "slot_id": self.slot.volunteer_slot_id,
                "first_name": "Aiko",
                "last_name": "Tanaka",
                "email": "aiko@example.com",
                "phone": "916-555-0100",
                "status": "pending",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        signup = VolunteerSignup.objects.get()
        mock_send_email.assert_called_once_with(signup)
        self.assertIsNotNone(signup.cancellation_token)
        self.assertEqual(signup.status, "approved")
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.filled_count, 1)

    @patch("emails.messages.send_email")
    def test_confirmation_email_includes_unique_cancellation_url(self, mock_send_email):
        signup = VolunteerSignup.objects.create(
            slot=self.slot,
            first_name="Aiko",
            last_name="Tanaka",
            email="aiko@example.com",
            phone="916-555-0100",
        )

        from emails.messages import send_volunteer_thanks_email

        send_volunteer_thanks_email(signup)

        expected_url = f"https://example.test/en/volunteer/cancel/{signup.cancellation_token}"
        mock_send_email.assert_called_once()
        template_name = mock_send_email.call_args.kwargs["template_name"]
        context = mock_send_email.call_args.kwargs["context"]

        self.assertEqual(context["cancellation_url"], expected_url)
        rendered_email = render_to_string(template_name, context)
        self.assertIn("Cancel volunteer shift", rendered_email)
        self.assertIn(expected_url, rendered_email)

    def test_new_signups_receive_distinct_cancellation_tokens(self):
        first_signup = VolunteerSignup.objects.create(
            slot=self.slot,
            first_name="Aiko",
            last_name="Tanaka",
            email="aiko@example.com",
            phone="916-555-0100",
        )
        second_signup = VolunteerSignup.objects.create(
            slot=self.slot,
            first_name="Kenji",
            last_name="Sato",
            email="kenji@example.com",
            phone="916-555-0101",
        )

        self.assertNotEqual(first_signup.cancellation_token, second_signup.cancellation_token)

    @patch("events.views.send_volunteer_thanks_email")
    def test_invalid_signup_does_not_send_confirmation_email(self, mock_send_email):
        response = self.client.post(
            "/api/events/signups/",
            {
                "slot_id": self.slot.volunteer_slot_id,
                "first_name": "Aiko",
                "last_name": "Tanaka",
                "email": "not-an-email",
                "phone": "916-555-0100",
                "status": "pending",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        mock_send_email.assert_not_called()


class VolunteerCancellationLookupTests(TestCase):
    """Verify public cancellation-link lookup behavior."""

    def create_signup(self, start_datetime, **overrides):
        event = Event.objects.create(
            title_en="Cultural Exchange",
            title_ja="文化交流",
            start_datetime=start_datetime,
            end_datetime=start_datetime + timedelta(hours=2),
        )
        slot = VolunteerSlot.objects.create(
            event=event,
            position_name="Greeter",
            start_datetime=start_datetime,
            end_datetime=start_datetime + timedelta(hours=2),
        )
        signup_data = {
            "slot": slot,
            "first_name": "Aiko",
            "last_name": "Tanaka",
            "email": "aiko@example.com",
            "phone": "916-555-0100",
            **overrides,
        }
        return VolunteerSignup.objects.create(**signup_data)

    def test_valid_token_returns_public_signup_details(self):
        signup = self.create_signup(datetime.now(UTC) + timedelta(days=1))

        response = self.client.get(f"/api/events/signups/cancel/{signup.cancellation_token}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "first_name": "Aiko",
                "last_name": "Tanaka",
                "event_title_en": "Cultural Exchange",
                "event_title_ja": "文化交流",
                "slot_start_datetime": (
                    signup.slot.start_datetime.isoformat().replace("+00:00", "Z")
                ),
                "slot_end_datetime": signup.slot.end_datetime.isoformat().replace("+00:00", "Z"),
                "role": "Greeter",
            },
        )
        signup.refresh_from_db()
        self.assertEqual(signup.status, "approved")

    def test_unknown_token_returns_not_found(self):
        token = "00000000-0000-0000-0000-000000000000"

        response = self.client.get(f"/api/events/signups/cancel/{token}/")

        self.assertEqual(response.status_code, 404)

    def test_expired_token_returns_not_found(self):
        signup = self.create_signup(datetime.now(UTC) - timedelta(minutes=1))

        response = self.client.get(f"/api/events/signups/cancel/{signup.cancellation_token}/")

        self.assertEqual(response.status_code, 404)

    def test_valid_token_deletes_only_matching_signup(self):
        signup = self.create_signup(datetime.now(UTC) + timedelta(days=1))
        other_signup = self.create_signup(
            datetime.now(UTC) + timedelta(days=2),
            email="kenji@example.com",
        )

        response = self.client.delete(f"/api/events/signups/cancel/{signup.cancellation_token}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(VolunteerSignup.objects.filter(pk=signup.pk).exists())
        self.assertTrue(VolunteerSignup.objects.filter(pk=other_signup.pk).exists())

    def test_cancellation_frees_a_previously_full_slot(self):
        signup = self.create_signup(datetime.now(UTC) + timedelta(days=1))
        slot = signup.slot
        slot.capacity = 1
        slot.save(update_fields=["capacity"])
        slot.refresh_from_db()

        self.assertEqual(slot.filled_count, slot.capacity)

        response = self.client.delete(f"/api/events/signups/cancel/{signup.cancellation_token}/")

        self.assertEqual(response.status_code, 204)
        slot.refresh_from_db()
        self.assertEqual(slot.filled_count, 0)
        self.assertLess(slot.filled_count, slot.capacity)

    def test_invalid_token_does_not_delete_any_signup(self):
        signup = self.create_signup(datetime.now(UTC) + timedelta(days=1))
        token = "00000000-0000-0000-0000-000000000000"

        response = self.client.delete(f"/api/events/signups/cancel/{token}/")

        self.assertEqual(response.status_code, 404)
        self.assertTrue(VolunteerSignup.objects.filter(pk=signup.pk).exists())

    def test_expired_token_does_not_delete_signup(self):
        signup = self.create_signup(datetime.now(UTC) - timedelta(minutes=1))

        response = self.client.delete(f"/api/events/signups/cancel/{signup.cancellation_token}/")

        self.assertEqual(response.status_code, 404)
        self.assertTrue(VolunteerSignup.objects.filter(pk=signup.pk).exists())

    def test_repeated_cancellation_does_not_reduce_filled_count_below_zero(self):
        signup = self.create_signup(datetime.now(UTC) + timedelta(days=1))
        slot = signup.slot
        cancellation_url = f"/api/events/signups/cancel/{signup.cancellation_token}/"

        first_response = self.client.delete(cancellation_url)
        second_response = self.client.delete(cancellation_url)

        self.assertEqual(first_response.status_code, 204)
        self.assertEqual(second_response.status_code, 404)
        slot.refresh_from_db()
        self.assertEqual(slot.filled_count, 0)


class VolunteerChangeDetectionTests(TestCase):
    """Only shift removal, movement and role changes reach the buffer.

    Delivery is wired in a later subtask, so these tests inspect the coalesced
    buffer instead of an outbound email.
    """

    def setUp(self):
        # The buffer is per thread and survives between saves by design, so each
        # test starts from an empty one.
        services.take_pending_changes()
        self.event = self.create_event()
        self.slot = self.create_slot(self.event)
        self.signup = self.create_signup(self.slot)

    def create_event(self, **overrides):
        data = {
            "title_en": "Cultural Exchange",
            "title_ja": "文化交流",
            "location_en": "Community Center",
            "start_datetime": datetime(2026, 12, 25, 10, 0, tzinfo=UTC),
            "end_datetime": datetime(2026, 12, 25, 12, 0, tzinfo=UTC),
        }
        data.update(overrides)
        return Event.objects.create(**data)

    def create_slot(self, event, **overrides):
        data = {
            "event": event,
            "position_name": "Greeter",
            "start_datetime": event.start_datetime,
            "end_datetime": event.end_datetime,
        }
        data.update(overrides)
        return VolunteerSlot.objects.create(**data)

    def create_signup(self, slot, **overrides):
        data = {
            "slot": slot,
            "first_name": "Aiko",
            "last_name": "Tanaka",
            "email": "aiko@example.test",
            "phone": "916-555-0100",
        }
        data.update(overrides)
        return VolunteerSignup.objects.create(**data)

    def pending_for(self, signup, event):
        """Return the buffered change kinds for one (volunteer, event) pair."""
        return services.take_pending_changes().get(
            (signup.volunteer_signup_id, event.event_id),
            {},
        )

    def test_creating_a_slot_and_signup_notifies_nobody(self):
        self.assertEqual(services.take_pending_changes(), {})

        self.create_signup(self.slot, email="kenji@example.test")

        self.assertEqual(services.take_pending_changes(), {})

    def test_slot_capacity_change_is_not_collected(self):
        self.slot.capacity = 4
        self.slot.save()

        self.assertEqual(services.take_pending_changes(), {})

    def test_slot_description_change_is_not_collected(self):
        self.slot.description = "Bring a jacket."
        self.slot.save()

        self.assertEqual(services.take_pending_changes(), {})

    def test_plain_resave_of_a_slot_is_not_collected(self):
        self.slot.save()

        self.assertEqual(services.take_pending_changes(), {})

    def test_event_bookkeeping_save_is_not_collected(self):
        # update_event_volunteer_slots re-saves the event this way on every slot
        # edit, so it must never look like an event change worth notifying about.
        self.event.volunteer_slots = 3
        self.event.save(update_fields=["volunteer_slots"])

        self.assertEqual(services.take_pending_changes(), {})

    def test_event_publish_change_is_not_collected(self):
        self.event.is_published = True
        self.event.save(update_fields=["is_published", "updated_at"])

        self.assertEqual(services.take_pending_changes(), {})

    def test_signup_deletion_collects_nothing(self):
        # A volunteer cancelling their own signup does not need to hear about it.
        self.signup.delete()

        self.assertEqual(services.take_pending_changes(), {})

    def test_slot_deletion_is_collected_as_a_removal(self):
        slot_id = self.slot.volunteer_slot_id

        self.slot.delete()

        details = self.pending_for(self.signup, self.event)[services.REMOVED]

        self.assertEqual(details["email"], "aiko@example.test")
        self.assertEqual(details["first_name"], "Aiko")
        self.assertEqual(details["event_name"], "Cultural Exchange")
        self.assertEqual(details["role"], "Greeter")
        self.assertEqual(details["slot_id"], slot_id)

    def test_slot_deletion_without_signups_collects_nothing(self):
        empty_slot = self.create_slot(self.event, position_name="Usher")
        services.take_pending_changes()

        empty_slot.delete()

        self.assertEqual(services.take_pending_changes(), {})

    def test_slot_time_change_is_collected_as_a_move(self):
        self.slot.start_datetime = datetime(2026, 12, 25, 14, 0, tzinfo=UTC)
        self.slot.end_datetime = datetime(2026, 12, 25, 16, 0, tzinfo=UTC)
        self.slot.save()

        details = self.pending_for(self.signup, self.event)[services.MOVED]

        self.assertEqual(details["new_start_datetime"], self.slot.start_datetime)
        self.assertEqual(details["new_end_datetime"], self.slot.end_datetime)
        self.assertEqual(details["new_location"], "Community Center")

    def test_slot_role_change_is_collected_as_a_role_change(self):
        self.slot.position_name = "Ticket Table"
        self.slot.save()

        details = self.pending_for(self.signup, self.event)[services.ROLE_CHANGED]

        self.assertEqual(details["new_role"], "Ticket Table")
        self.assertEqual(details["old_role"], "Greeter")

    def test_event_location_change_is_collected_as_a_move(self):
        self.event.location_en = "Memorial Auditorium"
        self.event.save(update_fields=["location_en", "updated_at"])

        details = self.pending_for(self.signup, self.event)[services.MOVED]

        self.assertEqual(details["new_location"], "Memorial Auditorium")

    def test_event_time_change_is_collected_as_a_move(self):
        self.event.start_datetime = datetime(2026, 12, 26, 10, 0, tzinfo=UTC)
        self.event.save(update_fields=["start_datetime", "updated_at"])

        details = self.pending_for(self.signup, self.event)[services.MOVED]

        self.assertEqual(details["new_start_datetime"], self.event.start_datetime)

    def test_several_changes_in_one_save_coalesce_into_one_entry(self):
        self.slot.start_datetime = datetime(2026, 12, 25, 14, 0, tzinfo=UTC)
        self.slot.end_datetime = datetime(2026, 12, 25, 16, 0, tzinfo=UTC)
        self.slot.position_name = "Ticket Table"
        self.slot.save()

        pending = services.take_pending_changes()

        self.assertEqual(len(pending), 1)
        details_by_kind = pending[(self.signup.volunteer_signup_id, self.event.event_id)]
        self.assertEqual(
            set(details_by_kind),
            {services.MOVED, services.ROLE_CHANGED},
        )

    def test_repeated_edits_keep_only_the_final_values(self):
        self.slot.position_name = "Ticket Table"
        self.slot.save()
        self.slot.position_name = "Greeter"
        self.slot.save()

        pending = services.take_pending_changes()

        self.assertEqual(len(pending), 1)
        details_by_kind = pending[(self.signup.volunteer_signup_id, self.event.event_id)]
        self.assertEqual(details_by_kind[services.ROLE_CHANGED]["new_role"], "Greeter")

    def test_every_signup_on_the_slot_is_collected_separately(self):
        kenji = self.create_signup(self.slot, email="kenji@example.test")

        self.slot.position_name = "Ticket Table"
        self.slot.save()

        pending = services.take_pending_changes()

        self.assertEqual(
            set(pending),
            {
                (self.signup.volunteer_signup_id, self.event.event_id),
                (kenji.volunteer_signup_id, self.event.event_id),
            },
        )

    def test_signup_moved_to_a_later_slot_is_collected_as_a_move(self):
        later_slot = self.create_slot(
            self.event,
            position_name="Ticket Table",
            start_datetime=datetime(2026, 12, 25, 14, 0, tzinfo=UTC),
            end_datetime=datetime(2026, 12, 25, 16, 0, tzinfo=UTC),
        )
        self.signup.slot = later_slot
        self.signup.save()

        details = self.pending_for(self.signup, self.event)

        self.assertIn(services.MOVED, details)
        self.assertNotIn(services.REMOVED, details)
        self.assertEqual(details[services.MOVED]["new_start_datetime"], later_slot.start_datetime)

    def test_signup_moved_to_an_identical_shift_is_not_collected(self):
        # Same date and time, so the volunteer has nothing new to know.
        identical_slot = self.create_slot(self.event, position_name="Ticket Table")
        self.signup.slot = identical_slot
        self.signup.save()

        self.assertEqual(services.take_pending_changes(), {})


class VolunteerChangeSnapshotTests(TestCase):
    """Snapshots are plain values and are only read when they can matter."""

    def setUp(self):
        services.take_pending_changes()
        self.event = Event.objects.create(
            title_en="Cultural Exchange",
            title_ja="文化交流",
            location_en="Community Center",
            start_datetime=datetime(2026, 12, 25, 10, 0, tzinfo=UTC),
            end_datetime=datetime(2026, 12, 25, 12, 0, tzinfo=UTC),
        )
        self.slot = VolunteerSlot.objects.create(
            event=self.event,
            position_name="Greeter",
            start_datetime=self.event.start_datetime,
            end_datetime=self.event.end_datetime,
        )
        self.signup = VolunteerSignup.objects.create(
            slot=self.slot,
            first_name="Aiko",
            last_name="Tanaka",
            email="aiko@example.test",
            phone="916-555-0100",
        )

    def test_removal_snapshot_holds_plain_values_only(self):
        signups, event = services.capture_slot_removal(self.slot)

        # Nothing in the snapshot may be a model instance: the cascade deletes the
        # rows before the removal is recorded.
        self.assertEqual(event, {"event_id": self.event.event_id, "title_en": "Cultural Exchange"})
        self.assertEqual(len(signups), 1)
        self.assertEqual(
            set(signups[0]),
            {
                "volunteer_signup_id",
                "first_name",
                "email",
                "slot_id",
                "position_name",
                "start_datetime",
                "end_datetime",
            },
        )
        self.assertIsInstance(signups[0]["start_datetime"], datetime)
        self.assertEqual(signups[0]["volunteer_signup_id"], self.signup.volunteer_signup_id)

    def test_snapshot_skips_the_query_when_update_fields_cannot_matter(self):
        before = services.snapshot(
            self.slot,
            services.SLOT_TRACKED_FIELDS,
            update_fields=["filled_count"],
        )

        # None means "unknown, so do not compare", which is how a filled-count
        # recount avoids both the query and a false positive.
        self.assertIsNone(before)

    def test_snapshot_reads_the_stored_values_for_a_new_instance(self):
        self.assertEqual(
            services.snapshot(self.slot, services.SLOT_TRACKED_FIELDS),
            {
                "start_datetime": self.slot.start_datetime,
                "end_datetime": self.slot.end_datetime,
                "position_name": "Greeter",
            },
        )

    def test_snapshot_of_an_unsaved_instance_is_empty(self):
        self.assertEqual(
            services.snapshot(VolunteerSlot(event=self.event), services.SLOT_TRACKED_FIELDS),
            {},
        )

    def test_filled_count_recount_does_not_reach_the_buffer(self):
        # The signal helpers re-save the slot with update_fields, and those saves
        # must stay invisible to volunteers.
        self.assertEqual(self.slot.filled_count, 1)

        services.take_pending_changes()
        self.slot.save(update_fields=["filled_count"])

        self.assertEqual(services.take_pending_changes(), {})


class VolunteerDeleteCascadeTests(TestCase):
    """Deleting a shift that has signups must not fail on its own bookkeeping.

    Regression coverage: the filled-count recount used to resolve the cached
    foreign key of an already-deleted slot and raise DoesNotExist, which aborted
    the delete.
    """

    def setUp(self):
        services.take_pending_changes()
        self.event = Event.objects.create(
            title_en="Cultural Exchange",
            title_ja="文化交流",
            location_en="Community Center",
            start_datetime=datetime(2026, 12, 25, 10, 0, tzinfo=UTC),
            end_datetime=datetime(2026, 12, 25, 12, 0, tzinfo=UTC),
        )
        self.slot = VolunteerSlot.objects.create(
            event=self.event,
            position_name="Greeter",
            start_datetime=self.event.start_datetime,
            end_datetime=self.event.end_datetime,
        )
        VolunteerSignup.objects.create(
            slot=self.slot,
            first_name="Aiko",
            last_name="Tanaka",
            email="aiko@example.test",
            phone="916-555-0100",
        )

    def test_deleting_a_slot_with_signups_succeeds(self):
        self.slot.delete()

        self.assertEqual(VolunteerSlot.objects.count(), 0)
        self.assertEqual(VolunteerSignup.objects.count(), 0)
        self.assertTrue(Event.objects.filter(pk=self.event.pk).exists())

    def test_deleting_a_slot_recounts_its_event(self):
        self.assertEqual(self.event.volunteer_slots, 1)
        self.slot.delete()

        self.event.refresh_from_db()
        self.assertEqual(self.event.volunteer_slots, 0)

    def test_deleting_an_event_cascades_through_slots_and_signups(self):
        # Deleting the event removes its slots and their signups, and the slot
        # bookkeeping must survive having no event left to recount.
        self.event.delete()

        self.assertEqual(Event.objects.count(), 0)
        self.assertEqual(VolunteerSlot.objects.count(), 0)
        self.assertEqual(VolunteerSignup.objects.count(), 0)

    def test_cancelling_one_signup_still_recounts_the_slot(self):
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.filled_count, 1)

        VolunteerSignup.objects.get().delete()

        self.slot.refresh_from_db()
        self.assertEqual(self.slot.filled_count, 0)
        self.assertEqual(VolunteerSlot.objects.count(), 1)


class VolunteerChangeNotificationTests(TestCase):
    """Surviving changes are delivered once, and a provider outage is contained.

    The provider is mocked throughout: the sandbox only delivers to the account
    owner, so no test may attempt a live send.
    """

    def setUp(self):
        services.take_pending_changes()
        self.event = Event.objects.create(
            title_en="Cultural Exchange",
            title_ja="文化交流",
            location_en="Community Center",
            start_datetime=datetime(2026, 12, 25, 10, 0, tzinfo=UTC),
            end_datetime=datetime(2026, 12, 25, 12, 0, tzinfo=UTC),
        )
        self.slot = VolunteerSlot.objects.create(
            event=self.event,
            position_name="Greeter",
            start_datetime=self.event.start_datetime,
            end_datetime=self.event.end_datetime,
        )
        self.signup = VolunteerSignup.objects.create(
            slot=self.slot,
            first_name="Aiko",
            last_name="Tanaka",
            email="aiko@example.test",
            phone="916-555-0100",
        )

    def commit(self):
        """Run the callbacks the transaction registered, as a commit would."""
        with self.captureOnCommitCallbacks(execute=True):
            pass

    def patch_provider(self):
        return patch("emails.services.get_provider")

    def sent_subjects(self, provider_mock):
        return [
            call.kwargs["subject"]
            for call in provider_mock.return_value.send_email.call_args_list
        ]

    def test_a_removal_sends_one_email_through_the_provider(self):
        with self.patch_provider() as provider:
            with self.captureOnCommitCallbacks(execute=True):
                self.slot.delete()

        sent = provider.return_value.send_email.call_args_list
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0].kwargs["to"], "aiko@example.test")
        self.assertIn("Cancelled", sent[0].kwargs["subject"])
        self.assertIn("Cultural Exchange", sent[0].kwargs["html"])

    def test_a_move_sends_one_email(self):
        with self.patch_provider() as provider:
            with self.captureOnCommitCallbacks(execute=True):
                self.slot.start_datetime = datetime(2026, 12, 25, 14, 0, tzinfo=UTC)
                self.slot.save()

        sent = provider.return_value.send_email.call_args_list
        self.assertEqual(len(sent), 1)
        self.assertIn("Changed", sent[0].kwargs["subject"])
        self.assertIn("02:00 PM", sent[0].kwargs["html"])
        self.assertIn("Community Center", sent[0].kwargs["html"])

    def test_a_role_change_sends_one_email(self):
        with self.patch_provider() as provider:
            with self.captureOnCommitCallbacks(execute=True):
                self.slot.position_name = "Ticket Table"
                self.slot.save()

        sent = provider.return_value.send_email.call_args_list
        self.assertEqual(len(sent), 1)
        self.assertIn("Role Changed", sent[0].kwargs["subject"])
        self.assertIn("Ticket Table", sent[0].kwargs["html"])

    def test_two_changes_in_one_save_send_one_email(self):
        with self.patch_provider() as provider:
            with self.captureOnCommitCallbacks(execute=True):
                self.slot.position_name = "Ticket Table"
                self.slot.start_datetime = datetime(2026, 12, 25, 14, 0, tzinfo=UTC)
                self.slot.end_datetime = datetime(2026, 12, 25, 16, 0, tzinfo=UTC)
                self.slot.save()

        sent = provider.return_value.send_email.call_args_list
        self.assertEqual(len(sent), 1)

    def test_two_volunteers_each_get_their_own_email(self):
        VolunteerSignup.objects.create(
            slot=self.slot,
            first_name="Kenji",
            last_name="Sato",
            email="kenji@example.test",
            phone="916-555-0101",
        )

        with self.patch_provider() as provider:
            with self.captureOnCommitCallbacks(execute=True):
                self.slot.position_name = "Ticket Table"
                self.slot.save()

        recipients = sorted(
            call.kwargs["to"] for call in provider.return_value.send_email.call_args_list
        )
        self.assertEqual(recipients, ["aiko@example.test", "kenji@example.test"])

    def test_a_plain_resave_does_not_resend(self):
        with self.patch_provider() as provider:
            with self.captureOnCommitCallbacks(execute=True):
                self.slot.position_name = "Ticket Table"
                self.slot.save()

            self.assertEqual(len(provider.return_value.send_email.call_args_list), 1)

            with self.captureOnCommitCallbacks(execute=True):
                self.slot.save()

        # Nothing changed the second time, so nothing should be sent.
        self.assertEqual(len(provider.return_value.send_email.call_args_list), 1)

    def test_two_separate_saves_send_two_emails(self):
        with self.patch_provider() as provider:
            with self.captureOnCommitCallbacks(execute=True):
                self.slot.position_name = "Ticket Table"
                self.slot.save()

            with self.captureOnCommitCallbacks(execute=True):
                self.slot.start_datetime = datetime(2026, 12, 25, 14, 0, tzinfo=UTC)
                self.slot.save()

        # No time window exists, so two separate saves are two separate emails.
        self.assertEqual(len(provider.return_value.send_email.call_args_list), 2)

    def test_provider_failure_does_not_break_the_edit(self):
        with self.patch_provider() as provider:
            provider.return_value.send_email.side_effect = Exception("provider down")

            with self.captureOnCommitCallbacks(execute=True):
                self.slot.position_name = "Ticket Table"
                self.slot.save()

        # The edit must have stuck even though the email could not be sent.
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.position_name, "Ticket Table")

    def test_provider_failure_is_logged(self):
        with self.patch_provider() as provider:
            provider.return_value.send_email.side_effect = Exception("provider down")

            with self.assertLogs("emails.services", level="ERROR") as logs:
                with self.captureOnCommitCallbacks(execute=True):
                    self.slot.position_name = "Ticket Table"
                    self.slot.save()

        # emails.services already contains the failure, so the log comes from
        # there. What matters is that it is recorded rather than raised.
        self.assertTrue(any("failed" in line.lower() for line in logs.output))

    def test_a_misconfigured_provider_does_not_break_the_edit(self):
        with override_settings(EMAIL_PROVIDER="does-not-exist"):
            with self.captureOnCommitCallbacks(execute=True):
                self.slot.position_name = "Ticket Table"
                self.slot.save()

        self.slot.refresh_from_db()
        self.assertEqual(self.slot.position_name, "Ticket Table")

    def test_a_broken_send_path_is_contained_by_the_flush(self):
        # The provider layer contains its own errors; this covers the other way
        # in, where building the message itself goes wrong.
        with patch("events.services._send", side_effect=Exception("boom")):
            with self.assertLogs("events.services", level="ERROR") as logs:
                with self.captureOnCommitCallbacks(execute=True):
                    self.slot.position_name = "Ticket Table"
                    self.slot.save()

        self.assertTrue(
            any("Volunteer change notification failed" in line for line in logs.output)
        )
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.position_name, "Ticket Table")


    def test_a_rolled_back_edit_sends_nothing(self):
        with self.patch_provider() as provider:
            with self.captureOnCommitCallbacks(execute=True):
                try:
                    with transaction.atomic():
                        self.slot.position_name = "Ticket Table"
                        self.slot.save()
                        raise RuntimeError("rollback")
                except RuntimeError:
                    pass

                # A later, unrelated commit must not flush the abandoned change.
                self.event.save(update_fields=["updated_at"])

        provider.return_value.send_email.assert_not_called()
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.position_name, "Greeter")

    def test_a_reassigned_signup_gets_a_move_email(self):
        later_slot = VolunteerSlot.objects.create(
            event=self.event,
            position_name="Ticket Table",
            start_datetime=datetime(2026, 12, 25, 14, 0, tzinfo=UTC),
            end_datetime=datetime(2026, 12, 25, 16, 0, tzinfo=UTC),
        )

        with self.patch_provider() as provider:
            with self.captureOnCommitCallbacks(execute=True):
                self.signup.slot = later_slot
                self.signup.save()

        sent = provider.return_value.send_email.call_args_list
        self.assertEqual(len(sent), 1)
        self.assertIn("Changed", sent[0].kwargs["subject"])
        self.assertNotIn("Cancelled", sent[0].kwargs["subject"])

    def test_a_signup_with_no_slot_never_notifies(self):
        orphan = VolunteerSignup.objects.create(
            slot=None,
            first_name="Kenji",
            last_name="Sato",
            email="kenji@example.test",
            phone="916-555-0101",
        )

        with self.patch_provider() as provider:
            with self.captureOnCommitCallbacks(execute=True):
                self.slot.position_name = "Ticket Table"
                self.slot.save()

        self.assertEqual(orphan.email, "kenji@example.test")
        recipients = [
            call.kwargs["to"] for call in provider.return_value.send_email.call_args_list
        ]
        self.assertEqual(recipients, ["aiko@example.test"])











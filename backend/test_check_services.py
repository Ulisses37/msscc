from io import StringIO
from unittest import TestCase
from unittest.mock import patch

from check_services import check_services, main


class CheckServicesTests(TestCase):
    """Verify advisory configuration checks without Django setup or service requests."""

    def complete_environment(self) -> dict[str, str]:
        """Return noncredential sentinels for presence-only checks."""
        names = (
            "RESEND_API_KEY",
            "RESEND_FROM_EMAIL",
            "RESEND_DEV_ALERT_EMAIL",
            "RESEND_SEGMENT_ID",
            "RESEND_WEBHOOK_SECRET",
            "STRIPE_SECRET_KEY",
            "STRIPE_WEBHOOK_SECRET",
            "S3_ENDPOINT_URL",
            "S3_BUCKET",
            "S3_ACCESS_KEY",
            "S3_SECRET_KEY",
            "S3_PUBLIC_DOMAIN",
            "TRIGGER_API_KEY",
        )
        environment = dict.fromkeys(names, "presence-only-sentinel")
        for flag in (
            "EMAIL_ENABLED", "EMAIL_SEND_TO_DEV", "STRIPE_ENABLED",
            "EVENT_ANNOUNCEMENTS_ENABLED",
            "MEMBERSHIP_REMINDERS_ENABLED",
        ):
            environment[flag] = "true"
        return environment

    def test_complete_configuration_reports_all_services_configured(self) -> None:
        environment = self.complete_environment()
        environment["DJANGO_SETTINGS_MODULE"] = "config.settings.production"

        results = check_services(environment)

        self.assertEqual(len(results), 8)
        self.assertTrue(all(result.status == "CONFIGURED" for result in results))

    def test_empty_environment_is_reported_without_failure(self) -> None:
        results = {result.service: result for result in check_services({})}

        self.assertEqual(results["Resend email"].status, "DISABLED")
        self.assertEqual(results["Stripe backend"].status, "DISABLED")
        self.assertEqual(results["Object storage"].status, "NOT CONFIGURED")

    def test_frontend_variables_do_not_change_backend_results(self) -> None:
        environment = self.complete_environment()
        before = check_services(environment)
        environment.update(
            {
                "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "presence-only-sentinel",
                "NEXT_PUBLIC_PAYMENTS_ENABLED": "invalid-frontend-flag",
                "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY": "presence-only-sentinel",
                "DEEPL_API_KEY": "presence-only-sentinel",
            }
        )

        self.assertEqual(check_services(environment), before)
        self.assertTrue(
            all(row.service not in {"Stripe frontend", "Google Maps", "DeepL"} for row in before)
        )

    def test_missing_webhook_key_reports_partial_instead_of_loading_django(self) -> None:
        results = check_services({"STRIPE_SECRET_KEY": "presence-only-sentinel"})
        stripe = next(row for row in results if row.service == "Stripe backend")

        self.assertEqual(stripe.status, "PARTIAL")
        self.assertIn("STRIPE_WEBHOOK_SECRET", stripe.detail)

    def test_explicit_disable_is_preserved_even_with_complete_credentials(self) -> None:
        environment = self.complete_environment()
        environment["STRIPE_ENABLED"] = "false"
        results = {result.service: result for result in check_services(environment)}

        self.assertEqual(results["Stripe backend"].status, "DISABLED")

    def test_whitespace_values_are_missing(self) -> None:
        results = check_services({"S3_ACCESS_KEY": " \t "})

        self.assertEqual(
            next(row for row in results if row.service == "Object storage").status,
            "NOT CONFIGURED",
        )

    def test_invalid_boolean_is_reported_without_echoing_value(self) -> None:
        results = check_services({"STRIPE_ENABLED": "invalid-private-value"})
        stripe = next(row for row in results if row.service == "Stripe backend")

        self.assertEqual(stripe.status, "PARTIAL")
        self.assertIn("STRIPE_ENABLED", stripe.detail)
        self.assertNotIn("invalid-private-value", stripe.detail)

    def test_email_dependent_features_are_disabled_when_email_is_off(self) -> None:
        environment = self.complete_environment()
        environment["EMAIL_ENABLED"] = "false"
        results = check_services(environment)

        for service in ("Event announcements", "Membership reminders"):
            matches = [row for row in results if row.service == service]
            self.assertEqual(len(matches), 1)
            self.assertEqual(matches[0].status, "DISABLED")
            self.assertIn("EMAIL_ENABLED", matches[0].detail)

    def test_production_storage_requires_public_domain(self) -> None:
        environment = self.complete_environment()
        del environment["S3_PUBLIC_DOMAIN"]
        environment["DJANGO_SETTINGS_MODULE"] = "config.settings.production"
        results = check_services(environment)
        storage = next(row for row in results if row.service == "Object storage")

        self.assertEqual(storage.status, "PARTIAL")
        self.assertIn("S3_PUBLIC_DOMAIN", storage.detail)

    def test_output_does_not_disclose_any_environment_values(self) -> None:
        environment = self.complete_environment()
        environment["EMAIL_PROVIDER"] = "private-provider-value"
        environment["UNRELATED_SECRET"] = "unrelated-private-value"
        output = StringIO()
        with patch.dict("os.environ", environment, clear=True):
            self.assertEqual(main([], output=output), 0)

        text = output.getvalue()
        for value in (
            "presence-only-sentinel", "private-provider-value", "unrelated-private-value"
        ):
            self.assertNotIn(value, text)
        self.assertIn("EMAIL_PROVIDER", text)
        self.assertIn("not that credentials work", text)

    def test_main_succeeds_when_everything_is_missing(self) -> None:
        output = StringIO()
        with patch.dict("os.environ", {}, clear=True):
            self.assertEqual(main([], output=output), 0)
        self.assertIn("Advisory report complete", output.getvalue())
        self.assertIn("Frontend configuration is not checked", output.getvalue())

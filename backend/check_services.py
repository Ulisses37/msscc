import argparse
import os
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import TextIO

TRUE_VALUES = {"true", "1", "yes"}
FALSE_VALUES = {"false", "0", "no"}


@dataclass(frozen=True)
class ServiceResult:
    """Describe configuration presence without retaining configuration values."""

    service: str
    status: str
    detail: str


def check_services(
    environment: Mapping[str, str], *, frontend: bool = False
) -> list[ServiceResult]:
    """Inspect supplied variables without loading settings or contacting services."""
    results = []

    def present(name: str) -> bool:
        return bool(environment.get(name, "").strip())

    def enabled(name: str, default: bool = False) -> bool:
        value = environment.get(name, "").strip().lower()
        return value in TRUE_VALUES if value else default

    def record(
        service: str,
        required: tuple[str, ...],
        *,
        flag: str | None = None,
        default: bool = True,
        frontend_only: bool = False,
        email_prerequisite: bool = False,
    ) -> None:
        flag_value = environment.get(flag, "").strip().lower() if flag else ""
        missing = [name for name in required if not present(name)]
        if flag_value and flag_value not in TRUE_VALUES | FALSE_VALUES:
            results.append(ServiceResult(service, "PARTIAL", f"Invalid boolean flag: {flag}"))
        elif frontend_only and not frontend and not any(
            name in environment for name in (*required, *((flag,) if flag else ()))
        ):
            results.append(
                ServiceResult(
                    service, "NOT CHECKED", "Requires frontend environment; use --frontend"
                )
            )
        elif flag and not enabled(flag, default):
            detail = f"{flag} is off; settings not verified"
            if missing:
                detail += f"; missing: {', '.join(missing)}"
            results.append(ServiceResult(service, "DISABLED", detail))
        elif email_prerequisite and not email_enabled:
            results.append(
                ServiceResult(service, "DISABLED", "EMAIL_ENABLED is off; email prerequisite unmet")
            )
        elif missing:
            status = "PARTIAL" if any(present(name) for name in required) else "NOT CONFIGURED"
            if flag and enabled(flag):
                status = "PARTIAL"
            results.append(ServiceResult(service, status, f"Missing: {', '.join(missing)}"))
        else:
            results.append(ServiceResult(service, "CONFIGURED", "Required variables present"))

    email_enabled = enabled("EMAIL_ENABLED", present("RESEND_API_KEY"))
    record(
        "Resend email",
        ("RESEND_API_KEY", "RESEND_FROM_EMAIL"),
        flag="EMAIL_ENABLED",
        default=present("RESEND_API_KEY"),
    )
    if present("EMAIL_PROVIDER") and environment["EMAIL_PROVIDER"].strip() != "resend":
        results.append(
            ServiceResult("Email provider", "PARTIAL", "EMAIL_PROVIDER is not the Resend adapter")
        )
    record(
        "Email dev routing",
        ("RESEND_DEV_ALERT_EMAIL",),
        flag="EMAIL_SEND_TO_DEV",
        default=False,
    )
    record(
        "Mailing list",
        ("RESEND_API_KEY", "RESEND_FROM_EMAIL", "RESEND_SEGMENT_ID", "RESEND_WEBHOOK_SECRET"),
        flag="EMAIL_ENABLED",
        default=present("RESEND_API_KEY"),
    )
    record(
        "Stripe backend",
        ("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"),
        flag="STRIPE_ENABLED",
        default=present("STRIPE_SECRET_KEY"),
    )
    record(
        "Stripe frontend",
        ("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",),
        flag="NEXT_PUBLIC_PAYMENTS_ENABLED",
        frontend_only=True,
    )
    record("Google Maps", ("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",), frontend_only=True)
    record("DeepL", ("DEEPL_API_KEY",), frontend_only=True)
    storage_required = ("S3_ENDPOINT_URL", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY")
    if environment.get("DJANGO_SETTINGS_MODULE", "").strip() == "config.settings.production":
        storage_required += ("S3_PUBLIC_DOMAIN",)
    record("Object storage", storage_required)
    for service, flag in (
        ("Event announcements", "EVENT_ANNOUNCEMENTS_ENABLED"),
        ("Membership reminders", "MEMBERSHIP_REMINDERS_ENABLED"),
    ):
        required = ("RESEND_API_KEY", "RESEND_FROM_EMAIL")
        if service == "Event announcements":
            required += ("RESEND_SEGMENT_ID",)
        else:
            required += ("TRIGGER_API_KEY",)
        record(service, required, flag=flag, default=False, email_prerequisite=True)
    record("Scheduler authentication", ("TRIGGER_API_KEY",))
    return results


def main(argv: Sequence[str] | None = None, *, output: TextIO | None = None) -> int:
    """Write an advisory report; missing service configuration never makes it fail."""
    parser = argparse.ArgumentParser(
        description="Report service environment configuration without network requests or Django."
    )
    parser.add_argument(
        "--frontend",
        action="store_true",
        help="Treat absent frontend variables as missing rather than not checked.",
    )
    arguments = parser.parse_args(argv)
    stream = output if output is not None else sys.stdout
    stream.write(
        "Service configuration report (process environment only)\n"
        "CONFIGURED means variables are present, not that credentials work.\n"
        "No Django settings or secret files loaded; no network or database requests.\n"
        "Settings overrides and frontend build/deployment values are not verified.\n"
        "Development settings force email dev routing on; check RESEND_DEV_ALERT_EMAIL.\n\n"
    )
    for result in check_services(os.environ, frontend=arguments.frontend):
        stream.write(f"{result.service:<25} {result.status:<15} {result.detail}\n")
    stream.write(
        "\nAdvisory report complete. No configuration values displayed.\n"
        "Disabled features may be intentional. Check provider dashboards and application\n"
        "behavior separately for permissions, domain verification, webhooks, and connectivity.\n"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

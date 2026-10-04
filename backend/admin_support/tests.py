from django.core.exceptions import ValidationError
from django.test import TestCase

from admin_support.models import AdminSupport


class AdminSupportModelTests(TestCase):
    def test_str_returns_subject(self):
        support = AdminSupport.objects.create(
            name="Jane Doe",
            email="jane@example.com",
            subject="Feature request",
            description="Add dark mode",
        )
        self.assertEqual(str(support), "Feature request")

    def test_is_deleted_defaults_to_false(self):
        support = AdminSupport.objects.create(
            name="Jane Doe",
            email="jane@example.com",
            subject="Bug report",
            description="Login is broken",
        )
        self.assertFalse(support.is_deleted)

    def test_full_clean_raises_validation_error_for_missing_name(self):
        support = AdminSupport(
            name="",
            email="test@example.com",
            subject="Test",
            description="Test",
        )
        with self.assertRaises(ValidationError) as ctx:
            support.full_clean()
        self.assertIn("name", ctx.exception.message_dict)

    def test_full_clean_raises_validation_error_for_missing_email(self):
        support = AdminSupport(
            name="Jane Doe",
            email="",
            subject="Test",
            description="Test",
        )
        with self.assertRaises(ValidationError) as ctx:
            support.full_clean()
        self.assertIn("email", ctx.exception.message_dict)

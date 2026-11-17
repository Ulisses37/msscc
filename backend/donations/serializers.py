from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .manual_donations import _persist_manual_donation
from .manual_memberships import _persist_manual_membership
from .models import Donation, Membership
from .processing_costs import calculate_donation_amounts


class StrictContributionChoiceField(serializers.BooleanField):
    """Require the form's actual JSON boolean, not DRF's string/number coercions."""

    def to_internal_value(self, data):
        if type(data) is not bool:
            raise serializers.ValidationError("Expected a boolean.")
        return data


class DonationAddressField(serializers.CharField):
    """Reject non-text addresses instead of coercing numbers to personal data."""

    def to_internal_value(self, data):
        if not isinstance(data, str):
            raise serializers.ValidationError("Expected a string.")
        return super().to_internal_value(data)


class DonationSerializer(serializers.ModelSerializer):
    """Serializer for donation records."""

    # The anonymous path does not submit names. Validate their presence for
    # ordinary donations below, after the anonymity choice is known.
    donor_first_name = serializers.CharField(
        source="donor_first_name_encrypted", max_length=255, required=False, allow_blank=True,
    )
    donor_last_name = serializers.CharField(
        source="donor_last_name_encrypted", max_length=255, required=False, allow_blank=True,
    )
    donor_email = serializers.EmailField(source="donor_email_encrypted", max_length=254)
    address = DonationAddressField(
        source="donor_address_encrypted", required=False, allow_null=True, allow_blank=True,
    )
    contribute_to_processing_costs = StrictContributionChoiceField(required=False, default=False)

    class Meta:
        model = Donation
        fields = [
            "donation_id",
            "donor_first_name",
            "donor_last_name",
            "donor_email",
            "address",
            "amount",
            "contribute_to_processing_costs",
            "processing_cost_contribution",
            "total_amount",
            "donation_date",
            "is_anonymous",
            "message",
            "payment_status",
            "reference_id",
            "created_at",
        ]
        read_only_fields = [
            "donation_id",
            "processing_cost_contribution",
            "total_amount",
            "donation_date",
            "payment_status",
            "reference_id",
            "created_at",
        ]
        extra_kwargs = {
            "is_anonymous": {"required": False, "default": False},
            "message": {"required": False, "allow_blank": True, "default": ""},
        }

    def validate_amount(self, value):
        """Require a donation amount greater than zero."""
        if value <= 0:
            raise serializers.ValidationError("Donation amount must be greater than zero.")
        return value

    def validate_donor_first_name(self, value):
        """Normalize input; anonymity-dependent requirements run in validate()."""
        return value.strip()

    def validate_donor_last_name(self, value):
        return value.strip()

    def validate_donor_email(self, value):
        """Normalize email before storing it."""
        return value.strip().lower()

    def validate_address(self, value):
        """Keep unknown historical addresses as null, not encrypted blank strings."""
        return value or None

    def validate_message(self, value):
        """Keep optional donor messages short."""
        if len(value) > 500:
            raise serializers.ValidationError("Message cannot exceed 500 characters.")
        return value.strip()

    def validate(self, attrs):
        """Enforce record privacy and validate amounts, including admin edits."""
        anonymous = attrs.get("is_anonymous", getattr(self.instance, "is_anonymous", False))
        if anonymous:
            # Never trust the browser to substitute names: direct public POSTs
            # and authorized updates must not retain a supplied personal name.
            attrs["donor_first_name_encrypted"] = "Anonymous"
            attrs["donor_last_name_encrypted"] = ""
            attrs["donor_address_encrypted"] = None
        else:
            # Partial admin edits may reuse existing ordinary names, but a
            # formerly anonymous record needs real names before being unmarked.
            errors = {}
            for public_name, stored_name, message in (
                ("donor_first_name", "donor_first_name_encrypted", "First name is required."),
                ("donor_last_name", "donor_last_name_encrypted", "Last name is required."),
            ):
                if not (
                    attrs.get(stored_name, getattr(self.instance, stored_name, None)) or ""
                ).strip():
                    errors[public_name] = message
            if errors:
                raise serializers.ValidationError(errors)

        base = attrs.get("amount", getattr(self.instance, "amount", None))
        choice = attrs.get(
            "contribute_to_processing_costs",
            getattr(self.instance, "contribute_to_processing_costs", False),
        )
        if (self.instance is not None
                and self.instance.payment_status == Donation.PaymentStatus.COMPLETED
                and (base != self.instance.amount
                     or choice != self.instance.contribute_to_processing_costs)):
            raise serializers.ValidationError({
                "amount": "A completed payment's amounts cannot be changed."
            })
        if base is not None:
            try:
                calculate_donation_amounts(base, choice)
            except ValueError as exc:
                raise serializers.ValidationError({"amount": str(exc)}) from None
        return attrs

    def create(self, validated_data):
        """Persist the opt-in, while monetary extras remain server-controlled."""
        # The preview quote is not payment authorization: calculate again from
        # validated inputs so a changed or forged browser total cannot persist.
        contribution, total = calculate_donation_amounts(
            validated_data["amount"], validated_data["contribute_to_processing_costs"]
        )
        with transaction.atomic():
            donation = Donation.objects.create(
                **validated_data,
                processing_cost_contribution=contribution,
                total_amount=total,
                donation_date=timezone.localdate(),
                payment_status=Donation.PaymentStatus.PENDING,
                record_source=Donation.RecordSource.CHECKOUT,
                reference_id="pending",
            )
            donation.reference_id = f"DON-{donation.donation_id:08d}"
            donation.save(update_fields=["reference_id"])

        return donation

    def update(self, instance, validated_data):
        """Recalculate authorized changes, never accept supplied monetary extras."""
        # Finance-admin changes to either input must not leave the stored
        # breakdown out of sync; read-only client totals are ignored.
        if (validated_data.get("amount", instance.amount) != instance.amount
                or validated_data.get(
                    "contribute_to_processing_costs", instance.contribute_to_processing_costs
                )
                != instance.contribute_to_processing_costs):
            contribution, total = calculate_donation_amounts(
                validated_data.get("amount", instance.amount),
                validated_data.get(
                    "contribute_to_processing_costs", instance.contribute_to_processing_costs
                ),
            )
            validated_data["processing_cost_contribution"] = contribution
            validated_data["total_amount"] = total
        return super().update(instance, validated_data)


class AdminDonationSerializer(DonationSerializer):
    """Expose recorded provenance and offline facts only through authorized admin paths."""

    class Meta(DonationSerializer.Meta):
        fields = [
            *DonationSerializer.Meta.fields,
            "record_source", "payment_method", "external_reference", "currency",
        ]
        read_only_fields = [
            *DonationSerializer.Meta.read_only_fields,
            "record_source", "payment_method", "external_reference", "currency",
        ]


class ManualDonationInputSerializer(serializers.Serializer):
    """Validate and save received donation facts independently of public checkout."""

    PAYMENT_METHODS = Donation.PaymentMethod.values

    donor_first_name = DonationAddressField(
        source="donor_first_name_encrypted", max_length=255, required=False,
        allow_null=True, allow_blank=True, default=None,
    )
    donor_last_name = DonationAddressField(
        source="donor_last_name_encrypted", max_length=255, required=False,
        allow_null=True, allow_blank=True, default=None,
    )
    donor_email = serializers.EmailField(
        source="donor_email_encrypted", max_length=254, required=False,
        allow_null=True, allow_blank=True, default=None,
    )
    address = DonationAddressField(
        source="donor_address_encrypted", required=False,
        allow_null=True, allow_blank=True, default=None,
    )
    amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.01"),
    )
    currency = serializers.ChoiceField(choices=("usd",), default="usd")
    donation_date = serializers.DateField(input_formats=["%Y-%m-%d"])
    payment_method = serializers.ChoiceField(
        choices=PAYMENT_METHODS, required=False, allow_null=True, default=None,
    )
    is_anonymous = StrictContributionChoiceField(default=False)
    external_reference = DonationAddressField(
        max_length=255, required=False, allow_blank=True, default="",
    )
    message = DonationAddressField(max_length=500, required=False, allow_blank=True, default="")

    def to_internal_value(self, data):
        """Reject checkout identifiers and server-controlled facts rather than ignore them."""
        if not isinstance(data, dict):
            raise serializers.ValidationError({"non_field_errors": ["Expected an object."]})
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({key: "Unsupported field." for key in unknown})
        return super().to_internal_value(data)

    def validate_donation_date(self, value):
        """A received payment cannot have a future donation date."""
        if value > timezone.localdate():
            raise serializers.ValidationError("Donation date cannot be in the future.")
        return value

    def create(self, validated_data):
        """Persist validated facts atomically without payment or subscription actions."""
        return _persist_manual_donation(validated_data)

    def validate(self, attrs):
        """Normalize unknown contacts and discard anonymous identity without inferring facts."""
        for field in (
            "donor_first_name_encrypted", "donor_last_name_encrypted",
            "donor_email_encrypted", "donor_address_encrypted",
        ):
            attrs[field] = attrs.get(field) or None
        if attrs["donor_email_encrypted"]:
            attrs["donor_email_encrypted"] = attrs["donor_email_encrypted"].lower()
        if attrs["is_anonymous"]:
            attrs["donor_first_name_encrypted"] = None
            attrs["donor_last_name_encrypted"] = None
            attrs["donor_address_encrypted"] = None
        return attrs


class PublicDonationCreateSerializer(DonationSerializer):
    """Require ordinary public donors' addresses without returning them to callers."""

    address = DonationAddressField(
        source="donor_address_encrypted", required=False, allow_null=True, allow_blank=True,
        write_only=True,
    )

    def validate(self, attrs):
        """Apply public requirements independently of historical record validation."""
        attrs = super().validate(attrs)
        if not attrs.get("is_anonymous", False) and not attrs.get("donor_address_encrypted"):
            raise serializers.ValidationError({"address": "Address is required."})
        return attrs


class MembershipAddressField(serializers.CharField):
    """Accept free-form address text without coercing non-string input."""

    def to_internal_value(self, data):
        if not isinstance(data, str):
            raise serializers.ValidationError("Expected a string.")
        return super().to_internal_value(data)


class MembershipSerializer(serializers.ModelSerializer):
    """Serializer for membership records."""

    first_name = serializers.CharField(source="first_name_encrypted", max_length=255)
    last_name = serializers.CharField(source="last_name_encrypted", max_length=255)
    email = serializers.EmailField(source="email_encrypted", max_length=254, allow_null=True)
    phone = serializers.CharField(source="phone_encrypted", max_length=255, allow_null=True)
    address = MembershipAddressField(
        source="address_encrypted", required=False, allow_null=True, allow_blank=True,
    )

    class Meta:
        model = Membership
        fields = [
            "membership_id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "address",
            "membership_type",
            "membership_price",
            "amount_paid",
            "start_date",
            "end_date",
            "renewal_date",
            "payment_status",
            "payment_method",
            "reference_id",
            "status",
            "notes",
            "record_source",
            "created_at",
            "updated_at",
        ]
        # This serializer is for authorized manual records; public checkout
        # must use the separate membership payment-session endpoint.
        # Keep Stripe linkage and checkout pricing outside the manual-record API,
        # including its admin list response; only the checkout service writes them.
        read_only_fields = ["membership_id", "record_source", "created_at", "updated_at"]
        # Existing create inputs remain required, but unknown values can be explicit nulls.
        extra_kwargs = {
            "notes": {"max_length": 500},
            "amount_paid": {"required": True, "allow_null": True},
            "start_date": {"required": True, "allow_null": True},
            "end_date": {"required": True, "allow_null": True},
            "renewal_date": {"required": True, "allow_null": True},
            "payment_status": {"required": True, "allow_null": True, "allow_blank": False},
        }
        # notes is a TextField without a model limit; bound API input even
        # though historical/admin-entered rows may contain longer notes.

    def validate_first_name(self, value):
        """Names are free text: keep apostrophes, hyphens and Unicode intact."""
        return value.strip()

    def validate_last_name(self, value):
        return value.strip()

    def validate_address(self, value):
        """Store missing address text as null rather than encrypted empty strings."""
        return value or None

    def create(self, validated_data):
        """Assign manual provenance unless trusted backend code supplies a source."""
        validated_data.setdefault("record_source", Membership.RecordSource.MANUAL)
        return super().create(validated_data)


class ManualMembershipCreateSerializer(MembershipSerializer):
    """Validate explicit manual facts without applying checkout defaults or catalog rules."""

    MEMBERSHIP_STATUSES = ("unknown", "active", "inactive", "pending", "expired", "canceled")
    PAYMENT_STATUSES = (*Membership.PaymentStatus.values, "waived")

    email = serializers.EmailField(
        source="email_encrypted", max_length=254, required=False,
        allow_null=True, allow_blank=True, default=None,
    )
    phone = MembershipAddressField(
        source="phone_encrypted", max_length=255, required=False,
        allow_null=True, allow_blank=True, default=None,
    )
    address = MembershipAddressField(
        source="address_encrypted", required=False, allow_null=True, allow_blank=True, default=None,
    )
    status = serializers.ChoiceField(choices=MEMBERSHIP_STATUSES)
    payment_status = serializers.ChoiceField(
        choices=PAYMENT_STATUSES, required=False, allow_null=True, default=None,
    )
    payment_method = serializers.ChoiceField(
        choices=Membership.PaymentMethod.choices, required=False, allow_null=True, default=None,
    )
    membership_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0, required=False, allow_null=True, default=None,
    )
    amount_paid = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0, required=False, allow_null=True, default=None,
    )

    class Meta(MembershipSerializer.Meta):
        extra_kwargs = {
            "start_date": {"required": False, "allow_null": True, "default": None},
            "end_date": {"required": False, "allow_null": True, "default": None},
            "renewal_date": {"required": False, "allow_null": True, "default": None},
            "reference_id": {"required": False, "allow_blank": True, "default": ""},
            "notes": {"required": False, "allow_blank": True, "default": "", "max_length": 500},
        }

    def validate_email(self, value):
        """Use null for unknown contacts and normalize supplied email casing."""
        return value.lower() if value else None

    def create(self, validated_data):
        """Keep manual creation atomic and independent of public checkout services."""
        return _persist_manual_membership(validated_data)

    def validate_phone(self, value):
        """Preserve international free-text phone formats, but not empty strings."""
        return value or None

    def validate(self, attrs):
        """Compare only supplied dates; absent historical dates remain unknown."""
        start = attrs.get("start_date")
        end = attrs.get("end_date")
        if start is not None and end is not None and end < start:
            raise serializers.ValidationError({"end_date": "End date cannot precede start date."})
        return attrs

class DashboardDonationSerializer(serializers.ModelSerializer):
    donor_first_name = serializers.SerializerMethodField()
    donor_last_name = serializers.SerializerMethodField()
    amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, coerce_to_string=False, read_only=True)

    def get_donor_first_name(self, obj):
        return "Anonymous" if obj.is_anonymous else obj.donor_first_name_encrypted

    def get_donor_last_name(self, obj):
        return "" if obj.is_anonymous else obj.donor_last_name_encrypted

    class Meta:
        model = Donation
        fields = ["donor_first_name", "donor_last_name", "amount", "donation_date", "donation_id"]
        read_only_fields = fields


class DashboardMembershipSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source="first_name_encrypted", read_only=True)
    last_name = serializers.CharField(source="last_name_encrypted", read_only=True)

    class Meta:
        model = Membership
        fields = ["first_name", "last_name", "membership_type", "start_date", "membership_id"]
        read_only_fields = fields

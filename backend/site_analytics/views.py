from datetime import date

from django.db.models import F, Q, Sum
from django.db.models.functions import ExtractMonth
from django.utils import timezone
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import DailyVisit


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([AnonRateThrottle])
def track_visit(request):
    today = timezone.localdate()
    DailyVisit.objects.get_or_create(date=today)
    DailyVisit.objects.filter(date=today).update(count=F("count") + 1)
    return Response(status=204)


@api_view(["GET"])
def yearly_stats(request, year):
    rows = (
        DailyVisit.objects.filter(date__year=year)
        .annotate(month=ExtractMonth("date"))
        .values("month")
        .annotate(total=Sum("count"))
        .order_by("month")
    )
    yearly_views = [year] + [0] * 12
    for r in rows:
        yearly_views[r["month"]] = r["total"]
    return Response({"yearly_views": yearly_views})

@api_view(["GET"])
def visit_summary(request):
    today = timezone.localdate()
    month_start = date(today.year, today.month, 1)
    year_start = date(today.year, 1, 1)

    totals = DailyVisit.objects.aggregate(
        today=Sum("count", filter=Q(date=today)),
        this_month=Sum("count", filter=Q(date__gte=month_start)),
        this_year=Sum("count", filter=Q(date__gte=year_start)),
        all_time=Sum("count"),
    )
    data = {k: v or 0 for k, v in totals.items()}
    data["year"] = today.year
    data["month"] = today.month
    return Response(data)

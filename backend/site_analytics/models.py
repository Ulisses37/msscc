from django.db import models


class DailyVisit(models.Model):
    date = models.DateField(unique=True)
    count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["date"]

    def __str__(self):
        return f"{self.date}: {self.count}"

from django.db import models
from volunteer_slots.models import VolunteerSlot # Cross-app import

class VolunteerSignup(models.Model):
    volunteer_signup_id = models.AutoField(primary_key=True)
    slot = models.ForeignKey(
        VolunteerSlot, 
        on_delete=models.CASCADE, 
        related_name='signup',
        null=True, 
        blank=True
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    status = models.CharField(max_length=50, default='pending')
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'volunteer_signup'
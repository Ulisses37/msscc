from django.db import models

class AdminUser(models.Model):
    # This matches the admin_user_id and email seen in your frontend
    admin_user_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    
    permissions = models.JSONField(default=dict)
    is_executive = models.BooleanField(default=False)

    def __str__(self):
        return self.email
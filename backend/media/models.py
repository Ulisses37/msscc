from django.db import models
from django.core.files.storage import default_storage

#Security Models by passing by Reference
class FileModel(models.Model):
    """Stores a reference to a file in S3/MinIO."""
    file_name = models.CharField(max_length=255)
    file = models.FileField(upload_to='public/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'media'

    def __str__(self):
        return self.file_name

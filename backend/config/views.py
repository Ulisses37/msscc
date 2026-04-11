from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import os
from django.conf import settings
import secrets
import string
import re


def short_id(n=6):
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(n))

@csrf_exempt
@require_POST
def upload_image(request):
    if 'image' not in request.FILES:
        return JsonResponse({'error': 'No image file provided'}, status=400)

    image = request.FILES['image']

    # Validate file type
    if not image.content_type in ['image/jpeg', 'image/png', 'image/gif']:
        return JsonResponse({'error': 'Invalid file type'}, status=400)

    # Save the file
    # For simplicity, save to media/public/
    media_root = settings.MEDIA_ROOT
    images_dir = os.path.join(media_root, 'public')
    os.makedirs(images_dir, exist_ok=True)

    # Make Unique Filename
    name, ext = os.path.splitext(image.name)
    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name)
    # Cap Character Length to 30 to avoid long filenames
    if len(safe_name) > 30:
        safe_name = safe_name[:30]
    new_filename = f"{safe_name}_{short_id()}{ext}"

    file_path = os.path.join(images_dir, new_filename)
    with open(file_path, 'wb+') as destination:
        for chunk in image.chunks():
            destination.write(chunk)

    image_url = f"{settings.MEDIA_URL}public/{new_filename}"
    return JsonResponse({'url': image_url})

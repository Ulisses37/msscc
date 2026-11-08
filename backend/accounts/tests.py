# Create your tests here.
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

URL = "/api/auth/token/verify/"


class TokenVerifyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            email="verify@test.com", password="pass12345"  # adjust to your user model's fields
        )

    def test_valid_access_token_returns_200(self):
        token = str(RefreshToken.for_user(self.user).access_token)
        res = self.client.post(URL, {"token": token}, format="json")
        self.assertEqual(res.status_code, 200)

    def test_garbage_token_returns_401(self):
        res = self.client.post(URL, {"token": "not.a.jwt"}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_tampered_token_returns_401(self):
        token = str(RefreshToken.for_user(self.user).access_token)
        h, p, s = token.split(".")
        bad = ".".join([h, p, ("A" if s[0] != "A" else "B") + s[1:]])
        res = self.client.post(URL, {"token": bad}, format="json")
        self.assertEqual(res.status_code, 401)

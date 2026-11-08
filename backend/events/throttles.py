from rest_framework.throttling import AnonRateThrottle


class VolunteerSignupThrottle(AnonRateThrottle):
    """Limit how many volunteer signups one IP address can create."""

    scope = "volunteer_signup"

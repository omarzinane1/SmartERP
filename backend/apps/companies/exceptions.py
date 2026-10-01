from rest_framework.exceptions import APIException


class OnboardingAlreadyCompleted(APIException):
    status_code = 409
    default_detail = "La configuration initiale de cette société est déjà terminée."
    default_code = "onboarding_already_completed"

from rest_framework.exceptions import APIException


class BusinessConflict(APIException):
    status_code = 409
    default_detail = "Cette opération est incompatible avec l'état actuel."
    default_code = "business_conflict"


def exception_handler(exc, context):
    from django.db.models.deletion import ProtectedError
    from rest_framework.views import exception_handler as drf_exception_handler
    if isinstance(exc, ProtectedError):
        exc = BusinessConflict("Cet enregistrement est encore référencé. Retirez ses liaisons avant suppression.")
    return drf_exception_handler(exc, context)

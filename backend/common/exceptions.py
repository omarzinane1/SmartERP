from rest_framework.exceptions import APIException


class BusinessConflict(APIException):
    status_code = 409
    default_detail = "Cette opération est incompatible avec l'état actuel."
    default_code = "business_conflict"

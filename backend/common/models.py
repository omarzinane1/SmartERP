from django.db import models


class TimeStampedModel(models.Model):
    """
    Base model providing creation and modification timestamps.

    This model is abstract and therefore does not create
    its own database table.
    """

    created_at = models.DateTimeField(
        auto_now_add=True,
        editable=False,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        editable=False,
    )

    class Meta:
        abstract = True
from django.db import models


class EmailDeliveryState(models.Model):
    """Delivery bookkeeping shared by reminders and persistent notifications."""
    email_attempts = models.PositiveSmallIntegerField(default=0)
    email_started_at = models.DateTimeField(null=True)
    email_sent_at = models.DateTimeField(null=True)
    email_error_code = models.CharField(max_length=50, blank=True)
    email_claim = models.UUIDField(null=True)

    class Meta:
        abstract = True


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

from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from common.views import CompanyAPIView
from .summary_serializers import FinancePeriod
from . import summary_selectors as read


class FinanceSummaryView(CompanyAPIView):
    required_permission = "finance.view"
    kind = "kpis"

    def get(self, request):
        if self.kind in {"cash-flow", "upcoming-payments"} and "cashflow.view" not in self.codes():
            raise PermissionDenied()
        filters = FinancePeriod(data=request.query_params, context=dict(company=request.company))
        filters.is_valid(raise_exception=True)
        period = filters.validated_data
        if self.kind == "upcoming-payments":
            data = read.upcoming_payments(request.company, self.codes())
        elif self.kind == "cash-flow":
            data = read.get_cash_flow_summary(request.company, **period)
            data.update(history=read.get_cash_flow_series(request.company, **period),
                receivable=read.balance_summary(request.company)["total"], payable=read.balance_summary(request.company, True)["total"],
                receivableAging=read.aging_buckets(request.company), payableAging=read.aging_buckets(request.company, True))
        else:
            data = read.get_finance_kpis(request.company, **period, permissions=self.codes())
        return Response(dict(**data, **self.metadata()))

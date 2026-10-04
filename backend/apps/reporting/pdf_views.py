from io import BytesIO
from django.http import FileResponse
from common.views import CompanyAPIView
from common.pdf.commercial import render_commercial_pdf
from .pdf_selectors import commercial_pdf_data


class CommercialPDFView(CompanyAPIView):
    kind = "invoice"

    @property
    def required_permission(self):
        return "invoices.view" if self.kind == "invoice" else "quotes.export"

    def get(self, request, document_id):
        data = commercial_pdf_data(request.company, request.membership, self.kind, document_id)
        response = FileResponse(BytesIO(render_commercial_pdf(data)), content_type="application/pdf", as_attachment=True, filename=f"{data['number']}.pdf")
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response

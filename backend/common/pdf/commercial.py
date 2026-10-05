"""Render saved commercial values. No pricing, tax or balance calculation here."""
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
import reportlab
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, LongTable, Table, TableStyle, Image, KeepTogether

FONT_ROOT = Path(reportlab.__file__).parent / "fonts"
pdfmetrics.registerFont(TTFont("ERP", str(FONT_ROOT / "Vera.ttf")))
pdfmetrics.registerFont(TTFont("ERP-Bold", str(FONT_ROOT / "VeraBd.ttf")))


def render_commercial_pdf(data):
    stream = BytesIO()
    normal = ParagraphStyle("ERPBody", fontName="ERP", fontSize=9, leading=13, spaceAfter=5)
    small = ParagraphStyle("ERPCell", parent=normal, fontSize=8, leading=11, spaceAfter=0)
    right = ParagraphStyle("ERPAmount", parent=small, alignment=TA_RIGHT)
    title = ParagraphStyle("ERPTitle", parent=normal, fontName="ERP-Bold", fontSize=21, leading=27, spaceAfter=14)
    heading = ParagraphStyle("ERPHeading", parent=normal, fontName="ERP-Bold", fontSize=12, leading=16)

    def p(value, style=normal):
        return Paragraph(escape(str(value or "")).replace("\n", "<br/>"), style)

    def money(value):
        return format(value, ".2f")

    def numeric(value, width):
        text = str(value)
        measured = pdfmetrics.stringWidth(text, "ERP", 8)
        size = min(8, 8*(width-12)/measured) if measured else 8
        return p(text, ParagraphStyle("FittedAmount", parent=right, fontSize=size))

    doc = SimpleDocTemplate(stream, pagesize=A4, rightMargin=42, leftMargin=42, topMargin=38, bottomMargin=48,
        title=f"{data['title']} {data['number']}", author=data["company"]["name"], pageCompression=1)
    story = []
    company = data["company"]
    if company["logo"]:
        logo = Image(BytesIO(company["logo"]), width=90, height=45, kind="proportional")
        logo.hAlign = "LEFT"
        story.extend([logo, Spacer(1, 8)])
    story.extend([p(company["name"], heading), p(company["address"]), p(company["contact"]), p(f"Identifiant fiscal : {company['tax_id']}" if company["tax_id"] else ""),
        Spacer(1, 12), p(f"{data['title']} {data['number']}", title), p(f"Statut : {data['status']}"),
        p(f"Émission : {data['date']} | {data['due_label']} : {data['due_date']} | Devise : {data['currency']}"),
        Spacer(1, 10), p(data["customer_name"], heading), p(data["billing_address"]), Spacer(1, 12)])
    headers = ["Désignation", "Qté", "PU HT", "Rem. %", "TVA %", "HT net", "TTC"]
    rows = [[p(value, small) for value in headers]]
    for line in data["lines"]:
        label = "\n".join(value for value in [line["name"], line["description"]] if value)
        rows.append([p(label, small), numeric(format(line["quantity"].normalize(), "f"), 40), numeric(money(line["unit_price"]), 60),
            numeric(format(line["discount_rate"], "f"), 40), numeric(format(line["tax_rate"], "f"), 40), numeric(money(line["subtotal"]), 70), numeric(money(line["total"]), 80)])
    table = LongTable(rows, colWidths=[181, 40, 60, 40, 40, 70, 80], repeatRows=1, splitByRow=1, splitInRow=1)
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eeeeee")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, 0), .6, colors.grey), ("LINEBELOW", (0, 1), (-1, -1), .25, colors.lightgrey)]))
    story.extend([table, Spacer(1, 16)])
    totals = [[p(label), p(f"{money(value)} {data['currency']}", right)] for label, value in data["totals"]]
    totals_table = Table(totals, colWidths=[365, 146])
    totals_table.setStyle(TableStyle([("LINEABOVE", (0, -1), (-1, -1), .8, colors.grey), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story.extend([KeepTogether([totals_table]), Spacer(1, 14)])
    for label, content in [("Conditions de paiement", data["payment_terms"]), ("Notes", data["notes"]), ("Informations société", company["footer"])]:
        if content:
            story.extend([p(label, heading), p(content), Spacer(1, 10)])

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont("ERP", 8)
        canvas.setFillColor(colors.grey)
        canvas.drawString(42, 26, data["number"])
        canvas.drawRightString(A4[0]-42, 26, f"Page {document.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return stream.getvalue()

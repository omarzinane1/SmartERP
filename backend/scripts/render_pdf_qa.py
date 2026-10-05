"""Deterministic visual fixture; contains no live company data."""
from pathlib import Path
import sys
from decimal import Decimal as D
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.pdf.commercial import render_commercial_pdf

line = dict(name="Prestation technique enregistrée", description="Maintenance préventive, contrôle des équipements et compte rendu détaillé. Élément enregistré avec ses conditions commerciales.", quantity=D("3.000"), unit_price=D("19.99"), discount_rate=D("0.00"), tax_rate=D("20.00"), subtotal=D("59.97"), total=D("71.96"))
data = dict(title="Facture", number="QA-2026-0001", status="Comptabilisée", date="2026-10-04", due_date="2026-11-03", due_label="Échéance", currency="MAD", customer_name="École Démonstration & Associés", billing_address="12 rue des Écoles\nRabat, Maroc", payment_terms="Paiement par virement à trente jours.", notes="Exemple de contrôle visuel, sans donnée réelle.", totals=[("Total HT", D("2398.80")), ("TVA", D("479.60")), ("Total TTC", D("2878.40")), ("Déjà payé", D("400.00")), ("Reste dû", D("2478.40"))], company=dict(name="Société de contrôle SmartERP", address="Avenue de la République\nCasablanca, MA", contact="contact@example.test", tax_id="EXEMPLE", logo=None, footer="Merci de votre confiance. Les présentes conditions concernent ce document de contrôle visuel."), lines=[line.copy() for _ in range(40)])
folder = Path(__file__).resolve().parents[1] / ".test-postgres" / "pdf-qa"
folder.mkdir(parents=True, exist_ok=True)
(folder / "invoice-qa.pdf").write_bytes(render_commercial_pdf(data))
print(folder / "invoice-qa.pdf")

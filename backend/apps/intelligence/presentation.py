"""Render persisted ERP facts without delegating amounts or labels to the LLM."""
from .tools.registry import TOOLS


LABELS = {"revenue": "Chiffre d'affaires HT net", "currency": "Devise", "fromDate": "Du", "toDate": "Au", "definition": "Périmètre",
    "incoming": "Encaissements confirmés", "outgoing": "Décaissements confirmés", "netCashFlow": "Flux net confirmé", "transactionCount": "Paiements",
    "opening": "Solde initial", "openingDate": "Date du solde initial", "cash": "Solde bancaire", "source": "Périmètre", "balance": "Créance TTC",
    "customerId": "Client", "supplierId": "Fournisseur", "confirmedOrders": "Commandes confirmées", "receipts": "Réceptions enregistrées", "lateReceipts": "Réceptions après la date prévue",
    "asOf": "Situation au", "limit": "Nombre maximal affiché", "company": "Société"}


def fact_block(fact, index):
    data, tool = fact["data"], fact["tool"]
    base = dict(id=f"fact-{index}", category="FACT", type="table")
    if tool == "overdue_invoices":
        return dict(**base, columns=["Facture", "Échéance", "Solde TTC ("+data["currency"]+")"],
            rows=[[r["reference"], r["dueDate"], r["balance"]] for r in data["invoices"]])
    if tool == "low_stock":
        return dict(**base, columns=["Produit", "Dépôt", "Disponible", "Minimum"],
            rows=[[r["name"], str(r.get("warehouseId", data.get("warehouseId", ""))), r["available"], r["minimum"]] for r in data["products"]])
    if tool == "business_health":
        return dict(**base, columns=["Domaine", "État", "Faits observés"], rows=[[d["name"], d["status"], d["reason"]] for d in data["departments"]])
    return dict(**base, columns=[TOOLS[tool].label, "Valeur"], rows=[[LABELS[k], "Non disponible" if v is None else str(v)] for k, v in data.items() if k in LABELS])

def onboarding_payload(*, inventory=True):
    return {
        "company": {
            "name": "Configured A", "legal_name": "Configured A SARL",
            "logo": None, "tax_id": "", "email": "contact@example.test",
            "phone": "", "website": "", "address": "10 Main Street",
            "city": "Casablanca", "postal_code": "", "country": "MA",
            "currency": "MAD",
        },
        "business": {
            "industry": "Distribution", "business_type": "products",
            "main_activity": "Office supplies", "size": "small",
            "employee_count": None, "description": "",
        },
        "finance": {
            "currency": "MAD", "tax_system": "standard", "vat_rate": 20,
            "fiscal_year_start": "2026-01-01", "fiscal_year_end": "2026-12-31",
            "payment_terms": "30",
        },
        "inventory": {
            "enabled": True, "warehouse_name": "Main warehouse",
            "warehouse_code": "MAIN", "warehouse_address": "",
            "multi_warehouse": False, "valuation_method": "weighted_average",
            "low_stock_alerts": True, "default_unit": "unit",
        } if inventory else {"enabled": False},
        "invoicing": {
            "invoice_prefix": "INV-", "invoice_start": 1,
            "quote_prefix": "QT-", "quote_start": 1, "purchase_order_prefix": "PO-",
            "payment_terms": "Payment within 30 days", "footer": "",
            "language": "fr", "show_vat": True,
        },
        "modules": ["sales", "customers", "inventory", "warehouses"] if inventory else ["sales", "customers"],
    }

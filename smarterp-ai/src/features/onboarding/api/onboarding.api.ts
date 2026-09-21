import { apiClient } from '../../../lib/axios'
import type { OnboardingData } from '../types/onboarding.types'

// Le format Django (snake_case) reste à la frontière de l’application.
export function toOnboardingPayload(data: OnboardingData) {
  return {
    company: {
      name: data.company.name,
      legal_name: data.company.legalName,
      logo: data.company.logo || null,
      tax_id: data.company.taxId,
      email: data.company.email,
      phone: data.company.phone,
      website: data.company.website,
      address: data.company.address,
      city: data.company.city,
      postal_code: data.company.postalCode,
      country: data.company.country,
      currency: data.finance.currency,
    },
    business: {
      industry: data.business.industry,
      business_type: data.business.businessType,
      main_activity: data.business.mainActivity,
      size: data.business.size,
      employee_count: data.business.employeeCount ?? null,
      description: data.business.description,
    },
    finance: {
      currency: data.finance.currency,
      tax_system: data.finance.taxSystem,
      vat_rate: data.finance.vatRate,
      fiscal_year_start: data.finance.fiscalYearStart,
      fiscal_year_end: data.finance.fiscalYearEnd,
      payment_terms: data.finance.paymentTerms,
    },
    inventory: data.inventory.enabled
      ? {
          enabled: true,
          warehouse_name: data.inventory.warehouseName,
          warehouse_code: data.inventory.warehouseCode,
          warehouse_address: data.inventory.warehouseAddress,
          multi_warehouse: data.inventory.multiWarehouse,
          valuation_method: data.inventory.valuationMethod,
          low_stock_alerts: data.inventory.lowStockAlerts,
          default_unit: data.inventory.defaultUnit,
        }
      : { enabled: false },
    invoicing: {
      invoice_prefix: data.invoicing.invoicePrefix,
      invoice_start: data.invoicing.invoiceStart,
      quote_prefix: data.invoicing.quotePrefix,
      quote_start: data.invoicing.quoteStart,
      purchase_order_prefix: data.invoicing.purchaseOrderPrefix,
      payment_terms: data.invoicing.paymentTerms,
      footer: data.invoicing.footer,
      language: data.invoicing.language,
      show_vat: data.invoicing.showVat,
    },
    modules: data.inventory.enabled
      ? data.modules
      : data.modules.filter((id) => id !== 'inventory' && id !== 'warehouses'),
  }
}

export async function saveOnboarding(data: OnboardingData): Promise<void> {
  // Modifier cet endpoint lorsque le contrat Django sera finalisé.
  await apiClient.post('/company/onboarding/', toOnboardingPayload(data))
}

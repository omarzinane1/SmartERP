# SmartERP AI

**SmartERP AI** is an intelligent Enterprise Resource Planning platform designed to help companies manage their daily operations while providing advanced business intelligence and AI-assisted decision support.

The goal of the project is to go beyond a traditional ERP by combining operational management with analytics, anomaly detection, forecasting, document intelligence, and AI recommendations.

> **Understand. Control. Grow.**

---

## About the Project

SmartERP AI centralizes the main activities of a company inside a single platform.

It is designed for businesses such as:

* SMEs
* Distribution companies
* Industrial companies
* Service companies
* Agencies
* Construction companies
* Retail businesses
* Restaurants

The platform can manage areas such as:

* Sales
* Customers
* Suppliers
* Purchasing
* Products
* Inventory
* Warehouses
* Invoices
* Payments
* Expenses
* Cash Flow
* Reports
* Documents
* Users and Permissions

---

## The Concept

A traditional ERP mainly stores and organizes business data.

**SmartERP AI** is designed to also understand and analyze that data.

The system can help answer questions such as:

* How is the company performing?
* Why is the profit margin decreasing?
* Which customers have overdue invoices?
* Which products may run out of stock soon?
* Which suppliers are becoming more expensive?
* What risks could affect cash flow?
* Which business opportunities should management focus on?

The platform combines several concepts:

```text
ERP
+
Business Intelligence
+
Artificial Intelligence
+
Forecasting
+
Decision Support
```

---

## SmartERP AI Intelligence

The intelligent layer of the platform is based on four main types of information.

### Facts

Business information calculated directly from ERP data.

Example:

```text
Overdue invoices: 73,500 MAD
```

### AI Analysis

The AI explains patterns or changes found in the data.

Example:

```text
The decrease in gross margin may be related to higher supplier costs
and increased customer discounts.
```

### Forecasts

Statistical models estimate possible future situations.

Examples:

* Sales forecast
* Revenue forecast
* Product demand forecast
* Stockout risk
* Customer payment forecast
* Cash flow forecast

### Recommendations

SmartERP AI can suggest actions based on detected situations.

Example:

```text
Consider replenishing product PRD-204 before the expected stockout date.
```

Sensitive actions remain under human control and require approval.

---

## AI Control Center

One of the main features of SmartERP AI is the **AI Control Center**.

It acts as an intelligent monitoring system for the company.

It can analyze areas such as:

* Finance
* Sales
* Inventory
* Customers
* Suppliers
* Purchasing
* Operations

The system can detect:

* Anomalies
* Risks
* Performance degradation
* Unusual behavior
* Forecast risks
* Business opportunities

The objective is to help managers quickly understand:

```text
What happened?
      ↓
Why did it happen?
      ↓
What could happen next?
      ↓
What is the possible impact?
      ↓
What action should be considered?
```

---

## AI Assistant

SmartERP AI also includes an **AI Assistant** that allows users to interact with business information using natural language.

Examples:

```text
Analyze this month's sales.
```

```text
Which customers have overdue invoices?
```

```text
Why did the margin decrease?
```

```text
Which products are at risk of stockout?
```

```text
Summarize this contract.
```

The assistant uses only data the user is authorized to access.

---

## Document Intelligence

SmartERP AI can analyze business documents such as:

* Contracts
* Invoices
* Procedures
* Reports
* PDF files
* Word documents
* Excel files

The system can provide:

* Document summaries
* Information extraction
* Question answering
* Source references
* Risk detection
* Contract analysis

A **RAG** approach is used for unstructured documents.

Structured ERP data is accessed through secure business services instead of direct LLM database access.

---

# Technology Stack

## Frontend

The frontend is built with:

* React
* TypeScript
* Vite
* Tailwind CSS
* React Router
* TanStack Query
* Axios
* Zustand
* React Hook Form
* Zod
* Recharts
* Lucide React

The interface follows a modern professional ERP style focused on clarity, productivity, and high information density.

---

## Backend

The backend is planned with:

* Python
* Django
* Django REST Framework
* PostgreSQL
* pgvector
* Celery
* Valkey

Django handles:

* Authentication
* Business logic
* Permissions
* API endpoints
* Data validation
* Company isolation
* ERP operations
* Approval workflows
* Audit logs

---

## AI & Data

The intelligent layer uses open-source and local technologies as much as possible.

Main technologies:

* Ollama
* Ministral
* Qwen
* LangGraph
* LangChain
* BGE-M3
* PostgreSQL + pgvector
* Docling
* Pandas
* NumPy
* scikit-learn
* statsmodels

These technologies are used for:

* AI orchestration
* RAG
* Embeddings
* Document parsing
* Data analysis
* Anomaly detection
* Forecasting
* Business intelligence

---

# Main Modules

SmartERP AI is planned around the following main modules.

## Overview

* Executive Dashboard
* AI Control Center

## Sales

* Customers
* Quotes
* Sales Orders
* Invoices
* Payments

## Purchasing

* Suppliers
* Purchase Orders
* Supplier Invoices

## Inventory

* Products
* Inventory
* Warehouses
* Stock Transfers

## Finance

* Expenses
* Cash Flow
* Reports

## Intelligence

* Documents
* AI Assistant
* Forecasting
* AI Opportunities

## Administration

* Approval Center
* Users
* Roles & Permissions
* Audit Logs
* Modules
* Settings

---

# Security Principles

SmartERP AI is designed with several important security principles:

* Role-based access control
* Permission-based data access
* Multi-company data isolation
* Audit logging
* Human approval for sensitive AI actions
* Secure authentication
* No direct LLM access to the database
* AI access limited by user permissions

---

# Project Goal

The goal of SmartERP AI is to transform ERP data into useful business intelligence.

The general concept is:

```text
Business Data
     ↓
ERP Management
     ↓
Business Intelligence
     ↓
Anomaly Detection
     ↓
Forecasting
     ↓
AI Analysis
     ↓
Recommendations
     ↓
Human Decision
```

SmartERP AI is not intended to replace managers.

Its purpose is to provide them with:

* Better information
* Better visibility
* Better monitoring
* Better risk detection
* Better forecasting
* Better decision support

---

# Author

**Omar Zinane**

Full Stack Developer & AI Engineering Student

---

# Project Status

SmartERP AI is currently under active development.

The first development phase focuses on:

* Authentication
* Company Onboarding
* Executive Dashboard
* AI Control Center

More ERP and AI modules will be added progressively.

---

# SmartERP AI

> **Understand your business. Control your operations. Make better decisions.**

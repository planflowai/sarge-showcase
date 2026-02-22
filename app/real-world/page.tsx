"use client";

import { useState } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { getTestTheme } from "@/lib/types";
import {
  Building2,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Users,
  Scale,
  FileCheck,
  Receipt,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StaffMember {
  name: string;
  title: string;
  role: "partner" | "senior" | "staff" | "admin" | "bookkeeper";
  approvalLimits: {
    expense: number;
    vendorInvoice: number;
    clientInvoice: number;
  };
}

interface TruthAnchor {
  id: string;
  title: string;
  content: string;
}

interface Company {
  name: string;
  location: string;
  size: number;
  industry: string;
  staff: StaffMember[];
  truthAnchors: TruthAnchor[];
}

type ViolationType =
  | "none" // Valid document
  | "arithmetic_error" // Wrong totals, math mistakes
  | "unauthorized_approver" // Person doesn't have authority for amount
  | "self_approval" // Person approved their own submission
  | "missing_required_field" // Missing invoice number, date, etc.
  | "invalid_code_format" // Bad client/vendor/project code format
  | "exceeds_limit" // Amount exceeds policy limit
  | "date_logic_error" // Future date, due date before invoice date, etc.
  | "non_reimbursable_item" // Expense for non-allowed category
  | "rate_mismatch" // Wrong hourly rate for role
  | "unknown_person"; // Name not in staff roster

interface GeneratedDocument {
  id: string;
  type: "client-invoice" | "vendor-invoice" | "expense-report";
  content: string;
  // Ground truth (hidden until reveal)
  isValid: boolean;
  violationType: ViolationType;
  violationDetail?: string;
  // Difficulty rating for scoring
  difficulty: "obvious" | "moderate" | "subtle";
}

interface EvaluationResult {
  documentId: string;
  sargeDecision: "valid" | "invalid" | "uncertain";
  sargeReasoning: string;
  violationsCited: string[];
  confidence: number; // 0-100
  checks?: Record<string, string>; // Raw checks from model
}

interface RunResult {
  documents: GeneratedDocument[];
  evaluations: EvaluationResult[];
  groundTruthRevealed: boolean;
  stats: {
    total: number;
    truePositives: number;
    trueNegatives: number;
    falsePositives: number;
    falseNegatives: number;
    accuracy: number;
  };
}

// ─── Default Company Template ────────────────────────────────────────────────

const DEFAULT_COMPANY: Company = {
  name: "Summit Ridge Accounting, LLC",
  location: "Raleigh, NC",
  size: 11,
  industry: "Accounting / Tax Preparation",
  staff: [
    {
      name: "Elizabeth Harper, CPA",
      title: "Partner",
      role: "partner",
      approvalLimits: { expense: Infinity, vendorInvoice: Infinity, clientInvoice: Infinity },
    },
    {
      name: "Michael Torres, CPA",
      title: "Partner",
      role: "partner",
      approvalLimits: { expense: Infinity, vendorInvoice: Infinity, clientInvoice: Infinity },
    },
    {
      name: "Priya Patel, CPA",
      title: "Senior Accountant",
      role: "senior",
      approvalLimits: { expense: 750, vendorInvoice: 5000, clientInvoice: 3000 },
    },
    {
      name: "David Nguyen, CPA",
      title: "Senior Accountant",
      role: "senior",
      approvalLimits: { expense: 750, vendorInvoice: 5000, clientInvoice: 3000 },
    },
    {
      name: "Lauren Brooks, CPA",
      title: "Senior Accountant",
      role: "senior",
      approvalLimits: { expense: 750, vendorInvoice: 5000, clientInvoice: 3000 },
    },
    {
      name: "James Carter",
      title: "Staff Accountant",
      role: "staff",
      approvalLimits: { expense: 250, vendorInvoice: 1000, clientInvoice: 0 },
    },
    {
      name: "Sofia Ramirez",
      title: "Staff Accountant",
      role: "staff",
      approvalLimits: { expense: 250, vendorInvoice: 1000, clientInvoice: 0 },
    },
    {
      name: "Ethan Kim",
      title: "Staff Accountant",
      role: "staff",
      approvalLimits: { expense: 250, vendorInvoice: 1000, clientInvoice: 0 },
    },
    {
      name: "Maria Lopez",
      title: "Staff Accountant",
      role: "staff",
      approvalLimits: { expense: 250, vendorInvoice: 1000, clientInvoice: 0 },
    },
    {
      name: "Rebecca Hayes",
      title: "Billing Coordinator / Admin",
      role: "admin",
      approvalLimits: { expense: 0, vendorInvoice: 0, clientInvoice: 1500 },
    },
    {
      name: "Thomas Reed",
      title: "Bookkeeper",
      role: "bookkeeper",
      approvalLimits: { expense: 100, vendorInvoice: 500, clientInvoice: 0 },
    },
  ],
  truthAnchors: [],
};

// ─── Document Generation Helpers ─────────────────────────────────────────────

// Random utilities
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min: number, max: number) => Math.round((Math.random() * (max - min) + min) * 100) / 100;
const formatCurrency = (n: number) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
const generateId = () => Math.random().toString(36).substring(2, 9);

// Sample data for document generation
const SAMPLE_CLIENTS = [
  { name: "Eastwood Manufacturing, Inc.", code: "CL-00142" },
  { name: "Sunrise Medical Group", code: "CL-00287" },
  { name: "Greenfield Properties, LLC", code: "CL-00451" },
  { name: "TechWave Solutions", code: "CL-00089" },
  { name: "Carolina Automotive Parts", code: "CL-00523" },
];

const SAMPLE_VENDORS = [
  { name: "Office Depot", code: "VEN-00012" },
  { name: "Adobe Systems", code: "VEN-00034" },
  { name: "Comcast Business", code: "VEN-00056" },
  { name: "Staples Business Advantage", code: "VEN-00078" },
  { name: "FedEx Office", code: "VEN-00091" },
];

const SERVICE_DESCRIPTIONS = [
  "Monthly bookkeeping services",
  "Quarterly tax planning consultation",
  "Annual tax return preparation",
  "Financial statement review",
  "Payroll processing services",
  "Business advisory meeting",
  "Audit preparation assistance",
];

const EXPENSE_CATEGORIES = {
  reimbursable: [
    { category: "Business Meal", desc: "Client lunch meeting", maxAmount: 75 },
    { category: "Office Supplies", desc: "Printer paper and toner", maxAmount: 150 },
    { category: "Mileage", desc: "Client site visit", maxAmount: 100 },
    { category: "Continuing Education", desc: "CPE webinar registration", maxAmount: 300 },
  ],
  nonReimbursable: [
    { category: "Entertainment", desc: "Concert tickets", maxAmount: 200 },
    { category: "Personal", desc: "Dry cleaning", maxAmount: 50 },
    { category: "Alcohol", desc: "Wine (no client present)", maxAmount: 80 },
    { category: "Commuting", desc: "Daily parking at office", maxAmount: 30 },
  ],
};

// Billing rates by role
const BILLING_RATES: Record<string, number> = {
  partner: 225,
  senior: 175,
  staff: 135,
  admin: 0, // Not billable
  bookkeeper: 0, // Not billable
};

// Generate a valid client invoice
function generateValidClientInvoice(company: Company): GeneratedDocument {
  const client = pick(SAMPLE_CLIENTS);
  const preparer = pick(company.staff.filter(s => s.role !== "bookkeeper"));
  const approvers = company.staff.filter(s =>
    s.name !== preparer.name &&
    (s.role === "partner" || s.role === "senior" || s.role === "admin")
  );
  const approver = pick(approvers);

  const invoiceNum = `INV-202601-${String(randInt(1, 999)).padStart(3, "0")}`;
  const invoiceDate = "January 15, 2026";
  const dueDate = "January 30, 2026";

  const hours = randFloat(2, 8);
  const rate = BILLING_RATES[preparer.role] || 135;
  const subtotal = Math.round(hours * rate * 100) / 100;
  const total = subtotal;

  const content = `
SUMMIT RIDGE ACCOUNTING, LLC
Invoice

Invoice Number: ${invoiceNum}
Invoice Date: ${invoiceDate}
Due Date: ${dueDate}

Bill To:
${client.name}
Client Code: ${client.code}

Services Rendered:
Description                              Hours    Rate       Amount
${pick(SERVICE_DESCRIPTIONS).padEnd(40)} ${hours.toFixed(1)}     ${formatCurrency(rate)}/hr  ${formatCurrency(subtotal)}

                                         Subtotal: ${formatCurrency(subtotal)}
                                         Total Due: ${formatCurrency(total)}

Payment Terms: Net 15

Prepared by: ${preparer.name} (${preparer.title})
Approved by: ${approver.name} (${approver.title})
`.trim();

  return {
    id: generateId(),
    type: "client-invoice",
    content,
    isValid: true,
    violationType: "none",
    difficulty: "obvious",
  };
}

// Generate an invalid client invoice with specific violation
function generateInvalidClientInvoice(company: Company, violation: ViolationType): GeneratedDocument {
  const client = pick(SAMPLE_CLIENTS);
  const preparer = pick(company.staff.filter(s => s.role !== "bookkeeper"));

  let approver = pick(company.staff.filter(s => s.name !== preparer.name));
  let invoiceNum = `INV-202601-${String(randInt(1, 999)).padStart(3, "0")}`;
  let invoiceDate = "January 15, 2026";
  let dueDate = "January 30, 2026";
  let hours = randFloat(2, 8);
  let rate = BILLING_RATES[preparer.role] || 135;
  let subtotal = Math.round(hours * rate * 100) / 100;
  let displayTotal = subtotal;
  let clientCode = client.code;
  let violationDetail = "";
  let difficulty: "obvious" | "moderate" | "subtle" = "moderate";

  switch (violation) {
    case "arithmetic_error":
      // Wrong total - add or subtract random amount
      displayTotal = subtotal + randInt(50, 200) * (Math.random() > 0.5 ? 1 : -1);
      violationDetail = `Total shows ${formatCurrency(displayTotal)} but should be ${formatCurrency(subtotal)}`;
      difficulty = "obvious";
      break;

    case "unauthorized_approver":
      // Bookkeeper approving high-value invoice
      const highAmount = randInt(4000, 8000);
      hours = Math.round(highAmount / rate * 10) / 10;
      subtotal = Math.round(hours * rate * 100) / 100;
      displayTotal = subtotal;
      approver = company.staff.find(s => s.role === "bookkeeper")!;
      violationDetail = `${approver.name} (bookkeeper) approved invoice of ${formatCurrency(displayTotal)}, exceeds $500 limit`;
      difficulty = "moderate";
      break;

    case "self_approval":
      approver = preparer;
      violationDetail = `${preparer.name} both prepared and approved the invoice`;
      difficulty = "obvious";
      break;

    case "missing_required_field":
      invoiceNum = "";
      violationDetail = "Invoice number is missing";
      difficulty = "obvious";
      break;

    case "invalid_code_format":
      clientCode = `CLIENT-${randInt(100, 999)}`; // Wrong format
      violationDetail = `Client code "${clientCode}" doesn't match required format CL-XXXXX`;
      difficulty = "moderate";
      break;

    case "date_logic_error":
      invoiceDate = "February 1, 2026";
      dueDate = "January 25, 2026"; // Due date before invoice date
      violationDetail = "Due date (January 25) is before invoice date (February 1)";
      difficulty = "subtle";
      break;

    case "rate_mismatch":
      const wrongRate = BILLING_RATES.partner; // Use partner rate for non-partner
      if (preparer.role !== "partner") {
        rate = wrongRate;
        subtotal = Math.round(hours * rate * 100) / 100;
        displayTotal = subtotal;
        violationDetail = `${preparer.name} (${preparer.title}) billed at $${wrongRate}/hr (Partner rate) instead of $${BILLING_RATES[preparer.role]}/hr`;
        difficulty = "subtle";
      }
      break;

    case "unknown_person":
      approver = { name: "Jennifer Williams, CPA", title: "Senior Accountant", role: "senior", approvalLimits: { expense: 0, vendorInvoice: 0, clientInvoice: 0 } };
      violationDetail = "Jennifer Williams, CPA is not in the staff roster";
      difficulty = "moderate";
      break;
  }

  const content = `
SUMMIT RIDGE ACCOUNTING, LLC
Invoice

Invoice Number: ${invoiceNum || "(not provided)"}
Invoice Date: ${invoiceDate}
Due Date: ${dueDate}

Bill To:
${client.name}
Client Code: ${clientCode}

Services Rendered:
Description                              Hours    Rate       Amount
${pick(SERVICE_DESCRIPTIONS).padEnd(40)} ${hours.toFixed(1)}     ${formatCurrency(rate)}/hr  ${formatCurrency(subtotal)}

                                         Subtotal: ${formatCurrency(subtotal)}
                                         Total Due: ${formatCurrency(displayTotal)}

Payment Terms: Net 15

Prepared by: ${preparer.name} (${preparer.title})
Approved by: ${approver.name} (${approver.title})
`.trim();

  return {
    id: generateId(),
    type: "client-invoice",
    content,
    isValid: false,
    violationType: violation,
    violationDetail,
    difficulty,
  };
}

// Generate a valid expense report
function generateValidExpenseReport(company: Company): GeneratedDocument {
  const employee = pick(company.staff.filter(s => s.role !== "partner"));
  const supervisors = company.staff.filter(s =>
    s.name !== employee.name &&
    (s.role === "partner" || s.role === "senior" || (s.role === "admin" && employee.role === "staff"))
  );
  const supervisor = pick(supervisors);

  const reportNum = `EXP-202601-${String(randInt(1, 99)).padStart(3, "0")}`;
  const numItems = randInt(2, 4);
  const items: { date: string; category: string; desc: string; amount: number }[] = [];

  for (let i = 0; i < numItems; i++) {
    const expense = pick(EXPENSE_CATEGORIES.reimbursable);
    items.push({
      date: `January ${randInt(1, 15)}, 2026`,
      category: expense.category,
      desc: expense.desc,
      amount: randFloat(20, expense.maxAmount),
    });
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  const itemLines = items.map(item =>
    `${item.date.padEnd(18)} ${item.category.padEnd(18)} ${item.desc.padEnd(30)} ${formatCurrency(item.amount)}`
  ).join("\n");

  const content = `
SUMMIT RIDGE ACCOUNTING, LLC
Expense Reimbursement Report

Report Number: ${reportNum}
Employee: ${employee.name}
Title: ${employee.title}
Period: January 1-15, 2026

Expenses:
Date               Category           Description                    Amount
${itemLines}

                                                          Total: ${formatCurrency(total)}

Employee Signature: ${employee.name}
Date Signed: January 16, 2026

Supervisor Approval: ${supervisor.name}
Approval Date: January 17, 2026
`.trim();

  return {
    id: generateId(),
    type: "expense-report",
    content,
    isValid: true,
    violationType: "none",
    difficulty: "obvious",
  };
}

// Generate an invalid expense report
function generateInvalidExpenseReport(company: Company, violation: ViolationType): GeneratedDocument {
  const employee = pick(company.staff.filter(s => s.role !== "partner"));
  let supervisor = pick(company.staff.filter(s => s.name !== employee.name));

  const reportNum = `EXP-202601-${String(randInt(1, 99)).padStart(3, "0")}`;
  let items: { date: string; category: string; desc: string; amount: number }[] = [];
  let violationDetail = "";
  let difficulty: "obvious" | "moderate" | "subtle" = "moderate";
  let displayTotal = 0;
  let employeeSig = employee.name;

  // Generate base items
  const numItems = randInt(2, 4);
  for (let i = 0; i < numItems; i++) {
    const expense = pick(EXPENSE_CATEGORIES.reimbursable);
    items.push({
      date: `January ${randInt(1, 15)}, 2026`,
      category: expense.category,
      desc: expense.desc,
      amount: randFloat(20, expense.maxAmount),
    });
  }

  switch (violation) {
    case "arithmetic_error":
      displayTotal = items.reduce((sum, item) => sum + item.amount, 0) + randFloat(15, 50);
      violationDetail = `Total is incorrect - items sum to ${formatCurrency(items.reduce((sum, item) => sum + item.amount, 0))} but report shows ${formatCurrency(displayTotal)}`;
      difficulty = "obvious";
      break;

    case "self_approval":
      supervisor = employee;
      displayTotal = items.reduce((sum, item) => sum + item.amount, 0);
      violationDetail = `${employee.name} approved their own expense report`;
      difficulty = "obvious";
      break;

    case "non_reimbursable_item":
      const badExpense = pick(EXPENSE_CATEGORIES.nonReimbursable);
      items.push({
        date: `January ${randInt(1, 15)}, 2026`,
        category: badExpense.category,
        desc: badExpense.desc,
        amount: randFloat(20, badExpense.maxAmount),
      });
      displayTotal = items.reduce((sum, item) => sum + item.amount, 0);
      violationDetail = `"${badExpense.category}" (${badExpense.desc}) is a non-reimbursable expense`;
      difficulty = "moderate";
      break;

    case "exceeds_limit":
      // Add expensive meal over the $75 limit
      items = [{
        date: "January 10, 2026",
        category: "Business Meal",
        desc: "Team dinner at steakhouse",
        amount: 145.00,
      }];
      displayTotal = 145.00;
      violationDetail = "Business meal of $145.00 exceeds $75 per person limit";
      difficulty = "subtle";
      break;

    case "unauthorized_approver":
      // Staff accountant can only approve up to $250
      items = [
        { date: "January 5, 2026", category: "Mileage", desc: "Multiple client visits", amount: 180.00 },
        { date: "January 12, 2026", category: "Office Supplies", desc: "Office equipment", amount: 190.00 },
      ];
      displayTotal = 370.00;
      supervisor = company.staff.find(s => s.role === "staff")!;
      violationDetail = `${supervisor.name} (Staff Accountant) approved ${formatCurrency(displayTotal)}, exceeds $250 limit`;
      difficulty = "subtle";
      break;

    case "missing_required_field":
      displayTotal = items.reduce((sum, item) => sum + item.amount, 0);
      employeeSig = "";
      violationDetail = "Employee signature is missing";
      difficulty = "obvious";
      break;

    case "unknown_person":
      supervisor = { name: "Robert Chen", title: "Manager", role: "senior", approvalLimits: { expense: 0, vendorInvoice: 0, clientInvoice: 0 } };
      displayTotal = items.reduce((sum, item) => sum + item.amount, 0);
      violationDetail = "Robert Chen is not in the staff roster";
      difficulty = "moderate";
      break;
  }

  if (displayTotal === 0) {
    displayTotal = items.reduce((sum, item) => sum + item.amount, 0);
  }

  const itemLines = items.map(item =>
    `${item.date.padEnd(18)} ${item.category.padEnd(18)} ${item.desc.padEnd(30)} ${formatCurrency(item.amount)}`
  ).join("\n");

  const content = `
SUMMIT RIDGE ACCOUNTING, LLC
Expense Reimbursement Report

Report Number: ${reportNum}
Employee: ${employee.name}
Title: ${employee.title}
Period: January 1-15, 2026

Expenses:
Date               Category           Description                    Amount
${itemLines}

                                                          Total: ${formatCurrency(displayTotal)}

Employee Signature: ${employeeSig || "(unsigned)"}
Date Signed: January 16, 2026

Supervisor Approval: ${supervisor.name}
Approval Date: January 17, 2026
`.trim();

  return {
    id: generateId(),
    type: "expense-report",
    content,
    isValid: false,
    violationType: violation,
    violationDetail,
    difficulty,
  };
}

// Generate a valid vendor invoice
function generateValidVendorInvoice(company: Company): GeneratedDocument {
  const vendor = pick(SAMPLE_VENDORS);
  const amount = randFloat(100, 800);
  const approvers = company.staff.filter(s =>
    s.approvalLimits.vendorInvoice >= amount
  );
  const approver = pick(approvers);

  const invoiceNum = `${vendor.name.substring(0, 3).toUpperCase()}-${randInt(10000, 99999)}`;

  const content = `
VENDOR INVOICE - FOR PAYMENT

Vendor: ${vendor.name}
Vendor Code: ${vendor.code}
Invoice #: ${invoiceNum}
Invoice Date: January 10, 2026
Due Date: January 25, 2026

Description: Office supplies and materials
Quantity: 1
Amount: ${formatCurrency(amount)}

Payment Terms: Net 15
Remit To: ${vendor.name}, Accounts Receivable

--- INTERNAL USE ONLY ---
Received by: Rebecca Hayes (Admin)
Date Received: January 12, 2026
Approved for Payment: ${approver.name} (${approver.title})
Approval Date: January 13, 2026
`.trim();

  return {
    id: generateId(),
    type: "vendor-invoice",
    content,
    isValid: true,
    violationType: "none",
    difficulty: "obvious",
  };
}

// Generate an invalid vendor invoice
function generateInvalidVendorInvoice(company: Company, violation: ViolationType): GeneratedDocument {
  const vendor = pick(SAMPLE_VENDORS);
  let amount = randFloat(100, 800);
  let approver = pick(company.staff);
  let vendorCode = vendor.code;
  let invoiceNum = `${vendor.name.substring(0, 3).toUpperCase()}-${randInt(10000, 99999)}`;
  let invoiceDate = "January 10, 2026";
  let dueDate = "January 25, 2026";
  let violationDetail = "";
  let difficulty: "obvious" | "moderate" | "subtle" = "moderate";

  switch (violation) {
    case "unauthorized_approver":
      // High amount with low-authority approver
      amount = randFloat(2000, 4000);
      approver = company.staff.find(s => s.role === "staff")!;
      violationDetail = `${approver.name} (Staff Accountant) approved ${formatCurrency(amount)}, exceeds $1,000 limit`;
      difficulty = "moderate";
      break;

    case "invalid_code_format":
      vendorCode = `V-${randInt(100, 999)}`; // Wrong format
      violationDetail = `Vendor code "${vendorCode}" doesn't match required format VEN-XXXXX`;
      difficulty = "moderate";
      break;

    case "exceeds_limit":
      amount = 6500.00;
      approver = company.staff.find(s => s.role === "senior")!;
      violationDetail = `${approver.name} (Senior Accountant) approved ${formatCurrency(amount)}, exceeds $5,000 limit - requires Partner`;
      difficulty = "subtle";
      break;

    case "missing_required_field":
      invoiceNum = "";
      violationDetail = "Vendor invoice number is missing";
      difficulty = "obvious";
      break;

    case "date_logic_error":
      invoiceDate = "January 30, 2026";
      dueDate = "January 20, 2026"; // Due before invoice
      violationDetail = "Due date (January 20) is before invoice date (January 30)";
      difficulty = "subtle";
      break;

    case "unknown_person":
      approver = { name: "Amanda Foster", title: "Accounting Manager", role: "senior", approvalLimits: { expense: 0, vendorInvoice: 0, clientInvoice: 0 } };
      violationDetail = "Amanda Foster is not in the staff roster";
      difficulty = "moderate";
      break;
  }

  const content = `
VENDOR INVOICE - FOR PAYMENT

Vendor: ${vendor.name}
Vendor Code: ${vendorCode}
Invoice #: ${invoiceNum || "(missing)"}
Invoice Date: ${invoiceDate}
Due Date: ${dueDate}

Description: Office supplies and materials
Quantity: 1
Amount: ${formatCurrency(amount)}

Payment Terms: Net 15
Remit To: ${vendor.name}, Accounts Receivable

--- INTERNAL USE ONLY ---
Received by: Rebecca Hayes (Admin)
Date Received: January 12, 2026
Approved for Payment: ${approver.name} (${approver.title})
Approval Date: January 13, 2026
`.trim();

  return {
    id: generateId(),
    type: "vendor-invoice",
    content,
    isValid: false,
    violationType: violation,
    violationDetail,
    difficulty,
  };
}

// Violation types applicable to each document type
const INVOICE_VIOLATIONS: ViolationType[] = [
  "arithmetic_error",
  "unauthorized_approver",
  "self_approval",
  "missing_required_field",
  "invalid_code_format",
  "date_logic_error",
  "rate_mismatch",
  "unknown_person",
];

const EXPENSE_VIOLATIONS: ViolationType[] = [
  "arithmetic_error",
  "self_approval",
  "non_reimbursable_item",
  "exceeds_limit",
  "unauthorized_approver",
  "missing_required_field",
  "unknown_person",
];

const VENDOR_VIOLATIONS: ViolationType[] = [
  "unauthorized_approver",
  "invalid_code_format",
  "exceeds_limit",
  "missing_required_field",
  "date_logic_error",
  "unknown_person",
];

// Generate a batch of documents with mix of valid/invalid
function generateDocumentBatch(
  company: Company,
  count: number = 6,
  invalidRatio: number = 0.5
): GeneratedDocument[] {
  const documents: GeneratedDocument[] = [];
  const invalidCount = Math.floor(count * invalidRatio);
  const validCount = count - invalidCount;

  // Document type distribution
  const types: ("client-invoice" | "vendor-invoice" | "expense-report")[] = [
    "client-invoice", "client-invoice",
    "vendor-invoice", "vendor-invoice",
    "expense-report", "expense-report",
  ];

  // Generate valid documents
  for (let i = 0; i < validCount; i++) {
    const type = types[i % types.length];
    switch (type) {
      case "client-invoice":
        documents.push(generateValidClientInvoice(company));
        break;
      case "expense-report":
        documents.push(generateValidExpenseReport(company));
        break;
      case "vendor-invoice":
        documents.push(generateValidVendorInvoice(company));
        break;
    }
  }

  // Generate invalid documents
  for (let i = 0; i < invalidCount; i++) {
    const type = types[(validCount + i) % types.length];
    let violation: ViolationType;

    switch (type) {
      case "client-invoice":
        violation = pick(INVOICE_VIOLATIONS);
        documents.push(generateInvalidClientInvoice(company, violation));
        break;
      case "expense-report":
        violation = pick(EXPENSE_VIOLATIONS);
        documents.push(generateInvalidExpenseReport(company, violation));
        break;
      case "vendor-invoice":
        violation = pick(VENDOR_VIOLATIONS);
        documents.push(generateInvalidVendorInvoice(company, violation));
        break;
    }
  }

  // Shuffle documents
  return documents.sort(() => Math.random() - 0.5);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RealWorldPage() {
  // Theme
  const mainTheme = useSettingsStore((s) => s.theme);
  const darkMode = mainTheme === "dark";
  const theme = getTestTheme(darkMode);

  // State
  const [company, setCompany] = useState<Company | null>(null);
  const [isGeneratingCompany, setIsGeneratingCompany] = useState(false);
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [expandedAnchors, setExpandedAnchors] = useState<Set<string>>(new Set());
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocument[]>([]);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [docCount, setDocCount] = useState(6);
  const [invalidRatio, setInvalidRatio] = useState(0.5);
  const [evaluations, setEvaluations] = useState<EvaluationResult[]>([]);
  const [currentEvalIndex, setCurrentEvalIndex] = useState(-1);
  const [showGroundTruth, setShowGroundTruth] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Generate full evaluation report text
  const generateEvaluationReport = (): string => {
    if (!company || evaluations.length === 0) return "";

    const stats = calculateStats();
    let report = `SARGE Real World Evaluation Report
========================================
Company: ${company.name}
Date: ${new Date().toISOString()}
Documents Evaluated: ${generatedDocs.length}

`;

    if (stats) {
      report += `ACCURACY SCORECARD
------------------
Overall Accuracy: ${stats.accuracy}%
True Positives: ${stats.truePositives}
True Negatives: ${stats.trueNegatives}
False Positives: ${stats.falsePositives}
False Negatives: ${stats.falseNegatives}

`;
    }

    report += `DETAILED RESULTS
----------------
`;

    generatedDocs.forEach((doc, idx) => {
      const eval_ = evaluations.find((e) => e.documentId === doc.id);
      if (!eval_) return;

      const predicted = eval_.sargeDecision === "invalid";
      const actual = !doc.isValid;
      const correct = (predicted && actual) || (!predicted && !actual);
      const outcome = correct ? "CORRECT" : (predicted ? "FALSE POSITIVE" : "FALSE NEGATIVE");

      report += `
Document #${idx + 1}: ${doc.type}
  SARGE Decision: ${eval_.sargeDecision.toUpperCase()} (${eval_.confidence}% confidence)
  Actual Status: ${doc.isValid ? "VALID" : "INVALID"}
  Outcome: ${outcome}
  Difficulty: ${doc.difficulty}
  Reasoning: ${eval_.sargeReasoning}
`;

      if (eval_.violationsCited.length > 0) {
        report += `  Violations Cited:\n`;
        eval_.violationsCited.forEach((v) => {
          report += `    - ${v}\n`;
        });
      }

      if (!doc.isValid && doc.violationDetail) {
        report += `  Actual Violation: ${doc.violationDetail}\n`;
      }

      report += `
--- DOCUMENT CONTENT ---
${doc.content}
------------------------

`;
    });

    return report;
  };

  // Generate single document evaluation text
  const generateSingleDocReport = (docIdx: number): string => {
    const doc = generatedDocs[docIdx];
    const eval_ = evaluations.find((e) => e.documentId === doc.id);
    if (!doc || !eval_) return "";

    const predicted = eval_.sargeDecision === "invalid";
    const actual = !doc.isValid;
    const correct = (predicted && actual) || (!predicted && !actual);
    const outcome = correct ? "CORRECT" : (predicted ? "FALSE POSITIVE" : "FALSE NEGATIVE");

    let report = `Document #${docIdx + 1}: ${doc.type}
========================================
SARGE Decision: ${eval_.sargeDecision.toUpperCase()} (${eval_.confidence}% confidence)
Actual Status: ${doc.isValid ? "VALID" : "INVALID"}
Outcome: ${outcome}
Difficulty: ${doc.difficulty}

REASONING:
${eval_.sargeReasoning}

`;

    if (eval_.checks) {
      report += `SARGE CHECKS:\n`;
      Object.entries(eval_.checks).forEach(([key, value]) => {
        const valueStr = typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : String(value);
        report += `  ${key}: ${valueStr}\n`;
      });
      report += `\n`;
    }

    if (eval_.violationsCited.length > 0) {
      report += `VIOLATIONS CITED:\n`;
      eval_.violationsCited.forEach((v) => {
        report += `  - ${v}\n`;
      });
      report += `\n`;
    }

    if (!doc.isValid && doc.violationDetail) {
      report += `ACTUAL VIOLATION:\n${doc.violationDetail}\n\n`;
    }

    report += `DOCUMENT CONTENT:
${doc.content}
`;

    return report;
  };

  // LLM access
  const streamLLM = useTestModeStore((s) => s.streamLLM);
  const slots = useTestModeStore((s) => s.slots);
  const source = "local" as const;

  const getSlotModel = (index: number): string => {
    const slot = slots[index];
    return slot?.model || "llama3.2:3b";
  };

  // Toggle anchor expansion
  const toggleAnchor = (id: string) => {
    setExpandedAnchors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle document expansion
  const toggleDoc = (id: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Generate documents
  const handleGenerateDocuments = () => {
    if (!company) return;
    setIsGeneratingDocs(true);
    setRunResult(null);
    setEvaluations([]);

    // Generate documents (this is instant since it's template-based)
    const docs = generateDocumentBatch(company, docCount, invalidRatio);
    setGeneratedDocs(docs);
    setExpandedDocs(new Set()); // Collapse all by default
    setIsGeneratingDocs(false);
  };

  // Run SARGE evaluation on all documents
  const handleRunEvaluation = async () => {
    if (!company || generatedDocs.length === 0) return;
    setIsEvaluating(true);
    setShowGroundTruth(false);
    setEvaluations([]);

    const results: EvaluationResult[] = [];

    // Build truth anchor context (what SARGE knows about)
    const truthContext = company.truthAnchors
      .map((a) => `=== ${a.title} ===\n${a.content}`)
      .join("\n\n");

    for (let i = 0; i < generatedDocs.length; i++) {
      setCurrentEvalIndex(i);
      const doc = generatedDocs[i];

      try {
        // LOCKED EVALUATION PROCEDURE - DO NOT MODIFY
        const prompt = `You are auditing a business document. Follow this EXACT procedure.

=== STAFF ROSTER (ONLY these names are valid) ===
Elizabeth Harper, CPA | Michael Torres, CPA | Priya Patel, CPA | David Nguyen, CPA | Lauren Brooks, CPA | James Carter | Sofia Ramirez | Ethan Kim | Maria Lopez | Rebecca Hayes | Thomas Reed

=== APPROVAL LIMITS BY ROLE ===
Partner (Harper, Torres): UNLIMITED
Senior (Patel, Nguyen, Brooks): expense≤$750, vendor≤$5000, client≤$3000
Staff (Carter, Ramirez, Kim, Lopez): expense≤$250, vendor≤$1000
Admin (Hayes): client≤$1500
Bookkeeper (Reed): vendor≤$500, expense≤$100

=== DOCUMENT TO AUDIT ===
${doc.content}

=== MANDATORY CHECKLIST - COMPLETE EVERY ITEM ===

CHECK 1 - DOCUMENT NUMBER:
Look at the invoice/report number field. Does it contain "(missing)" or "(not provided)" or is it blank?
→ If yes: "NO: number is missing/not provided"
→ If a number is present: "YES"

CHECK 2 - CODE FORMAT:
Look for client code or vendor code.
→ Client codes MUST be CL-XXXXX (CL- then 5 digits)
→ Vendor codes MUST be VEN-XXXXX (VEN- then 5 digits)
→ If format is wrong (like V-123, CLIENT-456): "NO: [code] wrong format"
→ If format is correct or no code present: "YES"

CHECK 3 - ARITHMETIC:
Find all line item amounts. Add them up. Compare to the stated total.
→ Show your work: [amount1] + [amount2] + ... = [sum]
→ If sum ≠ stated total: "NO: sum=$X but total says $Y"
→ If they match: "YES"

CHECK 4 - STAFF ROSTER:
Find EVERY person named (preparer, approver, employee, supervisor).
Check each name against the roster above.
→ If ANY name is NOT in roster: "NO: [name] not in roster"
→ If ALL names are in roster: "YES"

CHECK 5 - SELF-APPROVAL:
Compare preparer/employee name to approver/supervisor name.
→ If SAME person: "NO: [name] approved own work"
→ If DIFFERENT people: "YES"

CHECK 6 - APPROVAL AUTHORITY:
Find the approver and the document amount.
Look up their limit for this document type.
→ If amount > limit: "NO: [name] limit is $X but amount is $Y"
→ If amount ≤ limit: "YES"

CHECK 7 - DATE LOGIC:
Compare invoice date to due date (if present).
→ If due date is BEFORE invoice date: "NO: due [date1] before invoice [date2]"
→ If due date is on or after: "YES"

=== OUTPUT FORMAT (JSON only) ===
{
  "check1_number": "YES or NO: reason",
  "check2_format": "YES or NO: reason",
  "check3_math": "YES: [your calculation] or NO: reason",
  "check4_roster": "YES or NO: [name] not in roster",
  "check5_self": "YES or NO: reason",
  "check6_limits": "YES or NO: reason",
  "check7_dates": "YES or NO: reason",
  "decision": "valid or invalid",
  "reasoning": "summary"
}

=== DECISION RULE ===
Count your answers above.
- ALL checks YES → "decision": "valid"
- ANY check NO → "decision": "invalid"

DO NOT decide until you complete all 7 checks. Output JSON only.`;

        // Call the chat API
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            provider: source === "local" ? "ollama" : "openai",
            model: getSlotModel(0),
          }),
        });

        if (!response.ok) throw new Error("API request failed");

        const data = await response.json();
        const content = data.content || data.message?.content || "";

        // Parse LLM response
        let parsed: {
          decision: "valid" | "invalid";
          confidence: number;
          reasoning: string;
          violations: string[];
          checks?: Record<string, string>;
        };

        try {
          // Try to extract JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const raw = JSON.parse(jsonMatch[0]);
            // Normalize decision to lowercase
            const decision = String(raw.decision || "").toLowerCase();
            // Helper to convert any value to string
            const toStr = (v: unknown): string => {
              if (typeof v === "object" && v !== null) return JSON.stringify(v);
              return String(v);
            };

            // Ensure violations are strings
            const violations = Array.isArray(raw.violations)
              ? raw.violations.map((v: unknown) => toStr(v))
              : [];

            // Ensure reasoning is string
            const reasoning = typeof raw.reasoning === "object"
              ? JSON.stringify(raw.reasoning)
              : String(raw.reasoning || "");

            parsed = {
              decision: decision === "invalid" ? "invalid" : "valid",
              confidence: raw.confidence || 50,
              reasoning,
              violations,
              checks: raw.checks,
            };

            // Extract all check values (check1_, check2_, etc. or any key with check/q in it)
            const checkEntries = Object.entries(raw).filter(([k]) =>
              k.startsWith("check") || k.startsWith("q") || k.includes("_")
            );

            // Store checks for display
            parsed.checks = {};
            checkEntries.forEach(([k, v]) => {
              parsed.checks![k] = toStr(v);
            });

            // Count YES/NO
            const checkValues = checkEntries.map(([, v]) => toStr(v));
            const noCount = checkValues.filter(v =>
              v.toUpperCase().startsWith("NO") ||
              v.toUpperCase().includes(": NO") ||
              v.toUpperCase().startsWith("FAIL")
            ).length;
            const yesCount = checkValues.filter(v =>
              v.toUpperCase().startsWith("YES") ||
              v.toUpperCase().startsWith("PASS")
            ).length;

            console.log(`[SARGE] Doc ${i + 1}: Checks found: ${checkValues.length}, NOs: ${noCount}, YESes: ${yesCount}, Model decision: ${decision}`);
            checkEntries.forEach(([k, v]) => console.log(`  ${k}: ${toStr(v).substring(0, 50)}`));

            // STRICT OVERRIDE: Decision MUST match check results
            if (noCount > 0) {
              if (parsed.decision !== "invalid") {
                console.log(`[SARGE] OVERRIDE → INVALID (${noCount} checks failed)`);
              }
              parsed.decision = "invalid";
              // Extract failure reasons for violations
              const failures = checkEntries
                .filter(([, v]) => toStr(v).toUpperCase().startsWith("NO"))
                .map(([k, v]) => `${k}: ${toStr(v)}`);
              if (failures.length > 0 && parsed.violations.length === 0) {
                parsed.violations = failures;
              }
            } else if (yesCount > 0 && noCount === 0) {
              if (parsed.decision !== "valid") {
                console.log(`[SARGE] OVERRIDE → VALID (all ${yesCount} checks passed)`);
              }
              parsed.decision = "valid";
            }

            // FALLBACK: If reasoning explicitly says "All checks passed" but decision is invalid, override
            const reasoningLower = parsed.reasoning.toLowerCase();
            if (
              parsed.decision === "invalid" &&
              (reasoningLower.includes("all checks passed") ||
               reasoningLower.includes("all checks pass") ||
               reasoningLower.includes("no violations found") ||
               reasoningLower.includes("no issues found"))
            ) {
              console.log(`[SARGE] Overriding to VALID (reasoning says all passed)`);
              parsed.decision = "valid";
            }
          } else {
            throw new Error("No JSON found");
          }
        } catch (parseErr) {
          console.error("[SARGE] JSON parse error:", parseErr, "Raw content:", content.substring(0, 500));
          // Fallback parsing if JSON extraction fails
          const isInvalid = content.toLowerCase().includes("invalid") &&
                           !content.toLowerCase().includes("all checks passed");
          parsed = {
            decision: isInvalid ? "invalid" : "valid",
            confidence: 50,
            reasoning: content.substring(0, 200),
            violations: [],
          };
        }

        results.push({
          documentId: doc.id,
          sargeDecision: parsed.decision,
          sargeReasoning: parsed.reasoning,
          violationsCited: parsed.violations || [],
          confidence: parsed.confidence || 50,
          checks: parsed.checks,
        });
      } catch (error) {
        console.error("Evaluation error:", error);
        results.push({
          documentId: doc.id,
          sargeDecision: "uncertain",
          sargeReasoning: "Error during evaluation",
          violationsCited: [],
          confidence: 0,
        });
      }

      // Update evaluations after each document
      setEvaluations([...results]);
    }

    setCurrentEvalIndex(-1);
    setIsEvaluating(false);
  };

  // Calculate accuracy statistics
  const calculateStats = (): RunResult["stats"] | null => {
    if (evaluations.length === 0 || evaluations.length !== generatedDocs.length) return null;

    let truePositives = 0; // SARGE said invalid, actually invalid
    let trueNegatives = 0; // SARGE said valid, actually valid
    let falsePositives = 0; // SARGE said invalid, actually valid
    let falseNegatives = 0; // SARGE said valid, actually invalid

    for (let i = 0; i < generatedDocs.length; i++) {
      const doc = generatedDocs[i];
      const eval_ = evaluations[i];

      if (eval_.sargeDecision === "uncertain") continue;

      const predictedInvalid = eval_.sargeDecision === "invalid";
      const actuallyInvalid = !doc.isValid;

      if (predictedInvalid && actuallyInvalid) truePositives++;
      else if (!predictedInvalid && !actuallyInvalid) trueNegatives++;
      else if (predictedInvalid && !actuallyInvalid) falsePositives++;
      else if (!predictedInvalid && actuallyInvalid) falseNegatives++;
    }

    const total = generatedDocs.length;
    const correct = truePositives + trueNegatives;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    return {
      total,
      truePositives,
      trueNegatives,
      falsePositives,
      falseNegatives,
      accuracy,
    };
  };

  // Generate company with truth anchors
  const handleGenerateCompany = async () => {
    setIsGeneratingCompany(true);
    setRunResult(null);

    try {
      // For now, use the default company template
      // In full implementation, this would call LLM to generate truth anchors
      const newCompany: Company = {
        ...DEFAULT_COMPANY,
        truthAnchors: [
          {
            id: "ta-1",
            title: "Service Rates & Billing Policy",
            content: `Summit Ridge Accounting, LLC – Service Rates & Billing Policy
Effective January 2025

1. Hourly billing rates (billed in 0.1-hour increments)
   - Partner: $225/hour
   - Senior Accountant: $175/hour
   - Staff Accountant: $135/hour
   - Bookkeeper (internal use only – not client-billable)

2. Fixed-fee services
   - Monthly bookkeeping (up to 100 transactions): $450–$850/month
   - Quarterly tax estimate package: $600 per quarter
   - Annual Form 1040 + business return (Schedule C): $1,200–$2,400
   - Payroll setup (one-time): $750

3. Late payment terms
   - Invoices due net 15 days
   - 1.5% late fee per month on balances over 30 days

4. Billing rules
   - All client work must reference a valid client code (format: CL-XXXXX)
   - Project codes required for advisory work (format: PRJ-YYYY-###)
   - No invoice may be issued without partner or senior accountant approval`,
          },
          {
            id: "ta-2",
            title: "Expense Reimbursement Policy",
            content: `Summit Ridge Accounting, LLC – Employee Expense Reimbursement Policy
Effective January 2025

1. Eligible categories
   - Business meals (client meetings only): actual cost up to $75 per person
   - Office supplies (under $200): 100% reimbursable with receipt
   - Mileage: IRS standard rate (current year)
   - Continuing education (approved courses): 100% with prior approval

2. Non-reimbursable items
   - Alcohol (except client meals where client is present)
   - Entertainment (tickets, sporting events)
   - Personal clothing, grooming
   - Commuting between home and office
   - Fines, penalties, late fees

3. Limits
   - Single expense > $500 requires partner approval
   - Monthly total per employee > $1,200 requires partner approval
   - Receipts required for all items >= $75

4. Submission rules
   - Must be submitted within 30 days of expense
   - Employee signature required
   - Supervisor approval required before submission to accounting`,
          },
          {
            id: "ta-3",
            title: "Approval Authority & Signature Rules",
            content: `Summit Ridge Accounting, LLC – Approval Authority & Signature Rules

1. Expense reimbursement requests
   - <= $250: staff accountant or bookkeeper can approve
   - $251–$750: senior accountant or admin
   - > $750: must have partner approval

2. Invoices sent to clients
   - Any invoice > $3,000: must be approved by partner
   - All invoices: must be reviewed by preparer + approved by billing coordinator or senior accountant

3. Vendor invoices (for payment)
   - <= $1,000: bookkeeper or staff accountant
   - $1,001–$5,000: senior accountant
   - > $5,000: partner

4. Signature requirements
   - All approval signatures must be full name + initials (electronic OK)
   - No person may approve their own submission/preparation`,
          },
          {
            id: "ta-4",
            title: "Client & Vendor Master Data Standards",
            content: `Summit Ridge Accounting, LLC – Client & Vendor Master Data Standards

1. Client codes
   - Format: CL- followed by five digits (CL-00001 to CL-99999)
   - Must be unique
   - Must include legal business name and EIN/SSN

2. Vendor codes
   - Format: VEN- followed by five digits (VEN-00001 to VEN-99999)
   - Must include vendor legal name, EIN, and remit-to address

3. Required fields for both
   - Legal name
   - Tax ID (EIN or SSN)
   - Physical or mailing address
   - Contact phone and email
   - Payment terms (default: Net 15)

4. Invoice numbering
   - Format: INV-YYYYMM-### (INV-202601-001, INV-202601-002, etc.)
   - Numbers cannot be reused or skipped`,
          },
          {
            id: "ta-5",
            title: "Invoice & Expense Report Formatting Rules",
            content: `Summit Ridge Accounting, LLC – Invoice & Expense Report Formatting Rules

1. Mandatory invoice fields (sent to clients)
   - Invoice number (INV-YYYYMM-###)
   - Invoice date and due date
   - Firm name, address, EIN
   - Client name, address, client code
   - Line items with description, quantity/hours, rate, amount
   - Subtotal, tax (if applicable), total due
   - Prepared by (name + initials)
   - Approval signature/block
   - Due date must be >= 10 days after invoice date

2. Mandatory expense report fields
   - Report number (EXP-YYYYMM-###)
   - Employee name & ID
   - Period covered
   - Each line: date, category, description, amount, client/project code
   - Total requested
   - Employee signature
   - Supervisor approval block

3. Date rules
   - Invoice date must be on or after last service date
   - Expense date must be within the period covered
   - No future dates allowed except for scheduled recurring invoices`,
          },
          {
            id: "ta-6",
            title: "Staff Roster & Authorization Levels",
            content: `Summit Ridge Accounting, LLC – Staff Roster & Authorization Levels
Effective January 2025

PARTNERS (full signing authority, can approve any amount/document)
- Elizabeth Harper, CPA (Partner)
- Michael Torres, CPA (Partner)

SENIOR ACCOUNTANTS (expense <= $750, vendor invoice <= $5,000, client invoice <= $3,000)
- Priya Patel, CPA
- David Nguyen, CPA
- Lauren Brooks, CPA

STAFF ACCOUNTANTS (expense <= $250, vendor invoice <= $1,000, client invoices require senior+ review)
- James Carter
- Sofia Ramirez
- Ethan Kim
- Maria Lopez

ADMINISTRATIVE / SUPPORT ROLES
- Rebecca Hayes (Billing Coordinator / Admin) – client invoices <= $1,500 after preparer review
- Thomas Reed (Bookkeeper) – vendor invoices <= $500, expenses <= $100

RULES
- Only listed individuals may appear in approval/signature fields
- Approval must match the role's authority limit for that document type and amount
- No person may approve their own submission/preparation
- Titles must be used exactly as listed`,
          },
        ],
      };

      setCompany(newCompany);
    } finally {
      setIsGeneratingCompany(false);
    }
  };

  // Reset everything
  const handleReset = () => {
    setCompany(null);
    setRunResult(null);
    setExpandedAnchors(new Set());
    setGeneratedDocs([]);
    setExpandedDocs(new Set());
    setEvaluations([]);
    setShowGroundTruth(false);
    setCurrentEvalIndex(-1);
  };

  // Get document type icon
  const getDocTypeIcon = (type: GeneratedDocument["type"]) => {
    switch (type) {
      case "client-invoice":
        return <Receipt className="h-4 w-4 text-blue-500" />;
      case "vendor-invoice":
        return <FileText className="h-4 w-4 text-purple-500" />;
      case "expense-report":
        return <ClipboardList className="h-4 w-4 text-amber-500" />;
    }
  };

  // Get document type label
  const getDocTypeLabel = (type: GeneratedDocument["type"]) => {
    switch (type) {
      case "client-invoice":
        return "Client Invoice";
      case "vendor-invoice":
        return "Vendor Invoice";
      case "expense-report":
        return "Expense Report";
    }
  };

  return (
    <div className={`flex h-full flex-col ${theme.bg}`}>
      {/* Header */}
      <div className={`shrink-0 px-6 py-4 border-b ${theme.border} ${theme.bgSecondary}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-emerald-500" />
            <h1 className={`text-xl font-bold ${theme.text}`}>Real World Simulator</h1>
          </div>
          {company && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}
        </div>
        <p className={`text-sm ${theme.textSecondary} mt-1`}>
          Generate realistic business documents and validate them against company policies using SARGE
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* No Company - Setup Phase */}
        {!company && (
          <div className={`rounded-xl border-2 ${theme.border} ${theme.bgSecondary} p-8 text-center`}>
            <Building2 className={`h-16 w-16 mx-auto mb-4 ${theme.textSecondary}`} />
            <h2 className={`text-lg font-bold ${theme.text} mb-2`}>Create a Company</h2>
            <p className={`text-sm ${theme.textSecondary} mb-6 max-w-md mx-auto`}>
              Generate a realistic small accounting firm with policies, procedures, and staff.
              These become the "truth anchors" that SARGE validates documents against.
            </p>
            <Button
              onClick={handleGenerateCompany}
              disabled={isGeneratingCompany}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {isGeneratingCompany ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4 mr-2" />
                  Generate Summit Ridge Accounting
                </>
              )}
            </Button>
          </div>
        )}

        {/* Company Created - Show Info */}
        {company && (
          <>
            {/* Company Header */}
            <div className={`rounded-xl border-2 border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20 p-4`}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    {company.name}
                  </h2>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    {company.location} • {company.size} employees • {company.industry}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Users className="h-5 w-5" />
                  <span className="text-sm font-medium">{company.staff.length} staff</span>
                </div>
              </div>
            </div>

            {/* Truth Anchors */}
            <div className={`rounded-xl border-2 ${theme.border} ${theme.bgSecondary} p-4`}>
              <h3 className={`text-sm font-bold ${theme.text} mb-3 flex items-center gap-2`}>
                <Scale className="h-4 w-4 text-amber-500" />
                Truth Anchors ({company.truthAnchors.length} documents)
              </h3>
              <div className="space-y-2">
                {company.truthAnchors.map((anchor) => (
                  <div
                    key={anchor.id}
                    className={`rounded-lg border ${theme.border} overflow-hidden`}
                  >
                    <button
                      onClick={() => toggleAnchor(anchor.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 ${theme.bg} hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors`}
                    >
                      <div className="flex items-center gap-2">
                        {expandedAnchors.has(anchor.id) ? (
                          <ChevronDown className="h-4 w-4 text-zinc-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-zinc-500" />
                        )}
                        <FileCheck className="h-4 w-4 text-amber-500" />
                        <span className={`text-sm font-medium ${theme.text}`}>
                          {anchor.title}
                        </span>
                      </div>
                    </button>
                    {expandedAnchors.has(anchor.id) && (
                      <div className={`px-4 py-3 border-t ${theme.border} ${theme.bg}`}>
                        <pre className={`text-xs ${theme.textSecondary} whitespace-pre-wrap font-mono`}>
                          {anchor.content}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Staff Roster Quick View */}
            <div className={`rounded-xl border-2 ${theme.border} ${theme.bgSecondary} p-4`}>
              <h3 className={`text-sm font-bold ${theme.text} mb-3 flex items-center gap-2`}>
                <Users className="h-4 w-4 text-blue-500" />
                Staff Roster
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {company.staff.map((member, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border ${theme.border} ${theme.bg} px-3 py-2`}
                  >
                    <p className={`text-sm font-medium ${theme.text}`}>{member.name}</p>
                    <p className={`text-xs ${theme.textSecondary}`}>{member.title}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Document Generation Section */}
            <div className={`rounded-xl border-2 ${theme.border} ${theme.bgSecondary} p-4`}>
              <h3 className={`text-sm font-bold ${theme.text} mb-3 flex items-center gap-2`}>
                <FileText className="h-4 w-4 text-cyan-500" />
                Document Generator
              </h3>
              <p className={`text-sm ${theme.textSecondary} mb-4`}>
                Generate random business documents. Some will be valid, others will contain policy violations.
                SARGE won't know which is which until the ground truth reveal.
              </p>

              {/* Generation Controls */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <label className={`text-xs ${theme.textSecondary}`}>Documents:</label>
                  <select
                    value={docCount}
                    onChange={(e) => setDocCount(parseInt(e.target.value))}
                    className={`rounded border ${theme.border} ${theme.bg} px-2 py-1 text-xs ${theme.text}`}
                  >
                    <option value={4}>4</option>
                    <option value={6}>6</option>
                    <option value={8}>8</option>
                    <option value={10}>10</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className={`text-xs ${theme.textSecondary}`}>Invalid Ratio:</label>
                  <select
                    value={invalidRatio}
                    onChange={(e) => setInvalidRatio(parseFloat(e.target.value))}
                    className={`rounded border ${theme.border} ${theme.bg} px-2 py-1 text-xs ${theme.text}`}
                  >
                    <option value={0.25}>25%</option>
                    <option value={0.5}>50%</option>
                    <option value={0.75}>75%</option>
                  </select>
                </div>
                <Button
                  onClick={handleGenerateDocuments}
                  disabled={isGeneratingDocs}
                  size="sm"
                  className="bg-cyan-500 hover:bg-cyan-600 text-white"
                >
                  {isGeneratingDocs ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Generate Documents
                    </>
                  )}
                </Button>
              </div>

              {/* Generated Documents List */}
              {generatedDocs.length > 0 && (
                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-medium ${theme.textSecondary}`}>
                      Generated {generatedDocs.length} documents
                      <span className="ml-2 text-amber-500">(ground truth hidden)</span>
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedDocs(expandedDocs.size > 0 ? new Set() : new Set(generatedDocs.map(d => d.id)))}
                      className="text-xs"
                    >
                      {expandedDocs.size > 0 ? "Collapse All" : "Expand All"}
                    </Button>
                  </div>
                  {generatedDocs.map((doc, idx) => (
                    <div
                      key={doc.id}
                      className={`rounded-lg border ${theme.border} overflow-hidden`}
                    >
                      <button
                        onClick={() => toggleDoc(doc.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 ${theme.bg} hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors`}
                      >
                        <div className="flex items-center gap-2">
                          {expandedDocs.has(doc.id) ? (
                            <ChevronDown className="h-4 w-4 text-zinc-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-zinc-500" />
                          )}
                          {getDocTypeIcon(doc.type)}
                          <span className={`text-sm font-medium ${theme.text}`}>
                            Document #{idx + 1}: {getDocTypeLabel(doc.type)}
                          </span>
                        </div>
                        <span className={`text-xs ${theme.textSecondary}`}>
                          Status: ???
                        </span>
                      </button>
                      {expandedDocs.has(doc.id) && (
                        <div className={`px-4 py-3 border-t ${theme.border} ${theme.bg}`}>
                          <pre className={`text-xs ${theme.textSecondary} whitespace-pre-wrap font-mono leading-relaxed`}>
                            {doc.content}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SARGE Evaluation Section */}
            {generatedDocs.length > 0 && (
              <div className={`rounded-xl border-2 ${theme.border} ${theme.bgSecondary} p-4`}>
                <h3 className={`text-sm font-bold ${theme.text} mb-3 flex items-center gap-2`}>
                  <Play className="h-4 w-4 text-indigo-500" />
                  SARGE Evaluation
                </h3>
                <p className={`text-sm ${theme.textSecondary} mb-4`}>
                  Send documents to SARGE for blind evaluation against the truth anchors.
                  SARGE will classify each document as valid or invalid based on policy compliance.
                </p>

                {/* Progress indicator */}
                {isEvaluating && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs ${theme.textSecondary}`}>
                        Evaluating document {currentEvalIndex + 1} of {generatedDocs.length}
                      </span>
                      <span className={`text-xs ${theme.textSecondary}`}>
                        {Math.round(((currentEvalIndex + 1) / generatedDocs.length) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${((currentEvalIndex + 1) / generatedDocs.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleRunEvaluation}
                  disabled={isEvaluating || generatedDocs.length === 0}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white"
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Evaluating...
                    </>
                  ) : evaluations.length > 0 ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Re-run Evaluation
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run SARGE Evaluation
                    </>
                  )}
                </Button>

                {/* Evaluation Results (before ground truth reveal) */}
                {evaluations.length > 0 && !showGroundTruth && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-xs font-medium ${theme.textSecondary}`}>
                        SARGE's Predictions:
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(generateEvaluationReport(), "all-evals")}
                        className="text-xs h-7"
                      >
                        {copiedId === "all-evals" ? (
                          <>
                            <Check className="h-3 w-3 mr-1 text-emerald-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy All
                          </>
                        )}
                      </Button>
                    </div>
                    {evaluations.map((eval_, idx) => {
                      const doc = generatedDocs.find((d) => d.id === eval_.documentId);
                      return (
                        <div
                          key={eval_.documentId}
                          className={`rounded-lg border ${theme.border} ${theme.bg} p-3`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {doc && getDocTypeIcon(doc.type)}
                              <span className={`text-sm font-medium ${theme.text}`}>
                                Document #{idx + 1}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {eval_.sargeDecision === "valid" ? (
                                <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Valid
                                </span>
                              ) : eval_.sargeDecision === "invalid" ? (
                                <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                                  <XCircle className="h-3.5 w-3.5" />
                                  Invalid
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Uncertain
                                </span>
                              )}
                              <span className={`text-xs ${theme.textSecondary}`}>
                                ({eval_.confidence}% conf)
                              </span>
                              <button
                                onClick={() => copyToClipboard(generateSingleDocReport(idx), `eval-${idx}`)}
                                className={`ml-1 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors`}
                                title="Copy this evaluation"
                              >
                                {copiedId === `eval-${idx}` ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3 text-zinc-400" />
                                )}
                              </button>
                            </div>
                          </div>
                          <p className={`text-xs ${theme.textSecondary} mt-1 line-clamp-2`}>
                            {eval_.sargeReasoning}
                          </p>
                          {/* Show checks for debugging */}
                          {eval_.checks && (
                            <div className="mt-2 text-[10px] font-mono space-y-0.5">
                              {Object.entries(eval_.checks).map(([key, value]) => {
                                // Handle case where value is object instead of string
                                const valueStr = typeof value === "object" && value !== null
                                  ? JSON.stringify(value)
                                  : String(value);
                                const isFail = valueStr.toUpperCase().startsWith("FAIL");
                                const isPass = valueStr.toUpperCase().startsWith("PASS");
                                return (
                                  <div key={key} className={`${isFail ? "text-red-500" : isPass ? "text-emerald-500" : theme.textSecondary}`}>
                                    {key}: {valueStr.substring(0, 60)}{valueStr.length > 60 ? "..." : ""}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {eval_.violationsCited.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {eval_.violationsCited.slice(0, 3).map((v, i) => {
                                // Handle case where violation is object instead of string
                                const vStr = typeof v === "object" && v !== null
                                  ? JSON.stringify(v)
                                  : String(v);
                                return (
                                  <span
                                    key={i}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                  >
                                    {vStr.length > 40 ? vStr.substring(0, 40) + "..." : vStr}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Ground Truth Reveal & Scorecard */}
            {evaluations.length > 0 && evaluations.length === generatedDocs.length && (
              <div className={`rounded-xl border-2 ${showGroundTruth ? "border-amber-500/50" : theme.border} ${showGroundTruth ? "bg-amber-50 dark:bg-amber-950/20" : theme.bgSecondary} p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm font-bold ${theme.text} flex items-center gap-2`}>
                    <Scale className="h-4 w-4 text-amber-500" />
                    Ground Truth & Scorecard
                  </h3>
                  {showGroundTruth && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(generateEvaluationReport(), "full-report")}
                      className="text-xs h-7"
                    >
                      {copiedId === "full-report" ? (
                        <>
                          <Check className="h-3 w-3 mr-1 text-emerald-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy Full Report
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {!showGroundTruth ? (
                  <>
                    <p className={`text-sm ${theme.textSecondary} mb-4`}>
                      Reveal the actual validity of each document and see how well SARGE performed.
                    </p>
                    <Button
                      onClick={() => setShowGroundTruth(true)}
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      <FileCheck className="h-4 w-4 mr-2" />
                      Reveal Ground Truth
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Accuracy Stats */}
                    {(() => {
                      const stats = calculateStats();
                      if (!stats) return null;
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                          <div className={`rounded-lg border ${theme.border} ${theme.bg} p-3 text-center`}>
                            <p className={`text-2xl font-bold ${stats.accuracy >= 80 ? "text-emerald-500" : stats.accuracy >= 60 ? "text-amber-500" : "text-red-500"}`}>
                              {stats.accuracy}%
                            </p>
                            <p className={`text-xs ${theme.textSecondary}`}>Accuracy</p>
                          </div>
                          <div className={`rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-center`}>
                            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                              {stats.truePositives}
                            </p>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">True Positives</p>
                          </div>
                          <div className={`rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-center`}>
                            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                              {stats.trueNegatives}
                            </p>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">True Negatives</p>
                          </div>
                          <div className={`rounded-lg border border-red-500/30 bg-red-50 dark:bg-red-950/20 p-3 text-center`}>
                            <p className="text-xl font-bold text-red-600 dark:text-red-400">
                              {stats.falsePositives}
                            </p>
                            <p className="text-[10px] text-red-600 dark:text-red-400">False Positives</p>
                          </div>
                          <div className={`rounded-lg border border-red-500/30 bg-red-50 dark:bg-red-950/20 p-3 text-center`}>
                            <p className="text-xl font-bold text-red-600 dark:text-red-400">
                              {stats.falseNegatives}
                            </p>
                            <p className="text-[10px] text-red-600 dark:text-red-400">False Negatives</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Detailed Results */}
                    <div className="space-y-2">
                      <p className={`text-xs font-medium ${theme.textSecondary} mb-2`}>
                        Detailed Results:
                      </p>
                      {generatedDocs.map((doc, idx) => {
                        const eval_ = evaluations.find((e) => e.documentId === doc.id);
                        if (!eval_) return null;

                        const predicted = eval_.sargeDecision === "invalid";
                        const actual = !doc.isValid;
                        const correct = (predicted && actual) || (!predicted && !actual);

                        return (
                          <div
                            key={doc.id}
                            className={`rounded-lg border ${correct ? "border-emerald-500/50" : "border-red-500/50"} ${correct ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20"} p-3`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                {correct ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                                <div>
                                  <span className={`text-sm font-medium ${theme.text}`}>
                                    Document #{idx + 1}: {getDocTypeLabel(doc.type)}
                                  </span>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    <span className={`text-xs ${theme.textSecondary}`}>
                                      SARGE: <span className={eval_.sargeDecision === "valid" ? "text-emerald-500" : "text-red-500"}>{eval_.sargeDecision}</span>
                                    </span>
                                    <span className={`text-xs ${theme.textSecondary}`}>
                                      Actual: <span className={doc.isValid ? "text-emerald-500" : "text-red-500"}>{doc.isValid ? "valid" : "invalid"}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {doc.difficulty && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                    doc.difficulty === "obvious" ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" :
                                    doc.difficulty === "moderate" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" :
                                    "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                  }`}>
                                    {doc.difficulty}
                                  </span>
                                )}
                                <button
                                  onClick={() => copyToClipboard(generateSingleDocReport(idx), `detail-${idx}`)}
                                  className={`p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors`}
                                  title="Copy this result"
                                >
                                  {copiedId === `detail-${idx}` ? (
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-zinc-400" />
                                  )}
                                </button>
                              </div>
                            </div>
                            {!doc.isValid && doc.violationDetail && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-2 pl-6">
                                <strong>Actual violation:</strong> {doc.violationDetail}
                              </p>
                            )}
                            {!correct && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-1 pl-6">
                                <strong>Error:</strong> {predicted ? "False positive (flagged a valid document)" : "False negative (missed an invalid document)"}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowGroundTruth(false)}
                      className="mt-4"
                    >
                      Hide Ground Truth
                    </Button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

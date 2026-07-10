// ═══════════════════════════════════════════════════════════════════════════════
// excel.ts — Excel / CSV / TSV parser (REAL implementation, no external API)
//
// Uses the `xlsx` package to parse .xlsx/.xls/.csv/.tsv files. Then maps
// rows into ParsedInvoice / ParsedClient / ParsedPayment / ParsedReturn
// using case-insensitive header matching.
//
// This adapter is fully functional today. NO fake data — it returns whatever
// the spreadsheet contains (empty arrays when the sheet is empty).
// ═══════════════════════════════════════════════════════════════════════════════

import * as XLSX from 'xlsx'

import type {
  ParsedClient,
  ParsedInvoice,
  ParsedPayment,
  ParsedReturn,
} from './types'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ExcelSheet {
  name: string
  headers: string[]
  rows: Record<string, unknown>[]
}

// ─── Workbook parse ─────────────────────────────────────────────────────────────

/**
 * Parse a workbook file (xlsx, xls, csv, tsv). Returns one ExcelSheet per
 * worksheet. Empty sheets return `headers: [], rows: []`.
 */
export async function parseWorkbook(filePath: string): Promise<ExcelSheet[]> {
  const workbook = XLSX.readFile(filePath, { cellDates: true })
  const sheets: ExcelSheet[] = []
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName]
    if (!ws) {
      sheets.push({ name: sheetName, headers: [], rows: [] })
      continue
    }
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: true,
    })
    const headers = json.length > 0 ? Object.keys(json[0] ?? {}) : []
    sheets.push({ name: sheetName, headers, rows: json })
  }
  return sheets
}

/**
 * Parse a workbook from an in-memory Buffer (e.g. uploaded via a multipart
 * form). Returns the same shape as `parseWorkbook`.
 */
export async function parseWorkbookBuffer(
  buffer: Buffer,
  fileName = 'upload.xlsx',
): Promise<ExcelSheet[]> {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheets: ExcelSheet[] = []
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName]
    if (!ws) {
      sheets.push({ name: sheetName, headers: [], rows: [] })
      continue
    }
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: true,
    })
    const headers = json.length > 0 ? Object.keys(json[0] ?? {}) : []
    sheets.push({ name: sheetName, headers, rows: json })
  }
  void fileName
  return sheets
}

// ─── Header matching helpers ────────────────────────────────────────────────────

/**
 * Case-insensitive + whitespace-insensitive key lookup. Tries each alias in
 * order and returns the first non-null value found.
 */
function pick(row: Record<string, unknown>, aliases: string[]): unknown {
  const lowerMap = new Map<string, unknown>()
  for (const [k, v] of Object.entries(row)) {
    lowerMap.set(k.trim().toLowerCase(), v)
  }
  for (const alias of aliases) {
    const v = lowerMap.get(alias.trim().toLowerCase())
    if (v !== null && v !== undefined && v !== '') return v
  }
  return undefined
}

function pickStr(row: Record<string, unknown>, aliases: string[]): string | undefined {
  const v = pick(row, aliases)
  if (v === undefined) return undefined
  return String(v).trim()
}

function pickNum(row: Record<string, unknown>, aliases: string[]): number | undefined {
  const v = pick(row, aliases)
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function pickDateStr(row: Record<string, unknown>, aliases: string[]): string | undefined {
  const v = pick(row, aliases)
  if (v === undefined || v === null || v === '') return undefined
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).trim()
}

// ─── Row mappers ────────────────────────────────────────────────────────────────

/**
 * Map spreadsheet rows → ParsedInvoice[]. Header aliases (case-insensitive):
 *   invoiceNumber ← "Invoice No", "Invoice Number", "Invoice #", "Inv No"
 *   invoiceDate   ← "Invoice Date", "Date"
 *   sellerGstin   ← "Seller GSTIN", "Supplier GSTIN", "GSTIN"
 *   buyerGstin    ← "Buyer GSTIN", "Customer GSTIN"
 *   buyerName     ← "Buyer Name", "Customer Name"
 *   taxableValue  ← "Taxable Value", "Taxable Amount"
 *   cgst / sgst / igst / cess ← same names
 *   totalAmount   ← "Total", "Total Amount", "Invoice Value"
 *   hsnCode       ← "HSN", "HSN Code", "HSN/SAC"
 *
 * Rows missing `invoiceNumber` AND `sellerGstin` are skipped.
 */
export function parseInvoicesFromSheet(
  rows: Record<string, unknown>[],
): ParsedInvoice[] {
  const out: ParsedInvoice[] = []
  for (const row of rows) {
    const invoiceNumber = pickStr(row, ['Invoice No', 'Invoice Number', 'Invoice #', 'Inv No', 'invoiceNumber'])
    const sellerGstin = pickStr(row, ['Seller GSTIN', 'Supplier GSTIN', 'GSTIN', 'sellerGstin'])
    if (!invoiceNumber && !sellerGstin) continue
    out.push({
      invoiceNumber: invoiceNumber ?? `row-${out.length + 1}`,
      invoiceDate: pickDateStr(row, ['Invoice Date', 'Date', 'invoiceDate']),
      sellerGstin: sellerGstin ?? 'UNKNOWN',
      buyerGstin: pickStr(row, ['Buyer GSTIN', 'Customer GSTIN', 'buyerGstin']),
      buyerName: pickStr(row, ['Buyer Name', 'Customer Name', 'buyerName']),
      taxableValue: pickNum(row, ['Taxable Value', 'Taxable Amount', 'taxableValue']),
      cgst: pickNum(row, ['CGST', 'cgst']),
      sgst: pickNum(row, ['SGST', 'sgst']),
      igst: pickNum(row, ['IGST', 'igst']),
      cess: pickNum(row, ['Cess', 'CESS', 'cess']),
      totalAmount: pickNum(row, ['Total', 'Total Amount', 'Invoice Value', 'totalAmount']),
      hsnCode: pickStr(row, ['HSN', 'HSN Code', 'HSN/SAC', 'hsnCode']),
      source: 'excel',
    })
  }
  return out
}

/**
 * Map spreadsheet rows → ParsedClient[]. Header aliases:
 *   gstin        ← "GSTIN", "GSTIN Number"
 *   tradeName    ← "Trade Name", "Name"
 *   legalName    ← "Legal Name"
 *   state        ← "State"
 *   stateCode    ← "State Code"
 *   contactEmail ← "Email", "Contact Email"
 *   contactPhone ← "Phone", "Contact Phone"
 *
 * Rows missing `gstin` AND `tradeName` are skipped.
 */
export function parseClientsFromSheet(
  rows: Record<string, unknown>[],
): ParsedClient[] {
  const out: ParsedClient[] = []
  for (const row of rows) {
    const gstin = pickStr(row, ['GSTIN', 'GSTIN Number', 'gstin'])
    const tradeName = pickStr(row, ['Trade Name', 'Name', 'tradeName'])
    if (!gstin && !tradeName) continue
    out.push({
      gstin: gstin ?? `UNKNOWN-${out.length + 1}`,
      tradeName: tradeName ?? 'Unnamed',
      legalName: pickStr(row, ['Legal Name', 'legalName']),
      state: pickStr(row, ['State', 'state']),
      stateCode: pickStr(row, ['State Code', 'stateCode']),
      contactEmail: pickStr(row, ['Email', 'Contact Email', 'contactEmail']),
      contactPhone: pickStr(row, ['Phone', 'Contact Phone', 'contactPhone']),
    })
  }
  return out
}

/**
 * Map spreadsheet rows → ParsedPayment[]. Header aliases:
 *   date         ← "Date", "Payment Date"
 *   amount       ← "Amount", "Value"
 *   method       ← "Method", "Mode" (upi/rtgs/neft/imps/card/cheque/cash)
 *   referenceNo  ← "Reference No", "UTR", "Cheque No", "Reference"
 *   description  ← "Description", "Narration", "Remarks"
 *   direction    ← "Direction", "Type" ("in"/"out" or "credit"/"debit")
 *
 * Rows missing `amount` are skipped.
 */
export function parsePaymentsFromSheet(
  rows: Record<string, unknown>[],
): ParsedPayment[] {
  const out: ParsedPayment[] = []
  for (const row of rows) {
    const amount = pickNum(row, ['Amount', 'Value', 'amount'])
    if (amount === undefined) continue

    let direction: ParsedPayment['direction'] | undefined
    const dirRaw = (pickStr(row, ['Direction', 'Type', 'direction']) ?? '').toLowerCase()
    if (dirRaw === 'in' || dirRaw === 'credit' || dirRaw === 'received') direction = 'in'
    if (dirRaw === 'out' || dirRaw === 'debit' || dirRaw === 'paid') direction = 'out'

    // If no direction column, infer from sign of amount.
    if (!direction) direction = amount >= 0 ? 'in' : 'out'

    const dateStr = pickDateStr(row, ['Date', 'Payment Date', 'date'])
    out.push({
      amount: Math.abs(amount),
      direction,
      method: pickStr(row, ['Method', 'Mode', 'method']),
      referenceNo: pickStr(row, ['Reference No', 'UTR', 'Cheque No', 'Reference', 'referenceNo']),
      description: pickStr(row, ['Description', 'Narration', 'Remarks', 'description']),
      paidAt: dateStr ? new Date(dateStr) : undefined,
      source: 'excel',
    })
  }
  return out
}

/**
 * Map spreadsheet rows → ParsedReturn[]. Header aliases:
 *   returnType  ← "Return Type", "Form" (GSTR-1, GSTR-3B, GSTR-2B, ...)
 *   period      ← "Period", "Return Period" (e.g. "042025" or "April 2025")
 *   fy          ← "FY", "Financial Year"
 *   status      ← "Status" (Filed / Not Filed / Draft)
 *   filedDate   ← "Filed Date", "Date"
 *   ackNo       ← "ACK No", "Acknowledgment No", "ARN"
 *
 * Rows missing `returnType` AND `period` are skipped.
 */
export function parseReturnsFromSheet(
  rows: Record<string, unknown>[],
): ParsedReturn[] {
  const out: ParsedReturn[] = []
  for (const row of rows) {
    const returnType = pickStr(row, ['Return Type', 'Form', 'returnType'])
    const period = pickStr(row, ['Period', 'Return Period', 'period'])
    if (!returnType && !period) continue
    out.push({
      returnType: returnType ?? 'GSTR-1',
      period: period ?? '',
      financialYear: pickStr(row, ['FY', 'Financial Year', 'financialYear']),
      status: pickStr(row, ['Status', 'status']),
      filedDate: pickDateStr(row, ['Filed Date', 'Date', 'filedDate']),
      ackNo: pickStr(row, ['ACK No', 'Acknowledgment No', 'ARN', 'ackNo']),
      source: 'excel',
    })
  }
  return out
}

/**
 * Convenience — parse all sheets of a workbook and bucket rows by their
 * sheet name. A sheet named "Invoices" / "Invoices" / "Sales" is parsed as
 * invoices; "Clients" / "Parties" → clients; "Payments" / "Receipts" →
 * payments; "Returns" / "GSTR" → returns. Sheets with unknown names are
 * returned as raw ExcelSheet[] under `unknown` so the caller can decide.
 */
export interface ParsedWorkbook {
  invoices: ParsedInvoice[]
  clients: ParsedClient[]
  payments: ParsedPayment[]
  returns: ParsedReturn[]
  unknown: ExcelSheet[]
}

export async function parseAndClassifyWorkbook(filePath: string): Promise<ParsedWorkbook> {
  const sheets = await parseWorkbook(filePath)
  const result: ParsedWorkbook = {
    invoices: [],
    clients: [],
    payments: [],
    returns: [],
    unknown: [],
  }
  for (const sheet of sheets) {
    const name = sheet.name.toLowerCase()
    if (name.includes('invoice') || name.includes('sale')) {
      result.invoices.push(...parseInvoicesFromSheet(sheet.rows))
    } else if (name.includes('client') || name.includes('part') || name.includes('customer')) {
      result.clients.push(...parseClientsFromSheet(sheet.rows))
    } else if (name.includes('payment') || name.includes('receipt')) {
      result.payments.push(...parsePaymentsFromSheet(sheet.rows))
    } else if (name.includes('return') || name.includes('gstr')) {
      result.returns.push(...parseReturnsFromSheet(sheet.rows))
    } else if (sheet.rows.length > 0) {
      result.unknown.push(sheet)
    }
  }
  return result
}

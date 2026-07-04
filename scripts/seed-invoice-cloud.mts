// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ (Phase 8 Step 3) — ERP Seed Script
// Idempotent. Creates: vendors, purchase bills, expenses, receivables, payables,
// payments, TDS records, employees, payroll. Updates existing invoices with ERP fields.
// Run: `bun run scripts/seed-invoice-cloud.mts`
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '../src/lib/db';

const FIRM_GSTIN = '27ABCDE1234F1Z5';
const FIRM_PAN = 'ABCDE1234F';
const MAHARASHTRA_PT = 200;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

async function main() {
  console.log('🚀 Seeding Phase 8 Step 3 — GSTPilot Real Invoice Engine™...');

  // ─── 1. Ensure firm exists with GSTIN ───────────────────────────────────────
  let firm = await db.firm.findFirst();
  if (!firm) {
    firm = await db.firm.create({
      data: {
        name: 'GSTPilot Demo Firm',
        gstin: FIRM_GSTIN,
        pan: FIRM_PAN,
        state: 'Maharashtra',
        stateCode: '27',
      },
    });
    console.log('✅ Created firm:', firm.id);
  } else if (!firm.gstin) {
    firm = await db.firm.update({
      where: { id: firm.id },
      data: { gstin: FIRM_GSTIN, pan: FIRM_PAN, state: 'Maharashtra', stateCode: '27' },
    });
    console.log('✅ Updated firm with GSTIN');
  }

  // ─── 2. Ensure at least 6 clients exist ────────────────────────────────────
  const existingClients = await db.client.findMany();
  const clientSeedData = [
    { tradeName: 'TechCorp Solutions Pvt Ltd', gstin: '27AABCT1234A1Z5', state: 'Maharashtra', stateCode: '27' },
    { tradeName: 'Vertex Manufacturing', gstin: '29AABCV5678B1Z2', state: 'Karnataka', stateCode: '29' },
    { tradeName: 'Apex Traders LLP', gstin: '33ABBCA9012C1Z8', state: 'Tamil Nadu', stateCode: '33' },
    { tradeName: 'Horizon Retail Pvt Ltd', gstin: '07AACCH3456D1Z9', state: 'Delhi', stateCode: '07' },
    { tradeName: 'Pioneer Logistics', gstin: '36AAPCP7890E1Z1', state: 'Telangana', stateCode: '36' },
    { tradeName: 'Sterling Industries', gstin: '24AAHCS2345F1Z3', state: 'Gujarat', stateCode: '24' },
  ];
  const clients: { id: string; tradeName: string; gstin: string; state: string; stateCode: string }[] = [];
  for (const existing of existingClients) {
    clients.push({
      id: existing.id,
      tradeName: existing.tradeName,
      gstin: existing.gstin ?? '',
      state: existing.state ?? 'Maharashtra',
      stateCode: existing.stateCode ?? '27',
    });
  }
  for (const seed of clientSeedData) {
    if (clients.some((c) => c.gstin === seed.gstin)) continue;
    const c = await db.client.create({
      data: {
        ...seed,
        legalName: seed.tradeName,
        contactEmail: `accounts@${seed.tradeName.toLowerCase().replace(/[^a-z]/g, '')}.in`,
        entityType: 'regular',
        status: 'active',
        healthScore: 75,
        firmId: firm.id,
      },
    });
    clients.push({ ...seed, id: c.id });
  }
  console.log(`✅ ${clients.length} clients ready`);

  // ─── 3. Update existing invoices with ERP fields (dueDate, subtotal, paymentStatus) ──
  const existingInvoices = await db.invoice.findMany({
    include: { payments: { select: { amount: true, status: true } } },
  });
  let updatedInvoices = 0;
  for (const inv of existingInvoices) {
    if (inv.dueDate && inv.subtotal > 0 && inv.paymentStatus) {
      continue; // already has ERP fields
    }
    const paidAmount = inv.payments
      .filter((p) => p.status === 'success' || p.status === 'reconciled')
      .reduce((s, p) => s + p.amount, 0);
    const paymentStatus = paidAmount >= inv.totalAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
    const status = paymentStatus === 'paid' ? 'paid' : paymentStatus === 'partial' ? 'partial' : 'sent';
    const invoiceDate = inv.invoiceDate.slice(0, 10);
    const dueDate = inv.dueDate ?? isoDaysFromNow(30 - Math.floor(Math.random() * 60)); // mix of past + future
    await db.invoice.update({
      where: { id: inv.id },
      data: {
        dueDate,
        subtotal: inv.taxableValue || inv.totalAmount,
        paymentStatus,
        status,
        sellerGstin: inv.sellerGstin || FIRM_GSTIN,
        buyerGstin: inv.buyerGstin || clients[0]?.gstin,
        buyerName: inv.buyerName || clients[0]?.tradeName,
        pdfUrl: `https://gstpilot.in/invoices/${inv.id}.pdf`,
        paymentLink: `upi://pay?pa=gstpilot@hdfcbank&pn=GSTPilot&am=${inv.totalAmount}&tn=${inv.invoiceNumber}`,
        qrCode: `upi://pay?pa=gstpilot@hdfcbank&pn=GSTPilot&am=${inv.totalAmount}&tn=${inv.invoiceNumber}`,
        sentAt: inv.sentAt ?? new Date(inv.invoiceDate),
        sentChannel: inv.sentChannel ?? 'email',
      },
    });
    updatedInvoices += 1;
  }
  console.log(`✅ Updated ${updatedInvoices} existing invoices with ERP fields`);

  // ─── 4. Create new sales invoices for current month ────────────────────────
  const currentMonthInvoices = await db.invoice.count({
    where: { invoiceDate: { startsWith: currentMonth() } },
  });
  if (currentMonthInvoices < 5) {
    const newInvoices = [
      { clientId: clients[0], amount: 250000, daysAgo: 5, isInterState: false },
      { clientId: clients[1], amount: 480000, daysAgo: 8, isInterState: true },
      { clientId: clients[2], amount: 175000, daysAgo: 12, isInterState: true },
      { clientId: clients[3], amount: 92000, daysAgo: 15, isInterState: false },
      { clientId: clients[4], amount: 365000, daysAgo: 18, isInterState: true },
      { clientId: clients[5], amount: 158000, daysAgo: 22, isInterState: true },
    ];
    let invCounter = existingInvoices.length + 1;
    for (const ni of newInvoices) {
      const invoiceDate = isoDaysAgo(ni.daysAgo);
      const dueDate = isoDaysFromNow(30 - ni.daysAgo);
      const gstRate = 18;
      const tax = (ni.amount * gstRate) / 100;
      const cgst = ni.isInterState ? 0 : tax / 2;
      const sgst = ni.isInterState ? 0 : tax / 2;
      const igst = ni.isInterState ? tax : 0;
      const total = ni.amount + tax;
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invCounter).padStart(3, '0')}`;
      invCounter += 1;
      await db.invoice.create({
        data: {
          clientId: ni.clientId.id,
          invoiceNumber,
          invoiceDate,
          dueDate,
          sellerGstin: FIRM_GSTIN,
          buyerGstin: ni.clientId.gstin,
          buyerName: ni.clientId.tradeName,
          invoiceType: 'B2B',
          placeOfSupply: ni.clientId.stateCode,
          subtotal: ni.amount,
          taxableValue: ni.amount,
          cgst,
          sgst,
          igst,
          totalAmount: total,
          status: 'sent',
          paymentStatus: 'unpaid',
          period: invoiceDate.slice(0, 7),
          pdfUrl: `https://gstpilot.in/invoices/${invoiceNumber}.pdf`,
          paymentLink: `upi://pay?pa=gstpilot@hdfcbank&pn=GSTPilot&am=${total}&tn=${invoiceNumber}`,
          sentAt: new Date(invoiceDate),
          sentChannel: 'email',
          items: {
            create: [
              {
                lineNumber: 1,
                description: 'Professional Services',
                hsnCode: '998314',
                quantity: 1,
                unit: 'NOS',
                unitPrice: ni.amount,
                taxableValue: ni.amount,
                cgstRate: ni.isInterState ? 0 : gstRate / 2,
                sgstRate: ni.isInterState ? 0 : gstRate / 2,
                igstRate: ni.isInterState ? gstRate : 0,
                cgst,
                sgst,
                igst,
                cess: 0,
                totalAmount: total,
              },
            ],
          },
        },
      });
    }
    console.log(`✅ Created ${newInvoices.length} new sales invoices`);
  }

  // ─── 5. Create vendors ─────────────────────────────────────────────────────
  const vendorSeed = [
    { name: 'CloudInfra Solutions', gstin: '27AABCC1234A1Z5', category: 'it', paymentTerms: 'net30', state: 'Maharashtra', stateCode: '27' },
    { name: 'OfficeMate Supplies', gstin: '27AABCO5678B1Z2', category: 'goods', paymentTerms: 'net15', state: 'Maharashtra', stateCode: '27' },
    { name: 'Legal Associates Co', gstin: '27AABCL9012C1Z8', category: 'professional', paymentTerms: 'net30', state: 'Maharashtra', stateCode: '27' },
    { name: 'PowerGrid Utilities', gstin: null, category: 'utility', paymentTerms: 'immediate', state: 'Maharashtra', stateCode: '27' },
    { name: 'QuickShip Logistics', gstin: '29AABCQ3456D1Z9', category: 'logistics', paymentTerms: 'net15', state: 'Karnataka', stateCode: '29' },
    { name: 'AdZone Marketing', gstin: '07AABCM7890E1Z1', category: 'services', paymentTerms: 'net45', state: 'Delhi', stateCode: '07' },
    { name: 'Workspace Rentals', gstin: '27AABCR2345F1Z3', category: 'rent', paymentTerms: 'monthly', state: 'Maharashtra', stateCode: '27' },
    { name: 'NonGST Vendor', gstin: null, category: 'goods', paymentTerms: 'net30', state: 'Maharashtra', stateCode: '27' },
  ];
  const vendors: { id: string; name: string; gstin: string | null; paymentTerms: string | null }[] = [];
  for (const seed of vendorSeed) {
    const existing = await db.vendor.findFirst({ where: { name: seed.name } });
    if (existing) {
      vendors.push(existing);
      continue;
    }
    const v = await db.vendor.create({
      data: {
        name: seed.name,
        gstin: seed.gstin,
        pan: seed.gstin ? seed.gstin.slice(2, 12) : null,
        category: seed.category,
        state: seed.state,
        stateCode: seed.stateCode,
        paymentTerms: seed.paymentTerms,
        upiId: `${seed.name.toLowerCase().replace(/[^a-z]/g, '')}@hdfcbank`,
        status: 'active',
      },
    });
    vendors.push(v);
  }
  console.log(`✅ ${vendors.length} vendors ready`);

  // ─── 6. Create purchase bills ──────────────────────────────────────────────
  const existingBills = await db.purchaseBill.count();
  if (existingBills < 8) {
    const bills = [
      { vendor: vendors[0], billNo: 'CIS-2026-001', amount: 85000, daysAgo: 5, isInterState: false, category: 'it', hsn: '998313' },
      { vendor: vendors[1], billNo: 'OMS-2026-014', amount: 24000, daysAgo: 8, isInterState: false, category: 'goods', hsn: '4820' },
      { vendor: vendors[2], billNo: 'LAC-2026-007', amount: 120000, daysAgo: 12, isInterState: false, category: 'professional', hsn: '998321' },
      { vendor: vendors[3], billNo: 'PGU-2026-003', amount: 18000, daysAgo: 3, isInterState: false, category: 'utility', hsn: '9989' }, // No GSTIN — ITC blocked
      { vendor: vendors[4], billNo: 'QSL-2026-022', amount: 36000, daysAgo: 15, isInterState: true, category: 'logistics', hsn: '9965' },
      { vendor: vendors[5], billNo: 'AZM-2026-009', amount: 75000, daysAgo: 18, isInterState: true, category: 'services', hsn: '998361' },
      { vendor: vendors[6], billNo: 'WRR-2026-005', amount: 125000, daysAgo: 25, isInterState: false, category: 'rent', hsn: '9973' },
      { vendor: vendors[7], billNo: 'NGV-2026-011', amount: 15000, daysAgo: 7, isInterState: false, category: 'goods', hsn: '9999' }, // No GSTIN — ITC blocked
      { vendor: vendors[0], billNo: 'CIS-2026-002', amount: 42000, daysAgo: 20, isInterState: false, category: 'it', hsn: '998313' },
      { vendor: vendors[2], billNo: 'LAC-2026-012', amount: 65000, daysAgo: 28, isInterState: false, category: 'professional', hsn: '998321' },
    ];
    for (const b of bills) {
      const billDate = isoDaysAgo(b.daysAgo);
      const gstRate = 18;
      const tax = (b.amount * gstRate) / 100;
      const cgst = b.isInterState ? 0 : tax / 2;
      const sgst = b.isInterState ? 0 : tax / 2;
      const igst = b.isInterState ? tax : 0;
      const total = b.amount + tax;
      const itcEligible = !!b.vendor.gstin; // blocked if no GSTIN
      const itcAmount = itcEligible ? cgst + sgst + igst : 0;
      const dueDate = isoDaysFromNow(b.daysAgo > 15 ? -5 : 15); // some overdue

      const bill = await db.purchaseBill.create({
        data: {
          vendorId: b.vendor.id,
          vendorName: b.vendor.name,
          billNo: b.billNo,
          billDate,
          dueDate,
          taxableValue: b.amount,
          cgst,
          sgst,
          igst,
          cess: 0,
          totalAmount: total,
          category: b.category,
          hsnCode: b.hsn,
          itcEligible,
          itcAmount,
          itcBlockReason: itcEligible ? null : 'Vendor GSTIN not available — ITC blocked under Sec 16',
          paymentStatus: b.daysAgo > 20 ? 'paid' : 'unpaid',
          paidAmount: b.daysAgo > 20 ? total : 0,
          paidAt: b.daysAgo > 20 ? new Date(isoDaysAgo(b.daysAgo - 10)) : null,
          status: b.daysAgo > 20 ? 'paid' : 'recorded',
          period: billDate.slice(0, 7),
        },
      });

      // Auto-create payable (only if unpaid)
      if (b.daysAgo <= 20) {
        await db.payable.create({
          data: {
            vendorId: b.vendor.id,
            vendorName: b.vendor.name,
            purchaseBillId: bill.id,
            amount: total,
            dueDate,
            daysUntilDue: Math.max(0, Math.floor((new Date(dueDate).getTime() - Date.now()) / 86_400_000)),
            priority: total > 100000 ? 'high' : total > 50000 ? 'medium' : 'low',
            priorityScore: total > 100000 ? 75 : total > 50000 ? 55 : 35,
            status: 'pending',
          },
        });
      }

      // Update vendor totals
      await db.vendor.update({
        where: { id: b.vendor.id },
        data: {
          totalBilled: { increment: total },
          totalPaid: { increment: b.daysAgo > 20 ? total : 0 },
          outstanding: { increment: b.daysAgo > 20 ? 0 : total },
        },
      });
    }
    console.log(`✅ Created ${bills.length} purchase bills + linked payables`);
  } else {
    console.log(`✅ ${existingBills} purchase bills already exist, skipping`);
  }

  // ─── 7. Create expenses ────────────────────────────────────────────────────
  const existingExpenses = await db.expense.count();
  if (existingExpenses < 12) {
    const expenses = [
      { category: 'rent', amount: 85000, vendor: 'Workspace Rentals', desc: 'Office rent — current month', recurring: true, mode: 'bank' },
      { category: 'electricity', amount: 12400, vendor: 'MSEDCL', desc: 'Electricity bill — office', recurring: true, mode: 'bank' },
      { category: 'internet', amount: 3500, vendor: 'Airtel Business', desc: 'Internet + leased line', recurring: true, mode: 'bank' },
      { category: 'software', amount: 18500, vendor: 'Atlassian', desc: 'Jira + Confluence annual subscription', recurring: false, mode: 'card' },
      { category: 'software', amount: 8200, vendor: 'GitHub', desc: 'GitHub Teams monthly', recurring: true, mode: 'card' },
      { category: 'marketing', amount: 45000, vendor: 'AdZone Marketing', desc: 'Google Ads campaign — Q4', recurring: false, mode: 'bank' },
      { category: 'travel', amount: 22800, vendor: 'IndiGo', desc: 'Team travel — client meeting Bangalore', recurring: false, mode: 'card' },
      { category: 'office', amount: 9800, vendor: 'OfficeMate', desc: 'Office supplies + stationery', recurring: false, mode: 'upi' },
      { category: 'professional', amount: 35000, vendor: 'Legal Associates', desc: 'Legal retainer — monthly', recurring: true, mode: 'bank' },
      { category: 'misc', amount: 4500, vendor: 'Urban Company', desc: 'Office cleaning services', recurring: true, mode: 'upi' },
      { category: 'software', amount: 12000, vendor: 'AWS', desc: 'AWS cloud credits top-up', recurring: false, mode: 'card' },
      { category: 'travel', amount: 8500, vendor: 'Ola Cabs', desc: 'Local travel — client visits', recurring: false, mode: 'upi' },
    ];
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      const date = isoDaysAgo(i * 2 + 1);
      const gstAmount = ['rent', 'electricity', 'software', 'marketing', 'office', 'professional'].includes(e.category) ? Math.round((e.amount * 0.18) * 100) / 100 : 0;
      await db.expense.create({
        data: {
          date,
          category: e.category,
          amount: e.amount,
          gstAmount,
          vendor: e.vendor,
          description: e.desc,
          paymentMode: e.mode as 'bank' | 'upi' | 'cash' | 'card' | 'cheque',
          recurring: e.recurring,
          recurringFreq: e.recurring ? 'monthly' as const : null,
          status: 'recorded',
        },
      });
    }
    console.log(`✅ Created ${expenses.length} expenses`);
  } else {
    console.log(`✅ ${existingExpenses} expenses already exist, skipping`);
  }

  // ─── 8. Create receivables from existing invoices (sync) ───────────────────
  const allInvoices = await db.invoice.findMany({
    where: { status: { in: ['sent', 'partial', 'overdue', 'paid'] } },
    include: {
      client: { select: { tradeName: true, gstin: true } },
      payments: { select: { amount: true, status: true } },
    },
  });
  let receivablesCreated = 0;
  for (const inv of allInvoices) {
    const paidAmount = inv.payments
      .filter((p) => p.status === 'success' || p.status === 'reconciled')
      .reduce((s, p) => s + p.amount, 0);
    const balanceDue = Math.max(0, inv.totalAmount - paidAmount);
    if (balanceDue <= 0) continue;
    // Skip if receivable already exists
    const existing = await db.receivable.findUnique({ where: { invoiceId: inv.id } });
    if (existing) continue;
    const dueDate = inv.dueDate ?? isoDaysFromNow(30);
    const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000));
    const bucket = daysOverdue <= 30 ? '0-30' : daysOverdue <= 60 ? '31-60' : daysOverdue <= 90 ? '61-90' : '90+';
    const riskScore = Math.min(100, Math.round(daysOverdue * 0.6 + Math.log10(Math.max(1, balanceDue / 1000)) * 8));
    const riskLevel = riskScore >= 80 ? 'critical' : riskScore >= 60 ? 'high' : riskScore >= 35 ? 'medium' : 'low';
    const collectionProb = Math.max(0.1, 1 - Math.min(0.85, daysOverdue * 0.008));
    await db.receivable.create({
      data: {
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNumber,
        clientId: inv.clientId,
        customerName: inv.client?.tradeName ?? 'Unknown',
        customerGstin: inv.client?.gstin ?? null,
        amount: balanceDue,
        originalAmount: inv.totalAmount,
        collectedAmount: paidAmount,
        dueDate,
        daysOverdue,
        agingBucket: bucket,
        riskLevel,
        riskScore,
        collectionProbability: collectionProb,
        expectedAmount: Math.round(balanceDue * collectionProb * 100) / 100,
        status: daysOverdue > 0 ? 'reminded' : 'outstanding',
        reminderCount: daysOverdue > 7 ? 1 : 0,
        lastReminder: daysOverdue > 7 ? new Date(isoDaysAgo(daysOverdue - 5)) : null,
      },
    });
    receivablesCreated += 1;
  }
  console.log(`✅ Created ${receivablesCreated} receivables from invoices`);

  // ─── 9. Create payments (mark oldest 8 invoices as paid + reconcile) ───────
  const existingPayments = await db.payment.count();
  if (existingPayments < 5) {
    // Pick oldest 8 invoices and create payments for them (mark as paid)
    const invoicesToPay = await db.invoice.findMany({
      orderBy: { invoiceDate: 'asc' },
      take: 8,
      include: { client: { select: { tradeName: true } } },
    });
    let paymentsCreated = 0;
    for (const inv of invoicesToPay) {
      const exists = await db.payment.findFirst({ where: { invoiceId: inv.id } });
      if (exists) continue;
      const daysAgo = Math.floor(Math.random() * 25) + 2;
      const paymentDate = isoDaysAgo(daysAgo);
      const mode = (['upi', 'bank', 'rtgs', 'neft'] as const)[Math.floor(Math.random() * 4)];
      await db.payment.create({
        data: {
          invoiceId: inv.id,
          invoiceNo: inv.invoiceNumber,
          clientId: inv.clientId,
          customerName: inv.client?.tradeName ?? 'Unknown',
          amount: inv.totalAmount,
          mode,
          referenceNo: `PAY-${inv.invoiceNumber.replace(/[^0-9]/g, '')}-${daysAgo}`,
          status: 'reconciled',
          direction: 'incoming',
          paidAt: new Date(paymentDate),
          reconciled: true,
          notes: 'Payment for invoice (auto-reconciled)',
        },
      });
      // Mark invoice as paid
      await db.invoice.update({
        where: { id: inv.id },
        data: { paymentStatus: 'paid', status: 'paid' },
      });
      // Update receivable if exists
      const rec = await db.receivable.findUnique({ where: { invoiceId: inv.id } });
      if (rec) {
        await db.receivable.update({
          where: { id: rec.id },
          data: {
            collectedAmount: rec.amount,
            status: 'collected',
          },
        });
      }
      paymentsCreated += 1;
    }

    // Also create a few outgoing payments for paid purchase bills
    const paidBills = await db.purchaseBill.findMany({
      where: { paymentStatus: 'paid' },
      take: 3,
    });
    for (const bill of paidBills) {
      const exists = await db.payment.findFirst({ where: { vendorId: bill.vendorId, amount: bill.totalAmount } });
      if (exists) continue;
      await db.payment.create({
        data: {
          vendorId: bill.vendorId,
          vendorName: bill.vendorName,
          amount: bill.totalAmount,
          mode: 'bank',
          referenceNo: `V-PAY-${bill.billNo.replace(/[^0-9]/g, '')}`,
          status: 'reconciled',
          direction: 'outgoing',
          paidAt: bill.paidAt ?? new Date(),
          reconciled: true,
          notes: `Vendor payment for ${bill.billNo}`,
        },
      });
      paymentsCreated += 1;
    }
    console.log(`✅ Created ${paymentsCreated} payments (incoming + outgoing)`);
  }

  // ─── 10. Create TDS records ────────────────────────────────────────────────
  const existingTDS = await db.tDSRecord.count();
  if (existingTDS < 5) {
    const tdsRecords = [
      { deductee: 'Legal Associates Co', section: '194J', nature: 'Professional Fees', amount: 60000, daysAgo: 5 },
      { deductee: 'CloudInfra Solutions', section: '194J', nature: 'Technical Services', amount: 95000, daysAgo: 10 },
      { deductee: 'QuickShip Logistics', section: '194C', nature: 'Contractor', amount: 45000, daysAgo: 12 },
      { deductee: 'AdZone Marketing', section: '194H', nature: 'Commission', amount: 25000, daysAgo: 15 },
      { deductee: 'Workspace Rentals', section: '194I', nature: 'Rent (Building)', amount: 85000, daysAgo: 18 },
      { deductee: 'OfficeMate Supplies', section: '194C', nature: 'Contractor', amount: 35000, daysAgo: 22 },
    ];
    const rates: Record<string, number> = { '194J': 10, '194C': 1, '194H': 5, '194I': 10 };
    let counter = 0;
    for (const r of tdsRecords) {
      const rate = rates[r.section] ?? 10;
      const tdsAmount = Math.round((r.amount * rate) / 100);
      const cess = Math.round(tdsAmount * 0.04 * 100) / 100;
      const totalTds = tdsAmount + cess;
      const status = counter < 2 ? 'return_filed' : counter < 4 ? 'challan_paid' : 'deducted';
      const paymentDate = isoDaysAgo(r.daysAgo);
      await db.tDSRecord.create({
        data: {
          deductor: 'GSTPilot Demo Firm',
          deducteeName: r.deductee,
          deducteePan: `ABCDE${1000 + counter}F`,
          section: r.section,
          natureOfPayment: r.nature,
          paymentDate,
          paymentAmount: r.amount,
          tdsRate: rate,
          tdsAmount,
          surcharge: 0,
          cess,
          totalTds: totalTds,
          status,
          challanNo: status !== 'deducted' ? `CHN-2026Q1-${String(counter + 1).padStart(3, '0')}` : null,
          challanDate: status !== 'deducted' ? isoDaysAgo(r.daysAgo - 2) : null,
          returnPeriod: status === 'return_filed' ? 'Q1 FY2025-26' : null,
          returnFiledAt: status === 'return_filed' ? new Date(isoDaysAgo(r.daysAgo - 5)) : null,
        },
      });
      counter += 1;
    }
    console.log(`✅ Created ${tdsRecords.length} TDS records`);
  }

  // ─── 11. Create employees ──────────────────────────────────────────────────
  const existingEmployees = await db.employee.count();
  if (existingEmployees === 0) {
    const employees = [
      { name: 'Aarav Sharma', designation: 'CEO', department: 'management', ctc: 3600000, basic: 150000, hra: 60000, special: 90000, pf: 12, esi: 0, tds: 15 },
      { name: 'Priya Patel', designation: 'CFO', department: 'finance', ctc: 3000000, basic: 130000, hra: 52000, special: 68000, pf: 12, esi: 0, tds: 12 },
      { name: 'Rohan Mehta', designation: 'CTO', department: 'engineering', ctc: 3000000, basic: 130000, hra: 52000, special: 68000, pf: 12, esi: 0, tds: 12 },
      { name: 'Sneha Reddy', designation: 'Senior Engineer', department: 'engineering', ctc: 1800000, basic: 80000, hra: 32000, special: 38000, pf: 12, esi: 0, tds: 8 },
      { name: 'Vikram Singh', designation: 'Engineer', department: 'engineering', ctc: 1200000, basic: 55000, hra: 22000, special: 23000, pf: 12, esi: 0, tds: 5 },
      { name: 'Ananya Iyer', designation: 'Sales Lead', department: 'sales', ctc: 1500000, basic: 65000, hra: 26000, special: 34000, pf: 12, esi: 0, tds: 6 },
      { name: 'Karan Malhotra', designation: 'Sales Executive', department: 'sales', ctc: 900000, basic: 40000, hra: 16000, special: 19000, pf: 12, esi: 0, tds: 3 },
      { name: 'Divya Nair', designation: 'Accountant', department: 'finance', ctc: 840000, basic: 38000, hra: 15000, special: 17000, pf: 12, esi: 0, tds: 2 },
      { name: 'Arjun Gupta', designation: 'Operations Manager', department: 'operations', ctc: 1200000, basic: 55000, hra: 22000, special: 23000, pf: 12, esi: 0, tds: 5 },
      { name: 'Meera Joshi', designation: 'HR Manager', department: 'hr', ctc: 960000, basic: 42000, hra: 17000, special: 21000, pf: 12, esi: 0, tds: 3 },
      { name: 'Sanjay Kumar', designation: 'Office Assistant', department: 'admin', ctc: 360000, basic: 16000, hra: 6400, special: 7600, pf: 12, esi: 0.75, tds: 0 },
      { name: 'Lakshmi Venkat', designation: 'Junior Engineer', department: 'engineering', ctc: 600000, basic: 28000, hra: 11200, special: 10800, pf: 12, esi: 0, tds: 0 },
      { name: 'Rahul Desai', designation: 'Designer', department: 'engineering', ctc: 1080000, basic: 48000, hra: 19200, special: 22800, pf: 12, esi: 0, tds: 4 },
      { name: 'Pooja Kulkarni', designation: 'Marketing Specialist', department: 'operations', ctc: 780000, basic: 35000, hra: 14000, special: 16000, pf: 12, esi: 0, tds: 2 },
    ];
    for (const e of employees) {
      await db.employee.create({
        data: {
          name: e.name,
          email: `${e.name.toLowerCase().replace(/\s+/g, '.')}@gstpilot.in`,
          phone: `+91${Math.floor(9000000000 + Math.random() * 999999999)}`,
          designation: e.designation,
          department: e.department,
          employeeId: `GP-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          pan: `ABCDE${Math.floor(1000 + Math.random() * 8999)}F`,
          uan: `101${Math.floor(1000000000 + Math.random() * 8999999999)}`,
          bankAccount: `${Math.floor(10000000000 + Math.random() * 89999999999)}`,
          ifsc: 'HDFC0001234',
          joiningDate: isoDaysAgo(Math.floor(Math.random() * 365 * 3) + 90),
          ctc: e.ctc,
          basicSalary: e.basic,
          hra: e.hra,
          specialAllowance: e.special,
          pfRate: e.pf,
          esiRate: e.esi,
          tdsRate: e.tds,
          status: 'active',
        },
      });
    }
    console.log(`✅ Created ${employees.length} employees`);
  }

  // ─── 12. Process payroll for current month ─────────────────────────────────
  const month = currentMonth();
  const existingPayroll = await db.payroll.count({ where: { month } });
  if (existingPayroll === 0) {
    const allEmployees = await db.employee.findMany({ where: { status: 'active' } });
    let totalNet = 0;
    let totalCost = 0;
    for (const emp of allEmployees) {
      const pfWage = Math.min(emp.basicSalary, 15000);
      const pfDeduction = Math.round((pfWage * emp.pfRate) / 100);
      const employerPF = pfDeduction;
      const gross = emp.basicSalary + emp.hra + emp.specialAllowance;
      const esiDeduction = gross <= 21000 ? Math.round((gross * emp.esiRate) / 100) : 0;
      const employerESI = gross <= 21000 ? Math.round((gross * 3.25) / 100) : 0;
      const tdsDeduction = Math.round((gross * emp.tdsRate) / 100);
      const professionalTax = MAHARASHTRA_PT;
      const totalDeductions = pfDeduction + esiDeduction + tdsDeduction + professionalTax;
      const netSalary = Math.max(0, gross - totalDeductions);
      await db.payroll.create({
        data: {
          employeeId: emp.id,
          employeeName: emp.name,
          month,
          workingDays: 30,
          daysPresent: 30,
          basicSalary: emp.basicSalary,
          hra: emp.hra,
          specialAllowance: emp.specialAllowance,
          grossSalary: gross,
          pfDeduction,
          esiDeduction,
          tdsDeduction,
          professionalTax,
          otherDeductions: 0,
          totalDeductions,
          netSalary,
          employerPF,
          employerESI,
          status: 'processed',
        },
      });
      totalNet += netSalary;
      totalCost += gross + employerPF + employerESI;
    }
    console.log(`✅ Processed payroll for ${allEmployees.length} employees — net ₹${Math.round(totalNet).toLocaleString('en-IN')}, total cost ₹${Math.round(totalCost).toLocaleString('en-IN')}`);
  } else {
    console.log(`✅ Payroll for ${month} already processed (${existingPayroll} records)`);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  const summary = {
    clients: await db.client.count(),
    invoices: await db.invoice.count(),
    vendors: await db.vendor.count(),
    purchaseBills: await db.purchaseBill.count(),
    expenses: await db.expense.count(),
    receivables: await db.receivable.count(),
    payables: await db.payable.count(),
    payments: await db.payment.count(),
    tdsRecords: await db.tDSRecord.count(),
    employees: await db.employee.count(),
    payrolls: await db.payroll.count(),
  };
  console.log('\n📊 Phase 8 Step 3 — Seed complete. Final state:');
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });

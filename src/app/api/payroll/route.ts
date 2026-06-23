import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedEmployees, generatePayslip } from '@/lib/invoices/payroll'
import type { Employee } from '@/lib/invoices/types'

// GET /api/payroll — Fetch all Employees with their most recent payslip
export async function GET() {
  try {
    const employees = await db.employee.findMany({
      include: {
        payrolls: { orderBy: { period: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!employees || employees.length === 0) {
      return NextResponse.json({ employees: seedEmployees() })
    }

    return NextResponse.json({ employees })
  } catch (error) {
    console.error('GET /api/payroll error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}

// POST /api/payroll — Branch on body shape:
//   (a) { name, designation, salary }        → create a new Employee
//   (b) { period, employeeIds? }             → generate payroll for the period
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { period, employeeIds } = body ?? {}

    // ─── Branch (b): Payroll generation ─────────────────────────────────────
    if (period && typeof period === 'string') {
      // Fetch targeted employees (or all active if not specified)
      const where = employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0
        ? { id: { in: employeeIds }, status: 'active' }
        : { status: 'active' }
      const employees = await db.employee.findMany({ where })

      // Prisma's Employee differs structurally from the lib Employee type
      // (Date vs string on createdAt/updatedAt); cast through unknown to
      // satisfy generatePayslip's parameter type without losing field safety.
      const payslips = employees.map((emp) =>
        generatePayslip(emp as unknown as Employee, period)
      )

      // Persist payslips to DB (individual creates in parallel — Prisma's
      // createMany has stricter input typing that doesn't always accept the
      // engine's NewPayroll shape cleanly; parallel createMany-equivalent).
      let created = 0
      if (payslips.length > 0) {
        const results = await Promise.all(
          payslips.map((p) =>
            db.payroll.create({
              data: {
                employeeId: p.employeeId,
                period: p.period,
                grossSalary: p.grossSalary,
                basic: p.basic,
                hra: p.hra,
                allowances: p.allowances,
                pf: p.pf,
                esi: p.esi,
                tds: p.tds,
                professionalTax: p.professionalTax,
                netSalary: p.netSalary,
                status: 'generated',
                paidAt: null,
                payslipUrl: null,
              },
            }).catch(() => null)
          )
        )
        created = results.filter((r) => r !== null).length
      }

      // Audit log
      await db.auditLog.create({
        data: {
          action: 'Payroll Generated',
          entity: 'payroll',
          entityId: period,
          details: `Generated ${created} payslip(s) for period ${period}`,
        },
      })

      return NextResponse.json(
        { generated: created, payrolls: payslips, period },
        { status: 201 }
      )
    }

    // ─── Branch (a): Create a new Employee ──────────────────────────────────
    const {
      clientId,
      name,
      designation,
      department,
      employeeId,
      pan,
      aadhaar,
      bankAccount,
      ifsc,
      salary,
      basic,
      hra,
      allowances,
      pf,
      esi,
      tds,
      professionalTax,
      status,
      joinedAt,
    } = body ?? {}

    if (!name || !designation || salary === undefined) {
      return NextResponse.json(
        { error: 'name, designation and salary are required to create an employee' },
        { status: 400 }
      )
    }

    const grossSalary = Number(salary) || 0
    const basicVal = Number(basic) || Math.round(grossSalary * 0.5)
    const hraVal = Number(hra) || Math.round(grossSalary * 0.2)
    const allowVal = Number(allowances) || Math.round(grossSalary * 0.3)
    const pfVal = Number(pf) || Math.round(basicVal * 0.12)
    const esiVal = Number(esi) || (grossSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 0)
    const tdsVal = Number(tds) || 0
    const ptVal = Number(professionalTax) || 200
    const netSalary = grossSalary - (pfVal + esiVal + tdsVal + ptVal)

    const employee = await db.employee.create({
      data: {
        clientId: clientId ?? null,
        name,
        designation,
        department: department ?? null,
        employeeId: employeeId ?? null,
        pan: pan ?? null,
        aadhaar: aadhaar ?? null,
        bankAccount: bankAccount ?? null,
        ifsc: ifsc ?? null,
        salary: grossSalary,
        basic: basicVal,
        hra: hraVal,
        allowances: allowVal,
        pf: pfVal,
        esi: esiVal,
        tds: tdsVal,
        professionalTax: ptVal,
        netSalary,
        status: status ?? 'active',
        joinedAt: joinedAt ?? new Date().toISOString().split('T')[0],
      },
      include: { payrolls: { orderBy: { period: 'desc' }, take: 1 } },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        clientId: clientId ?? null,
        action: 'Employee Added',
        entity: 'employee',
        entityId: employee.id,
        details: `New employee ${name} (${designation}) added — gross ₹${grossSalary}`,
      },
    })

    return NextResponse.json({ employees: [employee] }, { status: 201 })
  } catch (error) {
    console.error('POST /api/payroll error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process payroll request' },
      { status: 500 }
    )
  }
}

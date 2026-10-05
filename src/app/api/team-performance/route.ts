import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// Weighted performance score calculation
function calculatePerformanceScore(metrics: {
  invoicesProcessed: number
  reviewsCompleted: number
  approvalsCompleted: number
  averageAccuracy: number
  averageTurnaround: number
}): number {
  // Weights: accuracy 30%, volume 25%, speed 25%, reviews+approvals 20%
  const volumeScore = Math.min(metrics.invoicesProcessed / 100, 1) * 100
  const accuracyScore = metrics.averageAccuracy
  const speedScore = metrics.averageTurnaround > 0
    ? Math.max(0, 100 - (metrics.averageTurnaround / 48) * 100)
    : 50
  const reviewScore = Math.min((metrics.reviewsCompleted + metrics.approvalsCompleted) / 50, 1) * 100

  const weightedScore =
    accuracyScore * 0.3 +
    volumeScore * 0.25 +
    speedScore * 0.25 +
    reviewScore * 0.2

  return Math.round(weightedScore * 100) / 100
}

// GET /api/team-performance — Team performance leaderboard
export async function GET() {
  try {
    const teamMembers = await db.teamMember.findMany({
      where: { isActive: true },
      include: {
        performances: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    })

    // ── Batch aggregations (was N+1: 4 queries × N members) ──
    // Now 2 groupBy queries total, regardless of team-member count.
    const memberIds = teamMembers.map((m) => m.id)

    const [perfAggGroups, workloadGroups] = await Promise.all([
      // Aggregated metrics across all performance records per member.
      // We can't _avg + _sum in a single groupBy on different fields cleanly
      // because Prisma groupBy requires _sum/_avg to be on the same call.
      // Use aggregate per member instead — but batched with groupBy for sums.
      db.teamPerformance.groupBy({
        by: ['teamMemberId'],
        where: { teamMemberId: { in: memberIds } },
        _sum: {
          invoicesProcessed: true,
          reviewsCompleted: true,
          approvalsCompleted: true,
        },
        _avg: {
          averageAccuracy: true,
          averageTurnaround: true,
        },
      }),
      // Workload counts per member, grouped by status.
      db.workloadAssignment.groupBy({
        by: ['teamMemberId', 'status'],
        where: { teamMemberId: { in: memberIds } },
        _count: true,
      }),
    ])

    // Build per-member lookup maps for O(1) enrichment.
    const perfByMember = new Map<string, {
      sumInvoices: number; sumReviews: number; sumApprovals: number;
      avgAccuracy: number; avgTurnaround: number;
    }>()
    for (const g of perfAggGroups) {
      perfByMember.set(g.teamMemberId, {
        sumInvoices: g._sum.invoicesProcessed ?? 0,
        sumReviews: g._sum.reviewsCompleted ?? 0,
        sumApprovals: g._sum.approvalsCompleted ?? 0,
        avgAccuracy: g._avg.averageAccuracy ?? 0,
        avgTurnaround: g._avg.averageTurnaround ?? 0,
      })
    }
    const workloadByMember = new Map<string, { pending: number; inProgress: number; completed: number }>()
    for (const g of workloadGroups) {
      const cid = g.teamMemberId
      const entry = workloadByMember.get(cid) ?? { pending: 0, inProgress: 0, completed: 0 }
      const n = g._count
      if (g.status === 'pending') entry.pending += n
      else if (g.status === 'in_progress') entry.inProgress += n
      else if (g.status === 'completed') entry.completed += n
      workloadByMember.set(cid, entry)
    }

    // Build leaderboard (sync — all data already fetched in batch).
    const leaderboard = teamMembers.map((member) => {
      const latestPerformance = member.performances[0] ?? null
      const agg = perfByMember.get(member.id)
      const wl = workloadByMember.get(member.id) ?? { pending: 0, inProgress: 0, completed: 0 }

      const metrics = {
        invoicesProcessed: agg?.sumInvoices ?? 0,
        reviewsCompleted: agg?.sumReviews ?? 0,
        approvalsCompleted: agg?.sumApprovals ?? 0,
        averageAccuracy: Math.round((agg?.avgAccuracy ?? 0) * 100) / 100,
        averageTurnaround: Math.round((agg?.avgTurnaround ?? 0) * 100) / 100,
      }

      const score = calculatePerformanceScore(metrics)

      return {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        department: member.department,
        avatar: member.avatar,
        latestPerformance,
        aggregatedMetrics: metrics,
        performanceScore: score,
        workload: {
          pending: wl.pending,
          inProgress: wl.inProgress,
          completed: wl.completed,
        },
      }
    })

    // Sort by performance score descending
    leaderboard.sort((a, b) => b.performanceScore - a.performanceScore)

    // Assign ranks
    const ranked = leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))

    return NextResponse.json({ leaderboard: ranked })
  } catch (error) {
    console.error('GET /api/team-performance error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch team performance' },
      { status: 500 }
    )
  }
}

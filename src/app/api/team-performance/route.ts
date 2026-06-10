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

    // Also get aggregated performance data for each member
    const leaderboard = await Promise.all(
      teamMembers.map(async (member) => {
        const latestPerformance = member.performances[0] ?? null

        // Aggregated metrics across all performance records
        const aggregated = await db.teamPerformance.aggregate({
          where: { teamMemberId: member.id },
          _sum: {
            invoicesProcessed: true,
            reviewsCompleted: true,
            approvalsCompleted: true,
          },
          _avg: {
            averageAccuracy: true,
            averageTurnaround: true,
          },
        })

        const metrics = {
          invoicesProcessed: aggregated._sum.invoicesProcessed ?? 0,
          reviewsCompleted: aggregated._sum.reviewsCompleted ?? 0,
          approvalsCompleted: aggregated._sum.approvalsCompleted ?? 0,
          averageAccuracy: Math.round((aggregated._avg.averageAccuracy ?? 0) * 100) / 100,
          averageTurnaround: Math.round((aggregated._avg.averageTurnaround ?? 0) * 100) / 100,
        }

        const score = calculatePerformanceScore(metrics)

        // Get current workload stats
        const pendingAssignments = await db.workloadAssignment.count({
          where: { teamMemberId: member.id, status: 'pending' },
        })
        const inProgressAssignments = await db.workloadAssignment.count({
          where: { teamMemberId: member.id, status: 'in_progress' },
        })
        const completedAssignments = await db.workloadAssignment.count({
          where: { teamMemberId: member.id, status: 'completed' },
        })

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
            pending: pendingAssignments,
            inProgress: inProgressAssignments,
            completed: completedAssignments,
          },
        }
      })
    )

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

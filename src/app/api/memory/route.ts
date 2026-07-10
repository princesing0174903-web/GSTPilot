// ═══════════════════════════════════════════════════════════════════════════════
// /api/memory — Business Memory™ main route
//
//   GET  ?email=...                     → full memory object (all 8 categories)
//   PATCH { email, category, data }     → upsert profile / firm / preferences
//   DELETE ?email=...                   → clear all memory for this user
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import {
  getFullMemory,
  upsertProfile,
  upsertFirm,
  upsertPreferences,
  clearAllMemory,
  type ProfileData,
  type FirmData,
  type PreferenceData,
} from '@/lib/business-memory'

export async function GET(req: NextRequest) {
  try {
    const email = new URL(req.url).searchParams.get('email')
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }
    const memory = await getFullMemory(email)
    return NextResponse.json({ memory })
  } catch (error) {
    console.error('[/api/memory] GET failed:', error)
    return NextResponse.json({ error: 'Failed to load memory' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, category, data } = body as {
      email: string
      category: 'profile' | 'firm' | 'preferences'
      data: Partial<ProfileData> | Partial<FirmData> | Partial<PreferenceData>
    }

    if (!email || !category || !data) {
      return NextResponse.json(
        { error: 'email, category, and data are required' },
        { status: 400 },
      )
    }

    if (category === 'profile') {
      await upsertProfile(email, data as Partial<ProfileData>)
    } else if (category === 'firm') {
      await upsertFirm(email, data as Partial<FirmData>)
    } else if (category === 'preferences') {
      await upsertPreferences(email, data as Partial<PreferenceData>)
    } else {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/memory] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to update memory' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const email = new URL(req.url).searchParams.get('email')
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }
    await clearAllMemory(email)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/memory] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to clear memory' }, { status: 500 })
  }
}

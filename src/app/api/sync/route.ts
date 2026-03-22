import { NextRequest, NextResponse } from 'next/server'
import Pusher from 'pusher'

// Initialise Pusher server-side (runs only on Vercel/Node, never in browser)
const pusher = new Pusher({
  appId:   process.env.PUSHER_APP_ID!,
  key:     process.env.PUSHER_KEY!,
  secret:  process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS:  true,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { type: string; state: unknown }

    // Broadcast to the 'elim-church' channel
    // All connected /screen pages will receive this instantly
    await pusher.trigger('elim-church', body.type, body.state)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Pusher sync error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
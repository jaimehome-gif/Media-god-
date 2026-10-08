import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

const fallback = async () =>
  new Response('Authentication service is not configured', { status: 503 })

export const { GET, POST } = auth
  ? toNextJsHandler(auth.handler)
  : { GET: fallback, POST: fallback }

import { auth } from "./auth"
import { cookies } from "next/headers"
import { headers } from "next/headers"

export async function getSession() {
  try {
    const cookieStore = await cookies()
    const allHeaders = await headers()
    const session = await auth.api.getSession({
      headers: allHeaders,
    })
    return session
  } catch (err) {
    console.error('getSession error:', err)
    return null
  }
}

export async function getUserId(): Promise<string | null> {
  const session = await getSession()
  return session?.user?.id || null
}


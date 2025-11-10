import { auth } from "./auth"
import { cookies } from "next/headers"

export async function getSession() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get("better-auth.session_token")?.value
  
  if (!sessionToken) {
    return null
  }
  
  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: `better-auth.session_token=${sessionToken}`,
      },
    })
    return session
  } catch {
    return null
  }
}

export async function getUserId(): Promise<string | null> {
  const session = await getSession()
  return session?.user?.id || null
}


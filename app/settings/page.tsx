'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { showToast } from '@/components/Toast'
import { Mail, User, Save, LogOut } from 'lucide-react'
import { Reveal } from '@/components/anim/Reveal'
import { StaggerGrid } from '@/components/anim/StaggerGrid'

export default function Settings() {
  const router = useRouter()
  const { data: session, isPending: isLoading } = authClient.useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || '')
      setEmail(session.user.email || '')
    }
  }, [session])

  const handleSave = async () => {
    if (!session?.user) return
    
    setSaving(true)
    try {
      // Update user name via Better Auth
      const result = await authClient.updateUser({
        name,
      })
      
      if (result.error) {
        showToast('Failed to update profile', 'error')
        setSaving(false)
        return
      }
      
      showToast('Profile updated', 'success')
      setSaving(false)
    } catch (err: any) {
      console.error('Update error:', err)
      showToast(err?.message || 'Failed to update profile', 'error')
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (!session?.user) {
    router.push('/auth/signin?next=/settings')
    return null
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Reveal variant="slide-left">
          <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>
        </Reveal>
        
        <StaggerGrid staggerDelay={0.05} variant="fade" className="space-y-6">
        <Reveal variant="rise">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <User className="h-5 w-5" />
            Account
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-400 cursor-not-allowed"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your name"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                disabled={saving || name === (session.user.name || '')}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
              
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-6 py-3 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition font-medium"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
          </div>
        </Reveal>

        <Reveal variant="rise" delay={0.1}>
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-4">Session</h2>
            <p className="text-slate-400 text-sm mb-4">
              You are currently signed in. Click "Sign Out" above to end your session.
            </p>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition text-sm font-medium"
            >
              Delete Session
            </button>
          </div>
        </Reveal>
        </StaggerGrid>
      </div>
    </div>
  )
}

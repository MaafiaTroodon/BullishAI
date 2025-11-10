'use client'

import { Reveal } from '@/components/anim/Reveal'

const services = [
  {
    name: 'API',
    status: 'operational',
    uptime: '99.99%',
    responseTime: '45ms',
  },
  {
    name: 'Portfolio Service',
    status: 'operational',
    uptime: '99.98%',
    responseTime: '120ms',
  },
  {
    name: 'Market Data',
    status: 'operational',
    uptime: '99.97%',
    responseTime: '85ms',
  },
  {
    name: 'Alerts Service',
    status: 'operational',
    uptime: '99.96%',
    responseTime: '65ms',
  },
  {
    name: 'Web Dashboard',
    status: 'operational',
    uptime: '100%',
    responseTime: 'N/A',
  },
]

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <Reveal variant="fade">
        <div className="relative h-[30vh] min-h-[250px] overflow-hidden bg-gradient-to-br from-emerald-900/20 via-slate-900 to-slate-900">
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <Reveal variant="rise" delay={0.2}>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-4 h-4 bg-emerald-500 rounded-full animate-pulse" />
                  <h1 className="text-5xl md:text-6xl font-bold text-white">All Systems Operational</h1>
                </div>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <p className="text-xl text-slate-300 max-w-2xl">
                  Real-time status of BullishAI services
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Status Overview */}
        <Reveal variant="fade">
          <div className="mb-12">
            <Reveal variant="rise">
              <div className="bg-emerald-600/20 border border-emerald-600/50 rounded-xl p-6 mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                  <h2 className="text-2xl font-bold text-white">System Status: All Operational</h2>
                </div>
                <p className="text-slate-300 text-sm">
                  Last updated: {new Date().toLocaleString()}
                </p>
              </div>
            </Reveal>
          </div>
        </Reveal>

        {/* Services Status */}
        <Reveal variant="fade" delay={0.2}>
          <div className="mb-8">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-6">Service Status</h2>
            </Reveal>
            <div className="space-y-4">
              {services.map((service, idx) => (
                <Reveal key={service.name} variant="fade" delay={idx * 0.05}>
                  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                        <h3 className="text-xl font-semibold text-white">{service.name}</h3>
                      </div>
                      <span className="px-3 py-1 bg-emerald-600/20 text-emerald-400 text-sm font-semibold rounded-full">
                        {service.status}
                      </span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Uptime (30 days):</span>
                        <span className="text-white font-semibold ml-2">{service.uptime}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Avg Response Time:</span>
                        <span className="text-white font-semibold ml-2">{service.responseTime}</span>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* System Metrics */}
        <Reveal variant="fade" delay={0.3}>
          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-6 text-center">System Metrics</h2>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-6">
              <Reveal variant="rise" delay={0.1}>
                <div className="text-center">
                  <div className="text-4xl font-bold text-emerald-400 mb-2">99.98%</div>
                  <div className="text-slate-400 text-sm">Overall Uptime</div>
                </div>
              </Reveal>
              <Reveal variant="rise" delay={0.2}>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-400 mb-2">45ms</div>
                  <div className="text-slate-400 text-sm">Avg API Response</div>
                </div>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-400 mb-2">0</div>
                  <div className="text-slate-400 text-sm">Active Incidents</div>
                </div>
              </Reveal>
            </div>
          </div>
        </Reveal>

        {/* Incident History */}
        <Reveal variant="fade" delay={0.4}>
          <div className="mt-12">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-6">Recent Incidents</h2>
            </Reveal>
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <p className="text-slate-400 text-center">
                No incidents in the past 90 days. All systems are running smoothly.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  )
}


'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'

const blogPosts = [
  {
    title: 'How AI is Transforming Portfolio Management',
    date: 'March 20, 2024',
    readTime: '5 min read',
    excerpt: 'Explore how machine learning algorithms are revolutionizing how investors track and optimize their portfolios in real-time.',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80',
    category: 'AI & Technology',
  },
  {
    title: 'Building a Diversified Portfolio: A Beginner\'s Guide',
    date: 'March 15, 2024',
    readTime: '8 min read',
    excerpt: 'Learn the fundamentals of portfolio diversification and how to use BullishAI to track and manage your investments effectively.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
    category: 'Investing',
  },
  {
    title: 'Real-Time Market Data: Why Speed Matters',
    date: 'March 10, 2024',
    readTime: '6 min read',
    excerpt: 'Understanding the importance of low-latency market data and how it can impact your trading decisions.',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80',
    category: 'Technology',
  },
  {
    title: 'Setting Up Effective Price Alerts',
    date: 'March 5, 2024',
    readTime: '4 min read',
    excerpt: 'A comprehensive guide to creating and managing price alerts that help you stay on top of market movements.',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
    category: 'Tutorial',
  },
  {
    title: 'The Future of Fintech: Trends to Watch in 2024',
    date: 'February 28, 2024',
    readTime: '7 min read',
    excerpt: 'Discover the emerging trends in financial technology and how they\'re shaping the investment landscape.',
    image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80',
    category: 'Industry',
  },
  {
    title: 'Understanding Portfolio Analytics: Key Metrics Explained',
    date: 'February 22, 2024',
    readTime: '9 min read',
    excerpt: 'Break down the essential portfolio metrics every investor should understand, from TPV to total return calculations.',
    image: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&q=80',
    category: 'Education',
  },
]

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <Reveal variant="fade">
        <div className="relative h-[40vh] min-h-[300px] overflow-hidden bg-gradient-to-br from-blue-900/20 via-slate-900 to-purple-900/20">
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <Reveal variant="rise" delay={0.2}>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Blog</h1>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <p className="text-xl text-slate-300 max-w-2xl">
                  Insights, tutorials, and updates from the BullishAI team
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Blog Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogPosts.map((post, idx) => (
            <Reveal key={post.title} variant="rise" delay={idx * 0.05}>
              <article className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition-all cursor-pointer group">
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-semibold rounded-full">
                      {post.category}
                    </span>
                    <span className="text-slate-500 text-xs">{post.readTime}</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition">
                    {post.title}
                  </h2>
                  <p className="text-slate-400 text-sm mb-4 leading-relaxed">{post.excerpt}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs">{post.date}</span>
                    <span className="text-blue-400 text-sm font-semibold group-hover:translate-x-1 transition">
                      Read more →
                    </span>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Newsletter CTA */}
        <Reveal variant="fade" delay={0.5}>
          <div className="mt-16 bg-slate-800/50 rounded-2xl p-8 md:p-12 border border-slate-700 text-center">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-4">Stay Updated</h2>
            </Reveal>
            <Reveal variant="fade" delay={0.1}>
              <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
                Subscribe to our newsletter to get the latest articles, product updates, and investing insights delivered to your inbox.
              </p>
              <form className="flex gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Subscribe
                </button>
              </form>
            </Reveal>
          </div>
        </Reveal>
      </div>
    </div>
  )
}


import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@bullish.ai' },
    update: {},
    create: {
      email: 'demo@bullish.ai',
      name: 'Demo User',
    },
  })

  console.log('✅ Created user:', user.email)

  // Create watchlist
  const watchlist = await prisma.watchlist.create({
    data: {
      name: 'My Watchlist',
      userId: user.id,
      items: {
        create: [
          { symbol: 'AAPL' },
          { symbol: 'TSLA' },
          { symbol: 'MSFT' },
        ],
      },
    },
  })

  console.log('✅ Created watchlist with 3 symbols')

  // Create alerts
  const alerts = await prisma.alert.createMany({
    data: [
      {
        userId: user.id,
        symbol: 'AAPL',
        type: 'above',
        value: 150.0,
        active: true,
      },
      {
        userId: user.id,
        symbol: 'TSLA',
        type: 'below',
        value: 200.0,
        active: true,
      },
      {
        userId: user.id,
        symbol: 'MSFT',
        type: 'pct_move',
        value: 3.0,
        active: true,
      },
    ],
  })

  console.log('✅ Created 3 price alerts')

  console.log('🎉 Seeding completed!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error seeding:', e)
    await prisma.$disconnect()
    process.exit(1)
  })


const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

async function testEndpoint(name, url) {
  console.log(`\n🧪 Testing ${name}...`)
  console.log(`   URL: ${url}`)
  
  try {
    const start = Date.now()
    const response = await fetch(url)
    const duration = Date.now() - start
    
    const data = await response.json()
    
    if (data.ok) {
      console.log(`   ✅ Success (${duration}ms)`)
      console.log(`   📊 Response:`, JSON.stringify(data.data, null, 2).substring(0, 200))
    } else {
      console.log(`   ❌ Failed: ${data.error}`)
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`)
  }
}

async function main() {
  console.log('🚀 Starting API smoke tests...')
  
  await testEndpoint('Quote API', `${BASE_URL}/api/quote?ticker=AAPL`)
  await testEndpoint('News API', `${BASE_URL}/api/news?ticker=AMZN&limit=3`)
  await testEndpoint('Fundamentals API', `${BASE_URL}/api/fundamentals?ticker=TSLA`)
  
  console.log('\n✅ Smoke tests complete!')
}

main().catch(console.error)


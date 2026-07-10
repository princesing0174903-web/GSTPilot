import { seedAppMarketplace } from '../src/lib/app-platform/seed'

async function main() {
  const result = await seedAppMarketplace()
  console.log('Seed result:', JSON.stringify(result, null, 2))
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })

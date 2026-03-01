require('dotenv').config();
const pool = require('./pool');

const starterServices = [
  { name: 'Haircut', category: 'Cuts', duration_minutes: 30, price: 25.00, is_popular: true },
  { name: 'Beard Trim', category: 'Grooming', duration_minutes: 20, price: 15.00, is_popular: false },
  { name: 'Haircut + Beard', category: 'Combos', duration_minutes: 45, price: 35.00, is_popular: true },
  { name: 'Straight Razor Shave', category: 'Grooming', duration_minutes: 30, price: 30.00, is_popular: false },
  { name: 'Lineup', category: 'Cuts', duration_minutes: 15, price: 10.00, is_popular: false },
];

async function seed(businessId) {
  console.log(`Seeding starter services for business ${businessId}...`);
  for (const svc of starterServices) {
    await pool.query(
      `INSERT INTO services (business_id, name, category, duration_minutes, price, is_popular)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [businessId, svc.name, svc.category, svc.duration_minutes, svc.price, svc.is_popular]
    );
  }
  console.log('✅ Seed complete');
  await pool.end();
}

const bizId = process.argv[2];
if (!bizId) {
  console.error('Usage: node seed.js <business_id>');
  process.exit(1);
}
seed(bizId);

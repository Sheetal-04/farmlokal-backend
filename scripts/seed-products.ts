import { mysqlPool } from '../src/config/mysql';

const TOTAL_RECORDS = 1_000_000;   // 1M+ as required by the spec
const BATCH_SIZE = 5000;

const categories = [
  'vegetables',
  'fruits',
  'dairy',
  'grains',
  'beverages'
];

function randomFrom<T>(arr: readonly T[]): T {
  const index = Math.floor(Math.random() * arr.length);
  return arr[index]!;
}

function generateProduct(index: number) {
  return {
    name: `Product ${index}`,
    description: `Description for product ${index}`,
    category: randomFrom(categories),
    price: Number((Math.random() * 500 + 10).toFixed(2))
  };
}

async function seed() {
  console.log('🌱 Seeding products...');

  for (let i = 0; i < TOTAL_RECORDS; i += BATCH_SIZE) {
    const values = [];

    for (let j = 0; j < BATCH_SIZE && i + j < TOTAL_RECORDS; j++) {
      const p = generateProduct(i + j);

      values.push([
        p.name,
        p.description,
        p.category,
        p.price
      ]);
    }

    await mysqlPool.query(
      `
      INSERT INTO products (name, description, category, price)
      VALUES ?
      `,
      [values]
    );

    console.log(`Inserted ${i + values.length}/${TOTAL_RECORDS}`);
  }

  console.log('✅ Product seeding completed');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed', err);
  process.exit(1);
});

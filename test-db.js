const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://root:NSF7pXYwX22ZFOt3NinY@localhost:5443/quanly-pk'
  });
  await client.connect();
  console.log('Connected to DB');

  const start = new Date('2026-04-30');
  start.setHours(0, 0, 0, 0);
  const end = new Date('2026-05-30');
  end.setHours(23, 59, 59, 999);

  const params = [start, end];

  const queries = {
    totalsQuery: `
      SELECT 
        COUNT(DISTINCT o.id) as "totalOrders",
        COALESCE(SUM(o."totalAmount"), 0) as "totalRevenue"
      FROM orders o
      WHERE o.status = 'COMPLETED' AND o."createdAt" >= $1 AND o."createdAt" <= $2
    `,
    cogsQuery: `
      SELECT COALESCE(SUM(ABS(il.quantity) * ib."costPrice"), 0) as "totalCost"
      FROM orders o
      INNER JOIN inventory_logs il ON o."orderCode" = il."referenceCode" AND il.type = 'SALE'
      INNER JOIN inventory_batches ib ON il."batchId"::uuid = ib.id
      WHERE o.status = 'COMPLETED' AND o."createdAt" >= $1 AND o."createdAt" <= $2
    `,
    chartQuery: `
      SELECT TO_CHAR(o."createdAt", 'YYYY-MM-DD') as date, COALESCE(SUM(o."totalAmount"), 0) as revenue
      FROM orders o
      WHERE o.status = 'COMPLETED' AND o."createdAt" >= $1 AND o."createdAt" <= $2
      GROUP BY TO_CHAR(o."createdAt", 'YYYY-MM-DD')
    `,
    costChartQuery: `
      SELECT TO_CHAR(o."createdAt", 'YYYY-MM-DD') as date, COALESCE(SUM(ABS(il.quantity) * ib."costPrice"), 0) as cost
      FROM orders o
      INNER JOIN inventory_logs il ON o."orderCode" = il."referenceCode" AND il.type = 'SALE'
      INNER JOIN inventory_batches ib ON il."batchId"::uuid = ib.id
      WHERE o.status = 'COMPLETED' AND o."createdAt" >= $1 AND o."createdAt" <= $2
      GROUP BY TO_CHAR(o."createdAt", 'YYYY-MM-DD')
    `,
    petsQuery: `SELECT species, COUNT(id) as count FROM pets GROUP BY species`,
    apptsQuery: `
      SELECT status, COUNT(id) as count 
      FROM appointments 
      WHERE "createdAt" >= $1 AND "createdAt" <= $2
      GROUP BY status
    `,
    cagesQuery: `SELECT status, COUNT(id) as count FROM cages GROUP BY status`,
    topProductsQuery: `
      SELECT 
        p.name,
        SUM(oi.quantity) as sold_quantity,
        SUM(oi."totalPrice") as revenue
      FROM order_items oi
      INNER JOIN orders o ON oi."orderId" = o.id
      INNER JOIN products p ON oi."productId" = p.id
      WHERE o.status = 'COMPLETED' AND o."createdAt" >= $1 AND o."createdAt" <= $2
      GROUP BY p.id, p.name
      ORDER BY sold_quantity DESC
      LIMIT 5
    `,
    lowStockQuery: `
      SELECT p.name, SUM(ib."currentQuantity") as remaining_quantity
      FROM products p
      INNER JOIN inventory_batches ib ON p.id = ib."productId"
      GROUP BY p.id, p.name
      HAVING SUM(ib."currentQuantity") < 10
      ORDER BY remaining_quantity ASC
      LIMIT 5
    `
  };

  for (const [name, sql] of Object.entries(queries)) {
    try {
      console.log(`Running ${name}...`);
      const hasParams = sql.includes('$1');
      const res = await client.query(sql, hasParams ? params : []);
      console.log(`✅ ${name} succeeded with ${res.rowCount} rows`);
    } catch (err) {
      console.error(`❌ ${name} failed:`, err.message);
    }
  }

  await client.end();
}

main().catch(console.error);

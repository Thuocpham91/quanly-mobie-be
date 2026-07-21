/**
 * Migration script: service_orders -> orders
 * Usage (from project root d:\\duan\\quanly-mobie\\quanly-mobie-be-service):
 *   SYSTEM_USER_ID=<uuid> ts-node ./scripts/migrate-service-orders-to-orders.ts
 * Requires: npm i pg dotenv
 */
import 'dotenv/config';
import { Pool } from 'pg';

const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_USERNAME = 'postgres',
  DB_PASSWORD = '',
  DB_DATABASE = 'postgres',
  SYSTEM_USER_ID,
} = process.env;

if (!SYSTEM_USER_ID) {
  console.error('Please set SYSTEM_USER_ID env var to a valid user UUID.');
  process.exit(1);
}

const pool = new Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_DATABASE,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Fetching service orders...');
    const res = await client.query('SELECT * FROM service_orders');
    console.log(`Found ${res.rows.length} service_orders`);

    for (const row of res.rows) {
      const existing = await client.query('SELECT id FROM orders WHERE order_code = $1', [row.ordercode || row.order_code || row.orderCode]);
      if (existing.rowCount > 0) {
        console.log(`Skipping existing orderCode=${row.ordercode || row.order_code || row.orderCode}`);
        continue;
      }

      const orderCode = row.ordercode || row.order_code || row.orderCode;
      const quoted = Number(row.quotedamount ?? row.quoted_amount ?? row.quotedAmount ?? 0);
      const discount = Number(row.discount ?? 0);
      const totalAmount = quoted - discount;

      // Map service order status to order status
      let status = 'PENDING';
      const soStatus = row.status;
      if (soStatus === 'COMPLETED') status = 'COMPLETED';
      if (soStatus === 'CANCELLED') status = 'CANCELLED';

      // Build notes JSON
      const notesObj: any = {
        jobDescription: row.jobdescription || row.job_description || row.jobDescription || null,
        completedItems: row.completeditems || row.completed_items || row.completedItems || null,
        address: row.address || null,
        customerLocation: row.customerlocation || row.customer_location || null,
        appointmentDate: row.appointmentdate || row.appointment_date || null,
        appointmentTime: row.appointmenttime || row.appointment_time || null,
      };

      const notes = JSON.stringify(notesObj);

      const insertSql = `
        INSERT INTO orders (id, order_code, customer_id, branch_id, created_by_id, sub_total, discount, total_amount, status, payment_method, notes, "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `;

      const params = [
        row.id,
        orderCode,
        row.customerid || row.customer_id || row.customerId,
        row.branchid || row.branch_id || row.branchId,
        SYSTEM_USER_ID,
        quoted,
        discount,
        totalAmount,
        status,
        'CASH',
        notes,
        row.createdat || row.created_at || row.createdAt || new Date(),
        row.updatedat || row.updated_at || row.updatedAt || new Date(),
      ];

      await client.query(insertSql, params);
      console.log(`Migrated service order ${orderCode}`);
    }

    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

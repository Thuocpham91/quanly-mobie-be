import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { InventoryLog } from '../inventory/entities/inventory-log.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { InventoryBatch } from '../inventory/entities/inventory-batch.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemsRepo: Repository<OrderItem>,
    @InjectRepository(InventoryLog) private logsRepo: Repository<InventoryLog>,
    @InjectRepository(Customer) private customersRepo: Repository<Customer>,
    @InjectRepository(Appointment) private appointmentsRepo: Repository<Appointment>,
    @InjectRepository(InventoryBatch) private batchesRepo: Repository<InventoryBatch>,
  ) {}

  async getStatistics(startDate: string, endDate: string, branchId?: string) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let branchCondition = '';
    const params: any[] = [start, end];
    if (branchId && branchId !== 'undefined' && branchId !== 'null') {
      branchCondition = 'AND o."branchId" = $3';
      params.push(branchId);
    }

    // --- 1. FINANCIAL TOTALS ---
    const totalsQuery = `
      SELECT 
        COUNT(DISTINCT o.id) as "totalOrders",
        COALESCE(SUM(o."totalAmount"), 0) as "totalRevenue"
      FROM orders o
      WHERE o.status = 'COMPLETED' AND o."createdAt" >= $1 AND o."createdAt" <= $2 ${branchCondition}
    `;

    const costCte = `
      WITH completed_orders AS (
        SELECT o.id, o."orderCode", o."createdAt", o."branchId"
        FROM orders o
        WHERE o.status = 'COMPLETED' AND o."createdAt" >= $1 AND o."createdAt" <= $2 ${branchCondition}
      ), item_quantities AS (
        SELECT oi."orderId", oi."productId", SUM(oi.quantity) AS quantity
        FROM order_items oi
        INNER JOIN completed_orders o ON oi."orderId" = o.id
        GROUP BY oi."orderId", oi."productId"
      ), item_costs AS (
        SELECT
          o.id AS "orderId",
          o."createdAt",
          oi."productId",
          oi.quantity,
          COALESCE(sale.quantity, 0) AS "trackedQuantity",
          COALESCE(sale.cost, 0) AS "trackedCost",
          MAX(batch_cost.cost) AS "fallbackCost"
        FROM completed_orders o
        INNER JOIN item_quantities oi ON oi."orderId" = o.id
        LEFT JOIN LATERAL (
          SELECT
            SUM(ABS(il.quantity)) AS quantity,
            SUM(ABS(il.quantity) * ib."costPrice") AS cost
          FROM inventory_logs il
          INNER JOIN inventory_batches ib ON il."batchId"::uuid = ib.id
          WHERE il."referenceCode" = o."orderCode"
            AND il."productId" = oi."productId"
            AND il.type = 'SALE'
        ) sale ON TRUE
        LEFT JOIN LATERAL (
          SELECT COALESCE(
            SUM(ib."importedQuantity" * ib."costPrice") / NULLIF(SUM(ib."importedQuantity"), 0),
            AVG(ib."costPrice"),
            0
          ) AS cost
          FROM inventory_batches ib
          WHERE ib."productId" = oi."productId"
            AND ib."branchId" = o."branchId"
        ) batch_cost ON TRUE
        GROUP BY o.id, o."createdAt", oi."productId", oi.quantity, sale.quantity, sale.cost
      ), order_costs AS (
        SELECT
          "orderId",
          "createdAt",
          SUM(
            "trackedCost" + GREATEST(quantity - "trackedQuantity", 0) * COALESCE("fallbackCost", 0)
          ) AS cost
        FROM item_costs
        GROUP BY "orderId", "createdAt"
      )
    `;

    const cogsQuery = `${costCte}
      SELECT COALESCE(SUM(cost), 0) AS "totalCost"
      FROM order_costs
    `;

    // --- 2. CHART DATA ---
    const chartQuery = `
      SELECT TO_CHAR(o."createdAt", 'YYYY-MM-DD') as date, COALESCE(SUM(o."totalAmount"), 0) as revenue
      FROM orders o
      WHERE o.status = 'COMPLETED' AND o."createdAt" >= $1 AND o."createdAt" <= $2 ${branchCondition}
      GROUP BY TO_CHAR(o."createdAt", 'YYYY-MM-DD')
    `;

    const costChartQuery = `${costCte}
      SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') AS date, COALESCE(SUM(cost), 0) AS cost
      FROM order_costs
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
    `;

    // --- 3. CUSTOMERS ---
    const allCustomers = await this.customersRepo.count();

    // --- 5. APPOINTMENTS ---
    let apptBranchCond = '';
    if (branchId && branchId !== 'undefined' && branchId !== 'null') apptBranchCond = 'AND "branchId" = $3';
    const apptsQuery = `
      SELECT status, COUNT(id) as count 
      FROM appointments 
      WHERE "createdAt" >= $1 AND "createdAt" <= $2 ${apptBranchCond}
      GROUP BY status
    `;

    // --- 7. TOP PRODUCTS ---
    const topProductsQuery = `
      SELECT 
        p.id,
        p.name,
        SUM(oi.quantity) as sold_quantity,
        SUM(oi."totalPrice") as revenue
      FROM order_items oi
      INNER JOIN orders o ON oi."orderId" = o.id
      INNER JOIN products p ON oi."productId" = p.id
      WHERE o.status = 'COMPLETED' AND o."createdAt" >= $1 AND o."createdAt" <= $2 ${branchCondition}
      GROUP BY p.id, p.name
      ORDER BY sold_quantity DESC
      LIMIT 20
    `;

    // --- 8. LOW STOCK ALERT ---
    // Total current quantity of all batches for each product
    let stockBranchCond = '';
    const stockParams: any[] = [];
    if (branchId && branchId !== 'undefined' && branchId !== 'null') {
      stockBranchCond = 'WHERE ib."branchId" = $1';
      stockParams.push(branchId);
    }
    const lowStockQuery = `
      SELECT p.name, SUM(ib."currentQuantity") as remaining_quantity
      FROM products p
      INNER JOIN inventory_batches ib ON p.id = ib."productId"
      ${stockBranchCond}
      GROUP BY p.id, p.name
      HAVING SUM(ib."currentQuantity") < 10
      ORDER BY remaining_quantity ASC
      LIMIT 5
    `;

    // EXECUTE QUERIES
    const [
      totalsResult, cogsResult, chartRevenueResult, chartCostResult,
      apptsResult, topProductsResult, lowStockResult
    ] = await Promise.all([
      this.ordersRepo.query(totalsQuery, params),
      this.ordersRepo.query(cogsQuery, params),
      this.ordersRepo.query(chartQuery, params),
      this.ordersRepo.query(costChartQuery, params),
      this.appointmentsRepo.query(apptsQuery, params),
      this.orderItemsRepo.query(topProductsQuery, params),
      this.batchesRepo.query(lowStockQuery, stockParams),
    ]);

    // PROCESS RESULTS
    const totalOrders = Number(totalsResult[0]?.totalOrders || 0);
    const totalRevenue = Number(totalsResult[0]?.totalRevenue || 0);
    const totalCost = Number(cogsResult[0]?.totalCost || 0);
    const totalProfit = totalRevenue - totalCost;

    // Charts
    const chartMap = new Map<string, { date: string; revenue: number; cost: number; profit: number }>();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      chartMap.set(dateStr, { date: dateStr, revenue: 0, cost: 0, profit: 0 });
    }
    for (const row of chartRevenueResult) if (chartMap.has(row.date)) chartMap.get(row.date)!.revenue = Number(row.revenue);
    for (const row of chartCostResult) if (chartMap.has(row.date)) chartMap.get(row.date)!.cost = Number(row.cost);
    const chartData = Array.from(chartMap.values()).map(item => ({ ...item, profit: item.revenue - item.cost })).sort((a, b) => a.date.localeCompare(b.date));

    // Appointments
    const apptsData = apptsResult.map((a: any) => ({ name: a.status, value: Number(a.count) }));
    const totalAppts = apptsData.reduce((sum: number, a: any) => sum + a.value, 0);

    // Top Products
    const topProducts = topProductsResult.map((p: any) => ({ id: p.id, name: p.name, sold: Number(p.sold_quantity), revenue: Number(p.revenue) }));

    // Low Stock
    const lowStock = lowStockResult.map((l: any) => ({ name: l.name, remaining: Number(l.remaining_quantity) }));

    return {
      totals: { revenue: totalRevenue, cost: totalCost, profit: totalProfit, orders: totalOrders, customers: allCustomers },
      chartData,
      appointments: { total: totalAppts, data: apptsData },
      topProducts,
      lowStock
    };
  }
}


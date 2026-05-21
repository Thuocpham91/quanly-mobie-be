import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { InventoryLog } from '../inventory/entities/inventory-log.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Pet } from '../pets/entities/pet.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Cage } from '../cages/entities/cage.entity';
import { InventoryBatch } from '../inventory/entities/inventory-batch.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemsRepo: Repository<OrderItem>,
    @InjectRepository(InventoryLog) private logsRepo: Repository<InventoryLog>,
    @InjectRepository(Customer) private customersRepo: Repository<Customer>,
    @InjectRepository(Pet) private petsRepo: Repository<Pet>,
    @InjectRepository(Appointment) private appointmentsRepo: Repository<Appointment>,
    @InjectRepository(Cage) private cagesRepo: Repository<Cage>,
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

    const cogsQuery = `
      SELECT COALESCE(SUM(ABS(il.quantity) * ib."costPrice"), 0) as "totalCost"
      FROM orders o
      INNER JOIN inventory_logs il ON o."orderCode" = il."referenceCode" AND il.type = 'SALE'
      INNER JOIN inventory_batches ib ON il."batchId" = ib.id
      WHERE o.status = 'COMPLETED' AND o."createdAt" >= $1 AND o."createdAt" <= $2 ${branchCondition}
    `;

    // --- 2. CHART DATA ---
    const chartQuery = `
      SELECT TO_CHAR(o."createdAt", 'YYYY-MM-DD') as date, COALESCE(SUM(o."totalAmount"), 0) as revenue
      FROM orders o
      WHERE o.status = 'COMPLETED' AND o."createdAt" >= $1 AND o."createdAt" <= $2 ${branchCondition}
      GROUP BY TO_CHAR(o."createdAt", 'YYYY-MM-DD')
    `;

    const costChartQuery = `
      SELECT TO_CHAR(o."createdAt", 'YYYY-MM-DD') as date, COALESCE(SUM(ABS(il.quantity) * ib."costPrice"), 0) as cost
      FROM orders o
      INNER JOIN inventory_logs il ON o."orderCode" = il."referenceCode" AND il.type = 'SALE'
      INNER JOIN inventory_batches ib ON il."batchId" = ib.id
      WHERE o.status = 'COMPLETED' AND o."createdAt" >= $1 AND o."createdAt" <= $2 ${branchCondition}
      GROUP BY TO_CHAR(o."createdAt", 'YYYY-MM-DD')
    `;

    // --- 3. CUSTOMERS ---
    const allCustomers = await this.customersRepo.count();

    // --- 4. PETS ---
    const petsQuery = `SELECT species, COUNT(id) as count FROM pets GROUP BY species`;

    // --- 5. APPOINTMENTS ---
    let apptBranchCond = '';
    if (branchId && branchId !== 'undefined' && branchId !== 'null') apptBranchCond = 'AND "branchId" = $3';
    const apptsQuery = `
      SELECT status, COUNT(id) as count 
      FROM appointments 
      WHERE "createdAt" >= $1 AND "createdAt" <= $2 ${apptBranchCond}
      GROUP BY status
    `;

    // --- 6. CAGES (Current Status) ---
    // Cages are physical, they usually belong to rooms which belong to branches.
    // If cage doesn't have branchId directly, we just count all cages for now or ignore branch filter for cages if complex.
    const cagesQuery = `SELECT status, COUNT(id) as count FROM cages GROUP BY status`;

    // --- 7. TOP PRODUCTS ---
    const topProductsQuery = `
      SELECT 
        p.name,
        SUM(oi.quantity) as sold_quantity,
        SUM(oi."totalPrice") as revenue
      FROM order_items oi
      INNER JOIN orders o ON oi."orderId" = o.id
      INNER JOIN products p ON oi."productId" = p.id
      WHERE o.status = 'COMPLETED' AND o."createdAt" >= $1 AND o."createdAt" <= $2 ${branchCondition}
      GROUP BY p.id, p.name
      ORDER BY sold_quantity DESC
      LIMIT 5
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
      petsResult, apptsResult, cagesResult, topProductsResult, lowStockResult
    ] = await Promise.all([
      this.ordersRepo.query(totalsQuery, params),
      this.ordersRepo.query(cogsQuery, params),
      this.ordersRepo.query(chartQuery, params),
      this.ordersRepo.query(costChartQuery, params),
      this.petsRepo.query(petsQuery),
      this.appointmentsRepo.query(apptsQuery, params),
      this.cagesRepo.query(cagesQuery),
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

    // Pets
    const petsData = petsResult.map((p: any) => ({ name: p.species || 'Unknown', value: Number(p.count) }));
    const totalPets = petsData.reduce((sum: number, p: any) => sum + p.value, 0);

    // Appointments
    const apptsData = apptsResult.map((a: any) => ({ name: a.status, value: Number(a.count) }));
    const totalAppts = apptsData.reduce((sum: number, a: any) => sum + a.value, 0);

    // Cages
    const cagesData = cagesResult.map((c: any) => ({ name: c.status, value: Number(c.count) }));
    const totalCages = cagesData.reduce((sum: number, c: any) => sum + c.value, 0);

    // Top Products
    const topProducts = topProductsResult.map((p: any) => ({ name: p.name, sold: Number(p.sold_quantity), revenue: Number(p.revenue) }));

    // Low Stock
    const lowStock = lowStockResult.map((l: any) => ({ name: l.name, remaining: Number(l.remaining_quantity) }));

    return {
      totals: { revenue: totalRevenue, cost: totalCost, profit: totalProfit, orders: totalOrders, customers: allCustomers },
      chartData,
      pets: { total: totalPets, data: petsData },
      appointments: { total: totalAppts, data: apptsData },
      cages: { total: totalCages, data: cagesData },
      topProducts,
      lowStock
    };
  }
}


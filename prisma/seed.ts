// doc/test_specification.md 3章「テスト前提データ」をローカル開発用DBに投入するシードスクリプト。
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 既存データを子テーブルから順に全削除してから再投入する（再実行可能にするため）
  await prisma.comment.deleteMany();
  await prisma.visitRecord.deleteMany();
  await prisma.dailyReport.deleteMany();
  await prisma.customerMaster.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();

  // 部署: D1 営業本部（上位なし） / D2 第一営業部（親: D1）
  const d1 = await prisma.department.create({
    data: { name: "営業本部" },
  });
  const d2 = await prisma.department.create({
    data: { name: "第一営業部", parentDepartmentId: d1.id },
  });

  // 社員: E1 鈴木部長（MANAGER, D1所属, 上長なし）
  const e1 = await prisma.employee.create({
    data: {
      name: "鈴木部長",
      email: "manager01@example.com",
      departmentId: d1.id,
      managerId: null,
      role: ["MANAGER"],
    },
  });

  // E2 山田太郎（SALES, D2所属, 上長はE1）
  const e2 = await prisma.employee.create({
    data: {
      name: "山田太郎",
      email: "sales01@example.com",
      departmentId: d2.id,
      managerId: e1.id,
      role: ["SALES"],
    },
  });

  // E3 佐藤花子（SALES, D2所属, 上長はE1）
  const e3 = await prisma.employee.create({
    data: {
      name: "佐藤花子",
      email: "sales02@example.com",
      departmentId: d2.id,
      managerId: e1.id,
      role: ["SALES"],
    },
  });

  // E9 他部署社員（MANAGER, D1所属だがE2/E3の上長ではない）
  const e9 = await prisma.employee.create({
    data: {
      name: "他部署社員",
      email: "manager02@example.com",
      departmentId: d1.id,
      managerId: null,
      role: ["MANAGER"],
    },
  });

  // 顧客: C1 株式会社A社（担当: E2） / C2 株式会社B社（担当: E2）
  const c1 = await prisma.customerMaster.create({
    data: {
      name: "株式会社A社",
      address: "東京都千代田区...",
      phone: "03-1234-5678",
      ownerEmployeeId: e2.id,
    },
  });
  const c2 = await prisma.customerMaster.create({
    data: {
      name: "株式会社B社",
      address: "東京都港区...",
      phone: "03-2345-6789",
      ownerEmployeeId: e2.id,
    },
  });

  console.log("Seed completed:", {
    departments: [d1.id, d2.id],
    employees: [e1.id, e2.id, e3.id, e9.id],
    customers: [c1.id, c2.id],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Role, EmploymentStatus, Gender, AttendanceStatus, EmploymentType } from "@prisma/client";
import prisma from "../lib/prisma";

const DEMO_PASSWORD = "ChangeMe123!";

async function createDemoUser(name: string, email: string, role: Role, usernameStr: string) {
  const { auth } = await import("../lib/auth");

  const { user } = await auth.api.createUser({
    body: { name, email, password: DEMO_PASSWORD },
  });
  return prisma.user.update({
    where: { id: user.id },
    data: { role, emailVerified: true, username: usernameStr, displayUsername: usernameStr },
  });
}

async function main() {
  console.log("🌱 Starting database seeding...");

  console.log("🧹 Cleaning existing data...");
  await prisma.auditLog.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.leaveEntitlement.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.contract.deleteMany({});
  await prisma.employmentHistory.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.position.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.cooperative.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.verification.deleteMany({});
  await prisma.user.deleteMany({});

  // 0. Departments & Positions — the Union's fixed organizational structure.
  // Departments are never created through the app; this seed is their only source.
  console.log("🏢 Seeding departments and positions...");

  const financeDept = await prisma.department.create({
    data: { name: "Finance Department", description: "Union-wide financial management and accounting." },
  });
  const hrDept = await prisma.department.create({
    data: { name: "Human Resource Department", description: "Employee records, recruitment, and HR policy." },
  });
  const marketingDept = await prisma.department.create({
    data: { name: "Marketing Department", description: "Product marketing and member outreach." },
  });
  await prisma.department.create({
    data: { name: "Input Supply Department", description: "Agricultural input procurement and distribution." },
  });
  await prisma.department.create({
    data: { name: "Legal Affairs Department", description: "Legal compliance and contract review." },
  });
  await prisma.department.create({
    data: { name: "Mechanization Department", description: "Farm machinery services and maintenance." },
  });

  await prisma.position.create({ data: { name: "Finance Manager", departmentId: financeDept.id } });
  await prisma.position.create({ data: { name: "Senior Accountant", departmentId: financeDept.id } });
  const accountantPos = await prisma.position.create({ data: { name: "Accountant", departmentId: financeDept.id } });
  const cashierPos = await prisma.position.create({ data: { name: "Cashier", departmentId: financeDept.id } });
  await prisma.position.create({ data: { name: "Finance Officer", departmentId: financeDept.id } });
  await prisma.position.create({ data: { name: "Internal Auditor", departmentId: financeDept.id } });

  const hrManagerPos = await prisma.position.create({ data: { name: "HR Manager", departmentId: hrDept.id } });
  const hrOfficerPos = await prisma.position.create({ data: { name: "HR Officer", departmentId: hrDept.id } });
  await prisma.position.create({ data: { name: "Recruitment Officer", departmentId: hrDept.id } });
  await prisma.position.create({ data: { name: "Training and Development Officer", departmentId: hrDept.id } });
  await prisma.position.create({ data: { name: "HR Assistant", departmentId: hrDept.id } });

  const marketingManagerPos = await prisma.position.create({ data: { name: "Marketing Manager", departmentId: marketingDept.id } });
  const marketingOfficerPos = await prisma.position.create({ data: { name: "Marketing Officer", departmentId: marketingDept.id } });
  await prisma.position.create({ data: { name: "Business Development Officer", departmentId: marketingDept.id } });
  await prisma.position.create({ data: { name: "Customer Relations Officer", departmentId: marketingDept.id } });
  await prisma.position.create({ data: { name: "Market Research Officer", departmentId: marketingDept.id } });

  const inputDept = await prisma.department.findFirst({ where: { name: "Input Supply Department" } });
  if (inputDept) {
    await prisma.position.create({ data: { name: "Input Supply Manager", departmentId: inputDept.id } });
    await prisma.position.create({ data: { name: "Procurement Officer", departmentId: inputDept.id } });
    await prisma.position.create({ data: { name: "Store Keeper", departmentId: inputDept.id } });
    await prisma.position.create({ data: { name: "Inventory Officer", departmentId: inputDept.id } });
    await prisma.position.create({ data: { name: "Logistics Officer", departmentId: inputDept.id } });
    await prisma.position.create({ data: { name: "Distribution Officer", departmentId: inputDept.id } });
  }

  const legalDept = await prisma.department.findFirst({ where: { name: "Legal Affairs Department" } });
  if (legalDept) {
    await prisma.position.create({ data: { name: "Legal Affairs Manager", departmentId: legalDept.id } });
    await prisma.position.create({ data: { name: "Legal Officer", departmentId: legalDept.id } });
    await prisma.position.create({ data: { name: "Compliance Officer", departmentId: legalDept.id } });
    await prisma.position.create({ data: { name: "Contract Administration Officer", departmentId: legalDept.id } });
  }

  const mechDept = await prisma.department.findFirst({ where: { name: "Mechanization Department" } });
  if (mechDept) {
    await prisma.position.create({ data: { name: "Mechanization Manager", departmentId: mechDept.id } });
    await prisma.position.create({ data: { name: "Agricultural Machinery Officer", departmentId: mechDept.id } });
    await prisma.position.create({ data: { name: "Maintenance Technician", departmentId: mechDept.id } });
    await prisma.position.create({ data: { name: "Workshop Supervisor", departmentId: mechDept.id } });
    await prisma.position.create({ data: { name: "Field Mechanization Officer", departmentId: mechDept.id } });
  }

  // 1. Cooperatives under Siko Mendo Union — Bale Robe, Oromia, Ethiopia
  console.log("📦 Seeding cooperatives...");
  const coop1 = await prisma.cooperative.create({
    data: {
      cooperativeId: "COOP-001",
      name: "Siko Mendo Primary Cooperative – Robe Branch",
      description: "Main union office and primary cooperative branch serving Robe town and surrounding kebeles.",
      location: "Robe, Bale Zone, Oromia, Ethiopia",
      contactPerson: "Tofik Mohammed",
      contactEmail: "robe.branch@sikomendounion.org.et",
      contactPhone: "+251911000111",
      isActive: true,
    },
  });

  const coop2 = await prisma.cooperative.create({
    data: {
      cooperativeId: "COOP-002",
      name: "Siko Mendo Grain Marketing Cooperative – Goba Branch",
      description: "Grain collection and marketing cooperative serving member farmers around Goba.",
      location: "Goba, Bale Zone, Oromia, Ethiopia",
      contactPerson: "Caltu Bekele",
      contactEmail: "goba.branch@sikomendounion.org.et",
      contactPhone: "+251911000222",
      isActive: true,
    },
  });

  // 2. Users — one per role, created through Better Auth so passwords are
  // hashed the way the real sign-in flow expects.
  console.log("👥 Seeding user accounts...");
  const adminUser = await createDemoUser("Tofik Mohammed", "admin@sikomendounion.org.et", Role.ADMIN, "admin");
  const hrUser = await createDemoUser("Caltu Bekele", "hr@sikomendounion.org.et", Role.HR_OFFICER, "hr.officer");
  const managerUser = await createDemoUser("Mohammed Sultan", "manager@sikomendounion.org.et", Role.MANAGER, "manager");
  const employeeUser = await createDemoUser("Amina Hussein", "employee@sikomendounion.org.et", Role.EMPLOYEE, "amina.hussein");

  // 3. Employee records (linked to the accounts above, plus a couple of
  // staff with no system login yet).
  console.log("👔 Seeding employee records...");

  const adminEmp = await prisma.employee.create({
    data: {
      employeeId: "EMP-0001",
      firstName: "Tofik",
      lastName: "Mohammed",
      email: "admin@sikomendounion.org.et",
      phone: "+251911000111",
      gender: Gender.MALE,
      dateOfBirth: new Date("1985-05-15"),
      address: "Kebele 01, Robe, Bale Zone",
      departmentId: hrDept.id,
      positionId: hrManagerPos.id,
      hireDate: new Date("2020-01-06"),
      employmentStatus: EmploymentStatus.ACTIVE,
      userId: adminUser.id,
      cooperativeId: coop1.id,
    },
  });

  const hrEmp = await prisma.employee.create({
    data: {
      employeeId: "EMP-0002",
      firstName: "Caltu",
      lastName: "Bekele",
      email: "hr@sikomendounion.org.et",
      phone: "+251911000222",
      gender: Gender.FEMALE,
      dateOfBirth: new Date("1990-08-22"),
      address: "Kebele 02, Robe, Bale Zone",
      departmentId: hrDept.id,
      positionId: hrOfficerPos.id,
      hireDate: new Date("2021-03-15"),
      employmentStatus: EmploymentStatus.ACTIVE,
      userId: hrUser.id,
      cooperativeId: coop1.id,
    },
  });

  const managerEmp = await prisma.employee.create({
    data: {
      employeeId: "EMP-0003",
      firstName: "Mohammed",
      lastName: "Sultan",
      email: "manager@sikomendounion.org.et",
      phone: "+251911000333",
      gender: Gender.MALE,
      dateOfBirth: new Date("1978-11-03"),
      address: "Goba town, Bale Zone",
      departmentId: marketingDept.id,
      positionId: marketingManagerPos.id,
      hireDate: new Date("2018-06-10"),
      employmentStatus: EmploymentStatus.ACTIVE,
      userId: managerUser.id,
      cooperativeId: coop2.id,
    },
  });

  const employeeEmp = await prisma.employee.create({
    data: {
      employeeId: "EMP-0004",
      firstName: "Amina",
      lastName: "Hussein",
      email: "employee@sikomendounion.org.et",
      phone: "+251911000444",
      gender: Gender.FEMALE,
      dateOfBirth: new Date("1995-04-12"),
      address: "Goba town, Bale Zone",
      departmentId: marketingDept.id,
      positionId: marketingOfficerPos.id,
      hireDate: new Date("2023-09-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      userId: employeeUser.id,
      cooperativeId: coop2.id,
    },
  });

  const staffEmp1 = await prisma.employee.create({
    data: {
      employeeId: "EMP-0005",
      firstName: "Geremew",
      lastName: "Tesfaye",
      email: "geremew.tesfaye@example.com",
      phone: "+251911000555",
      gender: Gender.MALE,
      dateOfBirth: new Date("1993-01-30"),
      address: "Goba town, Bale Zone",
      departmentId: financeDept.id,
      positionId: cashierPos.id,
      hireDate: new Date("2024-02-15"),
      employmentStatus: EmploymentStatus.ACTIVE,
      cooperativeId: coop2.id,
    },
  });

  const staffEmp2 = await prisma.employee.create({
    data: {
      employeeId: "EMP-0006",
      firstName: "Lelise",
      lastName: "Gemechu",
      email: "lelise.gemechu@example.com",
      phone: "+251911000666",
      gender: Gender.FEMALE,
      dateOfBirth: new Date("1989-12-05"),
      address: "Robe, Bale Zone",
      departmentId: financeDept.id,
      positionId: accountantPos.id,
      hireDate: new Date("2022-11-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      cooperativeId: coop1.id,
    },
  });

  // 3b. Initial employment history, a sample reporting hierarchy, and contracts
  console.log("📈 Seeding employment history, reporting hierarchy, and contracts...");

  const demoEmployees = [
    { emp: adminEmp, dept: hrDept, pos: hrManagerPos },
    { emp: hrEmp, dept: hrDept, pos: hrOfficerPos },
    { emp: managerEmp, dept: marketingDept, pos: marketingManagerPos },
    { emp: employeeEmp, dept: marketingDept, pos: marketingOfficerPos },
    { emp: staffEmp1, dept: financeDept, pos: cashierPos },
    { emp: staffEmp2, dept: financeDept, pos: accountantPos },
  ];

  for (const { emp, dept, pos } of demoEmployees) {
    await prisma.employmentHistory.create({
      data: {
        employeeId: emp.id,
        departmentId: dept.id,
        positionId: pos.id,
        employmentType: EmploymentType.PERMANENT,
        effectiveDate: emp.hireDate ?? new Date(),
        changeReason: "Initial hire",
      },
    });

    await prisma.contract.create({
      data: {
        employeeId: emp.id,
        contractType: EmploymentType.PERMANENT,
        startDate: emp.hireDate ?? new Date(),
        status: "ACTIVE",
      },
    });
  }

  // Sample hierarchy: Admin at the top; Manager reports to Admin; the rest report to Manager/HR.
  await prisma.employee.update({ where: { id: managerEmp.id }, data: { managerId: adminEmp.id } });
  await prisma.employee.update({ where: { id: employeeEmp.id }, data: { managerId: managerEmp.id } });
  await prisma.employee.update({ where: { id: staffEmp1.id }, data: { managerId: managerEmp.id } });
  await prisma.employee.update({ where: { id: staffEmp2.id }, data: { managerId: hrEmp.id } });

  // 4. Attendance for the last 5 working days
  console.log("⏰ Seeding attendance records...");
  const statusOptions = [
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.LATE,
    AttendanceStatus.HALF_DAY,
    AttendanceStatus.ABSENT,
  ];

  const employees = [adminEmp, hrEmp, managerEmp, employeeEmp, staffEmp1, staffEmp2];

  for (let i = 0; i < 5; i++) {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - i);

    const day = currentDate.getDay();
    if (day === 0 || day === 6) continue; // skip weekends

    for (const emp of employees) {
      if (Math.random() > 0.1) {
        const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];

        let checkIn: Date | null = null;
        let checkOut: Date | null = null;

        if (status !== AttendanceStatus.ABSENT) {
          checkIn = new Date(currentDate);
          checkIn.setHours(8, 30 + Math.floor(Math.random() * 60) - 30, 0, 0);

          checkOut = new Date(currentDate);
          checkOut.setHours(17, 30 + Math.floor(Math.random() * 60) - 30, 0, 0);

          if (status === AttendanceStatus.LATE) {
            checkIn.setHours(9, 15 + Math.floor(Math.random() * 45), 0, 0);
          } else if (status === AttendanceStatus.HALF_DAY) {
            checkOut.setHours(13, 0, 0, 0);
          }
        }

        await prisma.attendance.create({
          data: {
            date: currentDate,
            status,
            checkIn,
            checkOut,
            employeeId: emp.id,
            recordedById: adminUser.id,
            notes: status === AttendanceStatus.LATE ? "Transport delay" : null,
          },
        });
      }
    }
  }

  // 5. Audit log seed entries
  console.log("📝 Seeding audit logs...");
  await prisma.auditLog.createMany({
    data: [
      {
        action: "CREATE",
        entity: "Cooperative",
        entityId: coop1.id,
        changes: { name: coop1.name },
        userId: adminUser.id,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      },
      {
        action: "CREATE",
        entity: "Cooperative",
        entityId: coop2.id,
        changes: { name: coop2.name },
        userId: adminUser.id,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1.9),
      },
      {
        action: "CREATE",
        entity: "Employee",
        entityId: employeeEmp.id,
        changes: { name: "Amina Hussein" },
        userId: hrUser.id,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1),
      },
    ],
  });

  console.log("✅ Seeding completed successfully!");
  console.log(`   All demo accounts use the password: ${DEMO_PASSWORD}`);
  console.log("   Usernames: admin / hr.officer / manager / amina.hussein");
}

main()
  .catch((e) => {
    console.error("❌ Error while seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

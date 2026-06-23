import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Role, EmploymentStatus, Gender, AttendanceStatus } from "@prisma/client";
import prisma from "../lib/prisma";
import * as bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clean existing data in order of relations
  console.log("🧹 Cleaning existing data...");
  await prisma.auditLog.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.cooperative.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Seed Cooperatives
  console.log("📦 Seeding cooperatives...");
  const coop1 = await prisma.cooperative.create({
    data: {
      cooperativeId: "COOP-001",
      name: "Siko Mendo HQ Cooperative",
      description: "Main headquarters cooperative for Siko Mendo Union",
      location: "Jakarta, Indonesia",
      contactPerson: "John Doe",
      contactEmail: "hq@sikomendo.coop",
      contactPhone: "+62211234567",
      isActive: true,
    },
  });

  const coop2 = await prisma.cooperative.create({
    data: {
      cooperativeId: "COOP-002",
      name: "West Coast Agro-Coop",
      description: "Agricultural branch cooperative on the West Coast",
      location: "Bandung, Indonesia",
      contactPerson: "Jane Smith",
      contactEmail: "westcoast@sikomendo.coop",
      contactPhone: "+62227654321",
      isActive: true,
    },
  });

  // 2. Hash passwords for users
  console.log("🔑 Generating password hashes...");
  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash("AdminPassword123!", salt);
  const hrPasswordHash = await bcrypt.hash("HrPassword123!", salt);
  const managerPasswordHash = await bcrypt.hash("ManagerPassword123!", salt);
  const employeePasswordHash = await bcrypt.hash("EmployeePassword123!", salt);

  // 3. Seed Users
  console.log("👥 Seeding users...");
  
  // Admin User
  const adminUser = await prisma.user.create({
    data: {
      name: "System Administrator",
      email: "admin@sikomendo.org",
      emailVerified: true,
      role: Role.ADMIN,
      accounts: {
        create: {
          providerId: "email",
          accountId: "admin@sikomendo.org",
          password: adminPasswordHash,
        },
      },
    },
  });

  // HR Officer User
  const hrUser = await prisma.user.create({
    data: {
      name: "Sarah Jenkins (HR)",
      email: "hr@sikomendo.org",
      emailVerified: true,
      role: Role.HR_OFFICER,
      accounts: {
        create: {
          providerId: "email",
          accountId: "hr@sikomendo.org",
          password: hrPasswordHash,
        },
      },
    },
  });

  // Manager User
  const managerUser = await prisma.user.create({
    data: {
      name: "David Vance (Manager)",
      email: "manager@sikomendo.org",
      emailVerified: true,
      role: Role.MANAGER,
      accounts: {
        create: {
          providerId: "email",
          accountId: "manager@sikomendo.org",
          password: managerPasswordHash,
        },
      },
    },
  });

  // Employee User
  const employeeUser = await prisma.user.create({
    data: {
      name: "Alice Cooper (Employee)",
      email: "employee@sikomendo.org",
      emailVerified: true,
      role: Role.EMPLOYEE,
      accounts: {
        create: {
          providerId: "email",
          accountId: "employee@sikomendo.org",
          password: employeePasswordHash,
        },
      },
    },
  });

  // 4. Seed Employee Records (linked to users and cooperatives)
  console.log("👔 Seeding employee records...");
  
  const adminEmp = await prisma.employee.create({
    data: {
      employeeId: "EMP-0001",
      firstName: "System",
      lastName: "Administrator",
      email: "admin@sikomendo.org",
      phone: "+62811111111",
      gender: Gender.MALE,
      dateOfBirth: new Date("1985-05-15"),
      address: "123 Union Way, Jakarta",
      department: "Information Technology",
      position: "IT Architect",
      hireDate: new Date("2020-01-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      userId: adminUser.id,
      cooperativeId: coop1.id,
    },
  });

  const hrEmp = await prisma.employee.create({
    data: {
      employeeId: "EMP-0002",
      firstName: "Sarah",
      lastName: "Jenkins",
      email: "hr@sikomendo.org",
      phone: "+62822222222",
      gender: Gender.FEMALE,
      dateOfBirth: new Date("1990-08-22"),
      address: "45 HR Blvd, Jakarta",
      department: "Human Resources",
      position: "Senior HR Specialist",
      hireDate: new Date("2021-06-15"),
      employmentStatus: EmploymentStatus.ACTIVE,
      userId: hrUser.id,
      cooperativeId: coop1.id,
    },
  });

  const managerEmp = await prisma.employee.create({
    data: {
      employeeId: "EMP-0003",
      firstName: "David",
      lastName: "Vance",
      email: "manager@sikomendo.org",
      phone: "+62833333333",
      gender: Gender.MALE,
      dateOfBirth: new Date("1978-11-03"),
      address: "78 Executive Road, Bandung",
      department: "Operations",
      position: "Operations Manager",
      hireDate: new Date("2018-03-10"),
      employmentStatus: EmploymentStatus.ACTIVE,
      userId: managerUser.id,
      cooperativeId: coop2.id,
    },
  });

  const employeeEmp = await prisma.employee.create({
    data: {
      employeeId: "EMP-0004",
      firstName: "Alice",
      lastName: "Cooper",
      email: "employee@sikomendo.org",
      phone: "+62844444444",
      gender: Gender.FEMALE,
      dateOfBirth: new Date("1995-04-12"),
      address: "12 Residential St, Bandung",
      department: "Operations",
      position: "Staff Associate",
      hireDate: new Date("2023-09-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      userId: employeeUser.id,
      cooperativeId: coop2.id,
    },
  });

  // Add a few more employees that are not users (system-only profiles)
  const staffEmp1 = await prisma.employee.create({
    data: {
      employeeId: "EMP-0005",
      firstName: "Bob",
      lastName: "Miller",
      email: "bob.miller@gmail.com",
      phone: "+62855555555",
      gender: Gender.MALE,
      dateOfBirth: new Date("1993-01-30"),
      address: "56 Village Lane, Bandung",
      department: "Operations",
      position: "Field Officer",
      hireDate: new Date("2024-02-15"),
      employmentStatus: EmploymentStatus.ACTIVE,
      cooperativeId: coop2.id,
    },
  });

  const staffEmp2 = await prisma.employee.create({
    data: {
      employeeId: "EMP-0006",
      firstName: "Eva",
      lastName: "Green",
      email: "eva.green@yahoo.com",
      phone: "+62866666666",
      gender: Gender.FEMALE,
      dateOfBirth: new Date("1989-12-05"),
      address: "88 Highland Plaza, Bandung",
      department: "Finance",
      position: "Accountant",
      hireDate: new Date("2022-11-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      cooperativeId: coop2.id,
    },
  });

  // 5. Seed Attendance Records for the last 5 days
  console.log("⏰ Seeding attendance records...");
  const statusOptions = [
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT, // skew towards present
    AttendanceStatus.LATE,
    AttendanceStatus.HALF_DAY,
    AttendanceStatus.ABSENT, // include absent as a possible state
  ];

  const employees = [adminEmp, hrEmp, managerEmp, employeeEmp, staffEmp1, staffEmp2];
  
  for (let i = 0; i < 5; i++) {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - i);
    
    // Skip weekends
    const day = currentDate.getDay();
    if (day === 0 || day === 6) continue;

    for (const emp of employees) {
      // 90% chance of recording attendance for a given day
      if (Math.random() > 0.1) {
        const randStatus = statusOptions[Math.floor(Math.random() * statusOptions.length)];
        
        let checkIn: Date | null = null;
        let checkOut: Date | null = null;

        if (randStatus !== AttendanceStatus.ABSENT) {
          // Standard check-in: 08:00 AM +/- 30 mins
          checkIn = new Date(currentDate);
          const minutesOffset = Math.floor(Math.random() * 60) - 30; // -30 to +30 mins
          checkIn.setHours(8, 30 + minutesOffset, 0, 0);

          // Standard check-out: 05:00 PM +/- 30 mins
          checkOut = new Date(currentDate);
          const checkOutMinutesOffset = Math.floor(Math.random() * 60) - 30;
          checkOut.setHours(17, 30 + checkOutMinutesOffset, 0, 0);
          
          if (randStatus === AttendanceStatus.LATE) {
            // Late check-in: after 09:00 AM
            checkIn.setHours(9, 15 + Math.floor(Math.random() * 45), 0, 0);
          } else if (randStatus === AttendanceStatus.HALF_DAY) {
            // Half day checkout: 01:00 PM
            checkOut.setHours(13, 0, 0, 0);
          }
        }

        await prisma.attendance.create({
          data: {
            date: currentDate,
            status: randStatus,
            checkIn: checkIn,
            checkOut: checkOut,
            employeeId: emp.id,
            recordedById: adminUser.id,
            notes: randStatus === AttendanceStatus.LATE ? "Traffic delay" : null,
          },
        });
      }
    }
  }

  // 6. Seed Audit Logs
  console.log("📝 Seeding audit logs...");
  await prisma.auditLog.createMany({
    data: [
      {
        action: "CREATE",
        entity: "Cooperative",
        entityId: coop1.id,
        changes: { name: coop1.name },
        userId: adminUser.id,
        ipAddress: "127.0.0.1",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hrs ago
      },
      {
        action: "CREATE",
        entity: "Cooperative",
        entityId: coop2.id,
        changes: { name: coop2.name },
        userId: adminUser.id,
        ipAddress: "127.0.0.1",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1.9),
      },
      {
        action: "CREATE",
        entity: "Employee",
        entityId: employeeEmp.id,
        changes: { name: "Alice Cooper" },
        userId: hrUser.id,
        ipAddress: "127.0.0.1",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1),
      },
    ],
  });

  console.log("✅ Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error while seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

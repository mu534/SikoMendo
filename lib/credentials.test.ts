import { describe, it, expect } from "vitest";
import { generateTempPassword, strongPasswordSchema, usernameFromEmployeeId } from "./credentials";

describe("generateTempPassword", () => {
  it("always satisfies the strong password policy", () => {
    // Run many times since this is randomized \u2014 a flaky generator should
    // fail this test eventually rather than passing by luck once.
    for (let i = 0; i < 200; i++) {
      const password = generateTempPassword();
      const result = strongPasswordSchema.safeParse(password);
      expect(result.success, `Generated password "${password}" failed the policy`).toBe(true);
    }
  });

  it("never uses visually ambiguous characters (0/O, 1/l/I)", () => {
    for (let i = 0; i < 200; i++) {
      const password = generateTempPassword();
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });

  it("generates different passwords across calls", () => {
    const passwords = new Set(Array.from({ length: 50 }, () => generateTempPassword()));
    expect(passwords.size).toBe(50);
  });
});

describe("usernameFromEmployeeId", () => {
  it("lowercases the employee ID", () => {
    expect(usernameFromEmployeeId("EMP-0025")).toBe("emp-0025");
  });
});

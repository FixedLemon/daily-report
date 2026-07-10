import type { Employee } from "@/generated/prisma/client";

// api_specification.md 2.1/2.3 の employee オブジェクト形式（snake_case）。
// passwordHashは含めない。
export interface EmployeeDto {
  employee_id: number;
  name: string;
  email: string;
  department_id: number;
  manager_id: number | null;
  role: string[];
}

export function toEmployeeDto(employee: Employee): EmployeeDto {
  return {
    employee_id: employee.id,
    name: employee.name,
    email: employee.email,
    department_id: employee.departmentId,
    manager_id: employee.managerId,
    role: employee.role,
  };
}

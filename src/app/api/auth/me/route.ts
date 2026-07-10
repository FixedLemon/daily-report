import { ApiError, handleApiError, itemResponse } from "@/lib/api";
import { toEmployeeDto } from "@/lib/employee-dto";
import { getAuthenticatedEmployee } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const employee = await getAuthenticatedEmployee(request);
    if (!employee) {
      throw new ApiError("UNAUTHENTICATED", "認証が必要です");
    }
    return itemResponse(toEmployeeDto(employee));
  } catch (error) {
    return handleApiError(error);
  }
}

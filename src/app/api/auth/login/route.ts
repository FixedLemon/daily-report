import { z } from "zod";
import { ApiError, handleApiError, itemResponse, toValidationError } from "@/lib/api";
import { toEmployeeDto } from "@/lib/employee-dto";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

// メールアドレス・パスワード不一致の両方を同じメッセージ・同じUNAUTHENTICATEDに
// まとめることで、ログイン失敗時にメールアドレスの存在有無が推測できないようにする。
const INVALID_CREDENTIALS_MESSAGE = "メールアドレスまたはパスワードが正しくありません";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError("VALIDATION_ERROR", "リクエストボディがJSON形式ではありません");
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw toValidationError(parsed.error);
    }

    const employee = await prisma.employee.findUnique({
      where: { email: parsed.data.email },
    });

    if (!employee || !verifyPassword(parsed.data.password, employee.passwordHash)) {
      // タイミング攻撃でメールアドレスの存在有無が漏れないよう、
      // 該当社員がいない場合もハッシュ比較と同程度の処理時間をかける。
      if (!employee) {
        hashPassword(parsed.data.password);
      }
      throw new ApiError("UNAUTHENTICATED", INVALID_CREDENTIALS_MESSAGE);
    }

    const token = await createSession(employee.id);

    return itemResponse({ token, employee: toEmployeeDto(employee) });
  } catch (error) {
    return handleApiError(error);
  }
}

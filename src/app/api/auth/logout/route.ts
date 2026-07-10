import { handleApiError } from "@/lib/api";
import { deleteSession, extractBearerToken } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const token = extractBearerToken(request);
    if (token) {
      await deleteSession(token);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}

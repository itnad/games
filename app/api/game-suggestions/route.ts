import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { gameSuggestions } from "../../../db/schema";

const ADMIN_EMAILS = new Set(["itnadcom@gmail.com"]);
const MAX_SUGGESTION_LENGTH = 50;

function isAdmin(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  return email ? ADMIN_EMAILS.has(email.trim().toLocaleLowerCase("en")) : false;
}

function normalizeSuggestion(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "게시판을 불러오지 못했습니다.";
  if (message.includes("no such table") || message.includes("game_suggestions")) {
    return "추천 게시판을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const suggestions = await db
      .select()
      .from(gameSuggestions)
      .orderBy(asc(gameSuggestions.completed), desc(gameSuggestions.createdAt), desc(gameSuggestions.id))
      .limit(50);

    return Response.json({ suggestions, isAdmin: isAdmin(request) });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { title?: unknown };
    const title = normalizeSuggestion(payload.title);
    const length = Array.from(title).length;

    if (!title) {
      return Response.json({ error: "추천할 게임 이름을 입력해 주세요." }, { status: 400 });
    }
    if (length > MAX_SUGGESTION_LENGTH) {
      return Response.json({ error: "추천 내용은 50자까지 입력할 수 있습니다." }, { status: 400 });
    }

    const db = getDb();
    const [suggestion] = await db.insert(gameSuggestions).values({ title }).returning();
    return Response.json({ suggestion }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isAdmin(request)) {
      return Response.json({ error: "관리자만 완료 상태를 변경할 수 있습니다." }, { status: 403 });
    }

    const payload = (await request.json()) as { id?: unknown; completed?: unknown };
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1 || typeof payload.completed !== "boolean") {
      return Response.json({ error: "올바르지 않은 요청입니다." }, { status: 400 });
    }

    const db = getDb();
    const [suggestion] = await db
      .update(gameSuggestions)
      .set({
        completed: payload.completed,
        completedAt: payload.completed ? new Date().toISOString() : null,
      })
      .where(eq(gameSuggestions.id, id))
      .returning();

    if (!suggestion) {
      return Response.json({ error: "추천 항목을 찾을 수 없습니다." }, { status: 404 });
    }
    return Response.json({ suggestion });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

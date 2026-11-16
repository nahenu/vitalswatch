import { toNextJsHandler } from "better-auth/next-js";
import { dbReady } from "@/db";
import { auth } from "@/lib/auth";

const handler = toNextJsHandler(auth);

export async function GET(request: Request) {
  await dbReady();
  return handler.GET(request);
}

export async function POST(request: Request) {
  await dbReady();
  return handler.POST(request);
}

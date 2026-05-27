import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const SECRET = process.env.JWT_SECRET || "secret";

export function signToken(username: string) {
  return jwt.sign({ username }, SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { username: string } {
  return jwt.verify(token, SECRET) as { username: string };
}

export async function getUser(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    return verifyToken(token).username;
  } catch {
    return null;
  }
}

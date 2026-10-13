import "server-only";
// Checks for the public API routes' JSON bodies. Anyone can call these routes, so every
// field is checked and sizes are capped before anything reaches Claude or the database.
import { MAX_NOTES_LENGTH, MAX_QUANTITY, type Cart } from "./cart";
import type { Mode } from "./menu";

const MAX_CART_LINES = 50;
const MAX_TABLE_LENGTH = 20;

export class BadRequest extends Error {}

export function readMode(value: unknown): Mode {
  if (value === "table" || value === "pickup" || value === "delivery") return value;
  throw new BadRequest("Unknown mode.");
}

export function readTable(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > MAX_TABLE_LENGTH) throw new BadRequest("Invalid table number.");
  return value;
}

export function readString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || value.length > max) throw new BadRequest(`Invalid ${field}.`);
  return value;
}

export function readNotes(value: unknown): string | null {
  if (value == null) return null;
  return readString(value, "notes", MAX_NOTES_LENGTH);
}

export function readCart(value: unknown): Cart {
  if (!Array.isArray(value) || value.length > MAX_CART_LINES) throw new BadRequest("Invalid cart.");
  return value.map((line) => {
    const quantity = Number(line?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw new BadRequest("Invalid quantity.");
    return { item_id: readString(line?.item_id, "item id", 100), quantity, notes: readNotes(line?.notes) };
  });
}

/** Parses the request body as a JSON object of at most `maxBytes`. */
export async function readBody(request: Request, maxBytes = 20_000): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > maxBytes) throw new BadRequest("The request is too large.");
  try {
    const body = JSON.parse(text);
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {}
  throw new BadRequest("The request body must be a JSON object.");
}

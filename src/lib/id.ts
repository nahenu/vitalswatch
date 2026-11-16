import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Short URL-safe id for things that appear in public links, e.g. /f/k3Jd9xQm2A. */
export function newPublicId(length = 10): string {
  let id = "";
  for (const byte of randomBytes(length)) id += ALPHABET[byte % ALPHABET.length];
  return id;
}

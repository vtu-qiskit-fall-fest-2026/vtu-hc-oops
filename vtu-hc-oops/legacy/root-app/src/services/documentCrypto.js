import crypto from "node:crypto";
function key() {
  const secret = process.env.DOCUMENT_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error("DOCUMENT_ENCRYPTION_KEY or JWT_SECRET must be configured to protect identity documents.");
  return crypto.createHash("sha256").update(secret).digest();
}
export function encryptDocument(value) {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `enc:v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}
export function decryptDocument(value) {
  if (!value) return "";
  if (!value.startsWith("enc:v1:")) return value; // Allows broker access to any documents saved before encryption was enabled.
  const [, , ivText, tagText, encryptedText] = value.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64"));
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64")), decipher.final()]).toString("utf8");
}

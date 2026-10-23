import nodemailer from "nodemailer";

export async function sendVerificationEmail(user) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn("Verification email not sent: SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS must be configured.");
    return { sent: false, reason: "SMTP_NOT_CONFIGURED" };
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  const isTransporter = user.role === "transporter";
  const subject = isTransporter ? "LoadSetu – Your Documents Have Been Verified" : "LoadSetu – Your Business Verification Is Complete";
  const body = isTransporter
    ? `Dear ${user.name},\n\nCongratulations!\n\nYour identity documents have been successfully verified by LoadSetu. Your Transporter account is now verified and you can continue using the LoadSetu platform.\n\nYou can now log in using your registered email address.\n\nThank you for choosing LoadSetu.\n\nEvery Load Finds Its Match.`
    : `Dear ${user.name},\n\nCongratulations!\n\nYour business verification has been successfully completed by LoadSetu. Your Factory Owner account is now verified and you can continue using the LoadSetu platform.\n\nYou can now log in using your registered email address.\n\nThank you for choosing LoadSetu.\n\nEvery Load Finds Its Match.`;
  await transporter.sendMail({ from: SMTP_FROM || SMTP_USER, to: user.email, subject, text: body });
  return { sent: true };
}

export async function sendShipmentEmail(user, subject, body) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!user?.email) return { sent: false, reason: "NO_RECIPIENT" };
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn("Shipment email not sent: SMTP is not configured.");
    return { sent: false, reason: "SMTP_NOT_CONFIGURED" };
  }
  const transporter = nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT), secure: Number(SMTP_PORT) === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  await transporter.sendMail({ from: SMTP_FROM || SMTP_USER, to: user.email, subject, text: `Dear ${user.name || "LoadSetu user"},\n\n${body}\n\nRegards,\nLOADSETU` });
  return { sent: true };
}

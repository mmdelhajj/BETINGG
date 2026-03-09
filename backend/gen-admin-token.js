const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { id: "cmlwegzi300im9ubxj3v7yczi" } });
  if (user === null) { console.log("No user"); return; }

  const wallet = await prisma.wallet.findFirst({ where: { userId: user.id, currency: { symbol: "BTC" } } });
  console.error("Admin BTC balance:", wallet.balance.toString());

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role || "USER",
    vipTier: "Bronze",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString("base64url");
  const secret = "cryptobet-secret-key-2024-production";
  const sig = crypto.createHmac("sha256", secret).update(header + "." + payload).digest("base64url");
  console.log(header + "." + payload + "." + sig);
  await prisma.$disconnect();
}
main();

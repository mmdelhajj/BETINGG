const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { isActive: true } });
  if (!user) { console.log("No user"); return; }

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role || "USER",
    vipTier: "Bronze",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString("base64url");
  const secret = process.env.JWT_SECRET || "dev-jwt-secret-change-in-production";
  const sig = crypto.createHmac("sha256", secret).update(header + "." + payload).digest("base64url");
  console.log(header + "." + payload + "." + sig);
  await prisma.$disconnect();
}
main();

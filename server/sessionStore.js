const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("./db");

const storageDir = path.join(__dirname, "storage");
const sessionsPath = path.join(storageDir, "sessions.json");
const cookieName = "fcm_session";
const maxAgeMs = 1000 * 60 * 60 * 24 * 7;

function ensureStorage() {
  fs.mkdirSync(storageDir, { recursive: true });
  if (!fs.existsSync(sessionsPath)) {
    fs.writeFileSync(sessionsPath, JSON.stringify({ sessions: [] }, null, 2));
  }
}

function readSessions() {
  ensureStorage();
  return JSON.parse(fs.readFileSync(sessionsPath, "utf8")).sessions || [];
}

function writeSessions(sessions) {
  ensureStorage();
  fs.writeFileSync(sessionsPath, JSON.stringify({ sessions }, null, 2));
}

function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const separator = item.indexOf("=");
      if (separator === -1) return cookies;
      cookies[item.slice(0, separator)] = decodeURIComponent(item.slice(separator + 1));
      return cookies;
    }, {});
}

function sessionCookie(token, req) {
  const isSecure = process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https";
  const parts = [
    `${cookieName}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`
  ];
  if (isSecure) parts.push("Secure");
  return parts.join("; ");
}

function clearCookie() {
  return `${cookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

async function createSession({ userId = null, role = "manager" } = {}) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + maxAgeMs).toISOString();

  if (db.isEnabled()) {
    await db.query(
      "insert into sessions (token, user_id, role, expires_at) values ($1, $2, $3, $4)",
      [token, userId, role, expiresAt]
    );
  } else {
    const sessions = readSessions().filter((session) => new Date(session.expiresAt).getTime() > Date.now());
    sessions.push({ token, userId, role, expiresAt, createdAt: new Date().toISOString() });
    writeSessions(sessions);
  }

  return { token, expiresAt, role, userId };
}

async function getSession(req) {
  const token = parseCookies(req)[cookieName];
  if (!token) return null;

  if (db.isEnabled()) {
    const result = await db.query(
      "select token, user_id, role, expires_at from sessions where token = $1 and expires_at > now()",
      [token]
    );
    const row = result.rows[0];
    return row ? { token: row.token, userId: row.user_id, role: row.role, expiresAt: row.expires_at } : null;
  }

  const session = readSessions().find((item) => item.token === token && new Date(item.expiresAt).getTime() > Date.now());
  return session || null;
}

async function destroySession(req) {
  const token = parseCookies(req)[cookieName];
  if (!token) return;

  if (db.isEnabled()) {
    await db.query("delete from sessions where token = $1", [token]);
    return;
  }

  writeSessions(readSessions().filter((item) => item.token !== token));
}

async function requireRole(req, role) {
  const session = await getSession(req);
  if (!session || session.role !== role) return null;
  return session;
}

module.exports = {
  clearCookie,
  createSession,
  destroySession,
  getSession,
  requireRole,
  sessionCookie
};

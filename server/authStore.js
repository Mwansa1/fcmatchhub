const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("./db");

const storageDir = path.join(__dirname, "storage");
const usersPath = path.join(storageDir, "users.json");

function ensureStorage() {
  fs.mkdirSync(storageDir, { recursive: true });
  if (!fs.existsSync(usersPath)) {
    fs.writeFileSync(usersPath, JSON.stringify({ users: [] }, null, 2));
  }
}

function readUsers() {
  ensureStorage();
  return JSON.parse(fs.readFileSync(usersPath, "utf8")).users || [];
}

function writeUsers(users) {
  ensureStorage();
  fs.writeFileSync(usersPath, JSON.stringify({ users }, null, 2));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function dbUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    clubName: row.club_name,
    clubId: row.club_id || "",
    platform: row.platform,
    verifiedClub: row.verified_club,
    logoUrl: row.logo_url || "",
    role: row.role || "manager",
    emailVerified: row.email_verified,
    verificationToken: row.verification_token || "",
    verificationExpiresAt: row.verification_expires_at ? new Date(row.verification_expires_at).toISOString() : "",
    passwordResetToken: row.password_reset_token || "",
    passwordResetExpiresAt: row.password_reset_expires_at ? new Date(row.password_reset_expires_at).toISOString() : "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : ""
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.passwordHash, "hex"));
}

async function findUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (db.isEnabled()) {
    const result = await db.query("select * from users where email = $1", [normalized]);
    return dbUser(result.rows[0]);
  }
  return readUsers().find((user) => user.email === normalized) || null;
}

async function findUserByVerificationToken(token) {
  if (!token) return null;
  if (db.isEnabled()) {
    const result = await db.query("select * from users where verification_token = $1", [token]);
    return dbUser(result.rows[0]);
  }
  return readUsers().find((user) => user.verificationToken === token) || null;
}

async function createUser({ email, password, clubName, clubId, platform, verifiedClub, logoUrl, role = "manager" }) {
  const normalized = normalizeEmail(email);
  const passwordData = hashPassword(password);
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    email: normalized,
    passwordHash: passwordData.hash,
    passwordSalt: passwordData.salt,
    clubName,
    clubId: clubId || "",
    platform,
    verifiedClub,
    logoUrl: logoUrl || "",
    role,
    emailVerified: false,
    verificationToken: crypto.randomBytes(32).toString("hex"),
    verificationExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    createdAt: now,
    updatedAt: now
  };

  if (db.isEnabled()) {
    try {
      const result = await db.query(
        `insert into users (
          id, email, password_hash, password_salt, club_name, club_id, platform,
          verified_club, logo_url, role, email_verified, verification_token,
          verification_expires_at, created_at, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        returning *`,
        [
          user.id,
          user.email,
          user.passwordHash,
          user.passwordSalt,
          user.clubName,
          user.clubId,
          user.platform,
          user.verifiedClub,
          user.logoUrl,
          user.role,
          user.emailVerified,
          user.verificationToken,
          user.verificationExpiresAt,
          user.createdAt,
          user.updatedAt
        ]
      );
      return dbUser(result.rows[0]);
    } catch (error) {
      if (error.code === "23505") return null;
      throw error;
    }
  }

  const users = readUsers();
  if (users.some((item) => item.email === normalized)) return null;
  users.push(user);
  writeUsers(users);
  return user;
}

async function markEmailVerified(token) {
  if (db.isEnabled()) {
    const user = await findUserByVerificationToken(token);
    if (!user) return { ok: false, reason: "not_found" };
    if (new Date(user.verificationExpiresAt).getTime() < Date.now()) return { ok: false, reason: "expired" };
    const result = await db.query(
      `update users set email_verified = true, verification_token = null, verification_expires_at = null, updated_at = now()
       where verification_token = $1 returning *`,
      [token]
    );
    return { ok: true, user: dbUser(result.rows[0]) };
  }

  const users = readUsers();
  const index = users.findIndex((user) => user.verificationToken === token);
  if (index === -1) return { ok: false, reason: "not_found" };

  const user = users[index];
  if (new Date(user.verificationExpiresAt).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  users[index] = {
    ...user,
    emailVerified: true,
    verificationToken: "",
    verificationExpiresAt: "",
    updatedAt: new Date().toISOString()
  };
  writeUsers(users);
  return { ok: true, user: users[index] };
}

async function createPasswordResetToken(email) {
  if (db.isEnabled()) {
    const user = await findUserByEmail(email);
    if (!user) return null;
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();
    const result = await db.query(
      "update users set password_reset_token = $1, password_reset_expires_at = $2, updated_at = now() where email = $3 returning *",
      [token, expiresAt, normalizeEmail(email)]
    );
    return dbUser(result.rows[0]);
  }

  const users = readUsers();
  const normalized = normalizeEmail(email);
  const index = users.findIndex((user) => user.email === normalized);
  if (index === -1) return null;

  users[index] = {
    ...users[index],
    passwordResetToken: crypto.randomBytes(32).toString("hex"),
    passwordResetExpiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    updatedAt: new Date().toISOString()
  };
  writeUsers(users);
  return users[index];
}

async function findUserByPasswordResetToken(token) {
  if (!token) return null;
  if (db.isEnabled()) {
    const result = await db.query("select * from users where password_reset_token = $1", [token]);
    return dbUser(result.rows[0]);
  }
  return readUsers().find((user) => user.passwordResetToken === token) || null;
}

async function resetPassword(token, password) {
  if (db.isEnabled()) {
    const user = await findUserByPasswordResetToken(token);
    if (!user) return { ok: false, reason: "not_found" };
    if (new Date(user.passwordResetExpiresAt).getTime() < Date.now()) return { ok: false, reason: "expired" };
    const passwordData = hashPassword(password);
    const result = await db.query(
      `update users set password_hash = $1, password_salt = $2, password_reset_token = null,
       password_reset_expires_at = null, updated_at = now() where password_reset_token = $3 returning *`,
      [passwordData.hash, passwordData.salt, token]
    );
    return { ok: true, user: dbUser(result.rows[0]) };
  }

  const users = readUsers();
  const index = users.findIndex((user) => user.passwordResetToken === token);
  if (index === -1) return { ok: false, reason: "not_found" };

  const user = users[index];
  if (new Date(user.passwordResetExpiresAt).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const passwordData = hashPassword(password);
  users[index] = {
    ...user,
    passwordHash: passwordData.hash,
    passwordSalt: passwordData.salt,
    passwordResetToken: "",
    passwordResetExpiresAt: "",
    updatedAt: new Date().toISOString()
  };
  writeUsers(users);
  return { ok: true, user: users[index] };
}

async function updatePassword(email, currentPassword, newPassword) {
  if (db.isEnabled()) {
    const user = await findUserByEmail(email);
    if (!user) return { ok: false, reason: "not_found" };
    if (!verifyPassword(currentPassword, user)) return { ok: false, reason: "invalid_password" };
    const passwordData = hashPassword(newPassword);
    const result = await db.query(
      "update users set password_hash = $1, password_salt = $2, updated_at = now() where email = $3 returning *",
      [passwordData.hash, passwordData.salt, normalizeEmail(email)]
    );
    return { ok: true, user: dbUser(result.rows[0]) };
  }

  const users = readUsers();
  const normalized = normalizeEmail(email);
  const index = users.findIndex((user) => user.email === normalized);
  if (index === -1) return { ok: false, reason: "not_found" };

  if (!verifyPassword(currentPassword, users[index])) {
    return { ok: false, reason: "invalid_password" };
  }

  const passwordData = hashPassword(newPassword);
  users[index] = {
    ...users[index],
    passwordHash: passwordData.hash,
    passwordSalt: passwordData.salt,
    updatedAt: new Date().toISOString()
  };
  writeUsers(users);
  return { ok: true, user: users[index] };
}

module.exports = {
  createUser,
  createPasswordResetToken,
  findUserByEmail,
  findUserByPasswordResetToken,
  findUserByVerificationToken,
  markEmailVerified,
  resetPassword,
  updatePassword,
  verifyPassword
};

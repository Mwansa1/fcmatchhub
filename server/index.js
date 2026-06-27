const http = require("http");
const fs = require("fs");
const path = require("path");
require("./loadEnv")();
const db = require("./db");
const appStore = require("./appStore");
const eaProvider = require("./eaProvider");
const authStore = require("./authStore");
const emailService = require("./emailService");
const paymentProvider = require("./paymentProvider");
const sessionStore = require("./sessionStore");

const port = process.env.PORT || 3000;
const clientRoot = path.join(__dirname, "..", "client");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, contents) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(contents);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(email || "").trim());
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 6;
}

function validateAuth(body) {
  if (!isValidEmail(body.email)) {
    return "Enter a real email address, like manager@club.com.";
  }

  if (!isValidPassword(body.password)) {
    return "Password must be at least 6 characters.";
  }

  return null;
}

function appBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  return process.env.APP_BASE_URL || `${proto}://${req.headers.host}`;
}

function isValidStartTime(value) {
  return value && !Number.isNaN(new Date(value).getTime());
}

function publicUser(user) {
  return {
    email: user.email,
    club: {
      name: user.clubName,
      clubId: user.clubId,
      platform: user.platform,
      logoUrl: user.logoUrl || "",
      region: user.verifiedClub?.region || "Unknown",
      verifiedClub: user.verifiedClub
    }
  };
}

function htmlPage(title, message, user) {
  const serializedUser = user ? JSON.stringify(publicUser(user)).replace(/</g, "\\u003c") : "null";
  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #090d18; color: #f7f2df; font-family: Arial, sans-serif; }
          main { width: min(520px, calc(100% - 32px)); padding: 28px; border: 1px solid rgba(212,168,32,.35); border-radius: 10px; background: #111827; }
          h1 { margin: 0 0 10px; color: #d4a820; }
          a { color: #d4a820; font-weight: 700; }
        </style>
      </head>
      <body>
        <main><h1>${title}</h1><p>${message}</p><p><a href="/home">Open Dashboard</a></p></main>
        ${user ? `<script>
          localStorage.setItem('fcm-authenticated', 'true');
          localStorage.setItem('fcm-club', JSON.stringify(${serializedUser}.club));
          localStorage.setItem('fcm-manager-email', ${serializedUser}.email);
          setTimeout(() => { window.location.href = '/home'; }, 1200);
        </script>` : ""}
      </body>
    </html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/health") return sendJson(res, { ok: true, database: db.isEnabled() ? "postgres" : "json" });
  if (url.pathname === "/api/bootstrap") return sendJson(res, await appStore.readState());
  if (url.pathname === "/api/ea/clubs/search") {
    const result = await eaProvider.searchClubs({
      clubName: url.searchParams.get("clubName"),
      clubId: url.searchParams.get("clubId"),
      platform: url.searchParams.get("platform")
    });
    return sendJson(res, result);
  }
  if (url.pathname === "/api/ea/clubs/verify" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const result = await eaProvider.verifyClub(body);
      return sendJson(res, result, result.ok ? 200 : 404);
    } catch (error) {
      return sendJson(res, { ok: false, message: error.message }, 400);
    }
  }
  if (url.pathname === "/api/ea/clubs/matches") {
    const result = await eaProvider.clubMatches({
      clubId: url.searchParams.get("clubId"),
      platform: url.searchParams.get("platform")
    });
    return sendJson(res, result);
  }
  if (url.pathname === "/api/auth/register" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const authError = validateAuth(body);
      if (authError) return sendJson(res, { ok: false, message: authError }, 422);
      if (!body.clubName) return sendJson(res, { ok: false, message: "Club name is required." }, 422);
      if (!body.platform) return sendJson(res, { ok: false, message: "Platform is required." }, 422);
      if (!emailService.hasEmailProvider() && process.env.ALLOW_DEV_VERIFY_LINK !== "true") {
        return sendJson(res, {
          ok: false,
          message: "Email service is not configured. Add RESEND_API_KEY and EMAIL_FROM before accepting real signups."
        }, 503);
      }

      const verification = await eaProvider.verifyClub(body);
      if (!verification.ok) {
        return sendJson(res, {
          ok: false,
          message: "We could not verify that club name on the selected platform. Check the details or submit for manual admin review.",
          verification
        }, 422);
      }

      if (await authStore.findUserByEmail(body.email)) {
        return sendJson(res, { ok: false, message: "An account with this email already exists. Please login instead." }, 409);
      }

      const user = await authStore.createUser({
        email: body.email,
        password: body.password,
        clubName: body.clubName,
        clubId: body.clubId || "",
        platform: body.platform,
        verifiedClub: verification.club,
        logoUrl: body.logoUrl || ""
      });

      if (!user) {
        return sendJson(res, { ok: false, message: "An account with this email already exists. Please login instead." }, 409);
      }

      const verificationUrl = `${appBaseUrl(req)}/api/auth/verify?token=${user.verificationToken}`;
      const emailResult = await emailService.sendVerificationEmail({
        to: user.email,
        clubName: user.clubName,
        verificationUrl
      });

      return sendJson(res, {
        ok: true,
        message: emailResult.sent
          ? "Club verified. Check your email to finish activating manager access."
          : "Club verified. Email provider is not configured yet, so use the verification link below for local testing.",
        verification,
        email: {
          sent: emailResult.sent,
          provider: emailResult.provider
        },
        devVerificationLink: emailResult.devVerificationLink
      }, 201);
    } catch (error) {
      return sendJson(res, { ok: false, message: error.message }, 400);
    }
  }
  if (url.pathname === "/api/auth/verify") {
    const result = await authStore.markEmailVerified(url.searchParams.get("token"));
    const message = result.ok
      ? "Your email is verified. You can now login with your manager email and password."
      : result.reason === "expired"
        ? "This verification link expired. Create the account again or request a new verification email."
        : "This verification link is invalid.";
    if (result.ok) {
      const session = await sessionStore.createSession({ userId: result.user.id, role: result.user.role || "manager" });
      res.setHeader("Set-Cookie", sessionStore.sessionCookie(session.token, req));
    }
    res.writeHead(result.ok ? 200 : 400, { "Content-Type": "text/html; charset=utf-8" });
    res.end(htmlPage(result.ok ? "Email Verified" : "Verification Failed", message, result.user));
    return;
  }
  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const authError = validateAuth(body);
      if (authError) return sendJson(res, { ok: false, message: authError }, 422);

      const user = await authStore.findUserByEmail(body.email);
      if (!user || !authStore.verifyPassword(body.password, user)) {
        return sendJson(res, { ok: false, message: "Email or password is incorrect." }, 401);
      }
      if (!user.emailVerified) {
        return sendJson(res, { ok: false, message: "Please verify your email before logging in." }, 403);
      }

      const session = await sessionStore.createSession({ userId: user.id, role: user.role || "manager" });
      res.setHeader("Set-Cookie", sessionStore.sessionCookie(session.token, req));
      return sendJson(res, { ok: true, message: "Login successful.", user: publicUser(user) });
    } catch (error) {
      return sendJson(res, { ok: false, message: error.message }, 400);
    }
  }
  if (url.pathname === "/api/auth/forgot-password" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (!isValidEmail(body.email)) return sendJson(res, { ok: false, message: "Enter a real email address." }, 422);
      if (!emailService.hasEmailProvider() && process.env.ALLOW_DEV_VERIFY_LINK !== "true") {
        return sendJson(res, {
          ok: false,
          message: "Email service is not configured. Add RESEND_API_KEY and EMAIL_FROM before sending password reset emails."
        }, 503);
      }

      const user = await authStore.createPasswordResetToken(body.email);
      if (!user) {
        return sendJson(res, { ok: true, message: "If that manager email exists, a password reset link will be sent." });
      }

      const resetUrl = `${appBaseUrl(req)}/reset-password?token=${user.passwordResetToken}`;
      const emailResult = await emailService.sendPasswordResetEmail({
        to: user.email,
        clubName: user.clubName,
        resetUrl
      });

      return sendJson(res, {
        ok: true,
        message: emailResult.sent
          ? "Password reset link sent. Check your email to continue."
          : "Password reset link created for local testing.",
        email: {
          sent: emailResult.sent,
          provider: emailResult.provider
        },
        devResetLink: emailResult.devResetLink
      });
    } catch (error) {
      return sendJson(res, { ok: false, message: error.message }, 400);
    }
  }
  if (url.pathname === "/api/auth/reset-password" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (!isValidPassword(body.password)) return sendJson(res, { ok: false, message: "Password must be at least 6 characters." }, 422);
      const result = await authStore.resetPassword(body.token, body.password);
      if (!result.ok) {
        return sendJson(res, {
          ok: false,
          message: result.reason === "expired" ? "This password reset link expired. Request a new link." : "This password reset link is invalid."
        }, 400);
      }
      return sendJson(res, { ok: true, message: "Password updated. You can now login with the new password." });
    } catch (error) {
      return sendJson(res, { ok: false, message: error.message }, 400);
    }
  }
  if (url.pathname === "/api/auth/change-password" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (!isValidEmail(body.email)) return sendJson(res, { ok: false, message: "Enter the email on your manager account." }, 422);
      if (!isValidPassword(body.currentPassword) || !isValidPassword(body.newPassword)) {
        return sendJson(res, { ok: false, message: "Passwords must be at least 6 characters." }, 422);
      }
      const result = await authStore.updatePassword(body.email, body.currentPassword, body.newPassword);
      if (!result.ok) {
        return sendJson(res, {
          ok: false,
          message: result.reason === "invalid_password" ? "Current password is incorrect." : "Manager account not found."
        }, 401);
      }
      return sendJson(res, { ok: true, message: "Password changed successfully." });
    } catch (error) {
      return sendJson(res, { ok: false, message: error.message }, 400);
    }
  }
  if (url.pathname === "/api/admin/login" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (!process.env.ADMIN_ACCESS_KEY) {
        return sendJson(res, { ok: false, message: "Admin access key is not configured." }, 503);
      }
      if (body.accessKey !== process.env.ADMIN_ACCESS_KEY) {
        return sendJson(res, { ok: false, message: "Admin access key is incorrect." }, 401);
      }
      const session = await sessionStore.createSession({ role: "admin" });
      res.setHeader("Set-Cookie", sessionStore.sessionCookie(session.token, req));
      return sendJson(res, { ok: true, message: "Admin access unlocked." });
    } catch (error) {
      return sendJson(res, { ok: false, message: error.message }, 400);
    }
  }
  if (url.pathname === "/api/matches" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (!body.home || !body.away) return sendJson(res, { ok: false, message: "Home and opponent clubs are required." }, 422);
      if (!body.platform || !body.region) return sendJson(res, { ok: false, message: "Platform and region are required." }, 422);
      if (!isValidStartTime(body.startTime)) return sendJson(res, { ok: false, message: "Enter a valid match date and time." }, 422);

      const result = await appStore.addMatch({
        ...body,
        timezone: body.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      return sendJson(res, { ok: true, message: "Match request saved.", match: result.match, data: result.state }, 201);
    } catch (error) {
      return sendJson(res, { ok: false, message: error.message }, 400);
    }
  }
  if (url.pathname.startsWith("/api/matches/") && req.method === "PATCH") {
    try {
      const body = await readJsonBody(req);
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const allowed = ["Pending", "Accepted", "Rejected", "Rescheduled", "Completed", "Cancelled", "Disputed"];
      if (!allowed.includes(body.status)) return sendJson(res, { ok: false, message: "Invalid match status." }, 422);

      const result = await appStore.updateMatchStatus(id, body.status);
      if (!result) return sendJson(res, { ok: false, message: "Match not found." }, 404);
      return sendJson(res, { ok: true, message: `Match ${body.status.toLowerCase()}.`, match: result.match, data: result.state });
    } catch (error) {
      return sendJson(res, { ok: false, message: error.message }, 400);
    }
  }
  if (url.pathname === "/api/tournaments" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (!body.title) return sendJson(res, { ok: false, message: "Tournament name is required." }, 422);
      if (!body.format || !body.region || !body.platform) return sendJson(res, { ok: false, message: "Format, region, and platform are required." }, 422);
      if (!isValidStartTime(body.startTime)) return sendJson(res, { ok: false, message: "Enter a valid tournament start time." }, 422);

      const result = await appStore.addTournament(body);
      return sendJson(res, { ok: true, message: "Tournament saved.", tournament: result.tournament, data: result.state }, 201);
    } catch (error) {
      return sendJson(res, { ok: false, message: error.message }, 400);
    }
  }
  if (url.pathname.startsWith("/api/tournaments/") && url.pathname.endsWith("/join") && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const id = decodeURIComponent(url.pathname.split("/")[3]);
      const result = await appStore.joinTournament(id, body.clubName);
      if (!result) return sendJson(res, { ok: false, message: "Tournament not found." }, 404);
      if (result.full) return sendJson(res, { ok: false, message: "This tournament is already full.", data: result.state }, 409);
      return sendJson(res, { ok: true, message: result.tournament.access === "private" ? "Join request sent for creator approval." : "Tournament joined.", tournament: result.tournament, data: result.state });
    } catch (error) {
      return sendJson(res, { ok: false, message: error.message }, 400);
    }
  }
  if (url.pathname === "/api/payout-reviews" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const result = await appStore.requestPayoutReview(body);
      return sendJson(res, { ok: true, message: "Payout review request saved for admin approval.", request: result.request, data: result.state }, 201);
    } catch (error) {
      return sendJson(res, { ok: false, message: error.message }, 400);
    }
  }
  if (url.pathname.startsWith("/api/disputes/") && url.pathname.endsWith("/resolve") && req.method === "POST") {
    try {
      if (!(await sessionStore.requireRole(req, "admin"))) {
        return sendJson(res, { ok: false, message: "Admin session required to resolve disputes." }, 403);
      }
      const body = await readJsonBody(req);
      const id = decodeURIComponent(url.pathname.split("/")[3]);
      const allowed = ["approve", "reject", "review"];
      if (!allowed.includes(body.decision)) return sendJson(res, { ok: false, message: "Invalid dispute decision." }, 422);

      const result = await appStore.resolveDispute(id, body.decision, body.note || "");
      if (!result) return sendJson(res, { ok: false, message: "Dispute not found." }, 404);
      return sendJson(res, {
        ok: true,
        message: `Dispute ${result.dispute.status.toLowerCase()}.`,
        dispute: result.dispute,
        data: result.state
      });
    } catch (error) {
      return sendJson(res, { ok: false, message: error.message }, 400);
    }
  }
  if (url.pathname === "/api/payments/deposit" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (!Number(body.amount) || Number(body.amount) <= 0) {
        return sendJson(res, { ok: false, message: "Enter a deposit amount greater than zero." }, 422);
      }
      const result = await paymentProvider.createDeposit({
        amount: body.amount,
        method: body.method || "card",
        reference: body.reference,
        currency: body.currency || "usd",
        baseUrl: appBaseUrl(req)
      });
      await appStore.recordWalletTransaction(result.transaction, "deposit");
      return sendJson(res, result);
    } catch (error) {
      return sendJson(res, { ok: false, message: error.message }, 400);
    }
  }
  if (url.pathname === "/api/payments/withdraw" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (!Number(body.amount) || Number(body.amount) <= 0) {
        return sendJson(res, { ok: false, message: "Enter a withdrawal amount greater than zero." }, 422);
      }
      if (body.scope === "admin" && !(await sessionStore.requireRole(req, "admin"))) {
        return sendJson(res, { ok: false, message: "Admin session required for creator withdrawals." }, 403);
      }
      const result = await paymentProvider.createWithdrawal({
        amount: body.amount,
        method: body.method || "paypal",
        reference: body.reference
      });
      await appStore.recordWalletTransaction(result.transaction, "withdraw", body.scope === "admin" ? "admin" : "manager");
      return sendJson(res, result);
    } catch (error) {
      return sendJson(res, { ok: false, message: error.message }, 400);
    }
  }
  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    await sessionStore.destroySession(req);
    res.setHeader("Set-Cookie", sessionStore.clearCookie());
    return sendJson(res, { ok: true, message: "Logged out." });
  }
  if (url.pathname === "/api/session") {
    const session = await sessionStore.getSession(req);
    return sendJson(res, { ok: true, session: session ? { role: session.role, expiresAt: session.expiresAt } : null });
  }

  if (url.pathname.startsWith("/api/")) {
    return sendJson(res, { ok: false, message: "API route not found." }, 404);
  }

  const safePath = url.pathname === "/" ? "/index.html" : url.pathname;
  let filePath = path.normalize(path.join(clientRoot, safePath));

  if (!filePath.startsWith(clientRoot)) {
    return sendJson(res, { error: "Invalid path" }, 400);
  }

  if (!path.extname(filePath)) {
    filePath = path.join(clientRoot, "index.html");
  }

  sendFile(res, filePath);
});

db.initialize()
  .then((result) => {
    server.listen(port, () => {
      console.log(`FC MatchHub running at http://localhost:${port} using ${result.mode} storage`);
    });
  })
  .catch((error) => {
    console.error(`Failed to initialize storage: ${error.message}`);
    process.exit(1);
  });

const fs = require("fs");
const path = require("path");
const seedData = require("./data");
const db = require("./db");

const storageDir = path.join(__dirname, "storage");
const statePath = path.join(storageDir, "appState.json");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureState() {
  fs.mkdirSync(storageDir, { recursive: true });
  if (!fs.existsSync(statePath)) {
    fs.writeFileSync(statePath, JSON.stringify(clone(seedData), null, 2));
  }
}

function readJsonState() {
  ensureState();
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function writeJsonState(state) {
  ensureState();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  return state;
}

async function readState() {
  if (db.isEnabled()) {
    const existing = await db.query("select data from app_state where id = 1");
    if (existing.rows[0]) return existing.rows[0].data;
    await db.query("insert into app_state (id, data) values (1, $1)", [clone(seedData)]);
    return clone(seedData);
  }
  return readJsonState();
}

async function writeState(state) {
  if (db.isEnabled()) {
    await db.query(
      `insert into app_state (id, data, updated_at) values (1, $1, now())
       on conflict (id) do update set data = excluded.data, updated_at = now()`,
      [state]
    );
    return state;
  }
  return writeJsonState(state);
}

function nowLabel() {
  return "Now";
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

function addNotification(state, notification) {
  state.notifications = state.notifications || [];
  state.notifications.unshift({
    title: notification.title,
    note: notification.note,
    time: notification.time || nowLabel()
  });
}

function payoutPlan(amount) {
  const total = Number(amount || 0);
  const adminShare = Math.round(total * 0.15 * 100) / 100;
  return { total, adminShare };
}

async function addMatch(payload) {
  const state = await readState();
  const pool = Number(payload.pool || 0);
  const match = {
    id: createId("M"),
    home: payload.home,
    away: payload.away,
    type: "Pro Clubs Friendly",
    platform: payload.platform,
    region: payload.region,
    timezone: payload.timezone || "UTC",
    startTime: payload.startTime,
    status: "Pending",
    wager: pool > 0,
    pool
  };

  state.matches = [match, ...(state.matches || [])];
  addNotification(state, {
    title: "Match request sent",
    note: `${match.away} will see this request in their match queue.`
  });

  if (pool > 0) {
    const payout = payoutPlan(pool);
    const walletEntry = {
      title: "Match entry held",
      note: `${match.home} vs ${match.away}`,
      amount: pool,
      status: "Held",
      date: nowLabel()
    };
    const adminEntry = {
      title: "Admin share pending",
      note: `${match.home} vs ${match.away}`,
      amount: payout.adminShare,
      status: "Pending Result",
      date: nowLabel()
    };

    state.wallet.transactions = [walletEntry, ...(state.wallet.transactions || [])];
    state.wallet.heldFunds = Number(state.wallet.heldFunds || 0) + pool;
    state.admin.transactions = [adminEntry, ...(state.admin.transactions || [])];
    state.admin.revenue = Number(state.admin.revenue || 0) + payout.adminShare;
    state.admin.availableBalance = Number(state.admin.availableBalance || 0) + payout.adminShare;
  }

  return { state: await writeState(state), match };
}

async function updateMatchStatus(id, status) {
  const state = await readState();
  const match = (state.matches || []).find((item) => item.id === id);
  if (!match) return null;

  match.status = status;
  addNotification(state, {
    title: `Match ${status.toLowerCase()}`,
    note: `${match.home} vs ${match.away}`
  });

  return { state: await writeState(state), match };
}

async function addTournament(payload) {
  const state = await readState();
  const entryFee = Number(payload.entryFee || 0);
  const tournament = {
    id: createId("T"),
    title: payload.title,
    format: payload.format,
    teamsJoined: 1,
    maxTeams: Math.max(2, Number(payload.maxTeams || 2)),
    region: payload.region,
    platform: payload.platform,
    prizePool: Number(payload.prizePool || 0),
    entryFee,
    status: payload.access === "private" ? "Private" : "Open",
    access: payload.access || "public",
    startTime: payload.startTime
  };

  state.tournaments = [tournament, ...(state.tournaments || [])];
  addNotification(state, {
    title: tournament.access === "private" ? "Private tournament created" : "Public tournament published",
    note: `${tournament.title} is prioritized for ${tournament.region} clubs.`
  });

  if (entryFee > 0) {
    const payout = payoutPlan(entryFee);
    const walletEntry = {
      title: "Tournament entry held",
      note: tournament.title,
      amount: entryFee,
      status: "Held",
      date: nowLabel()
    };
    const adminEntry = {
      title: "Admin share pending",
      note: tournament.title,
      amount: payout.adminShare,
      status: "Pending Result",
      date: nowLabel()
    };

    state.wallet.transactions = [walletEntry, ...(state.wallet.transactions || [])];
    state.wallet.heldFunds = Number(state.wallet.heldFunds || 0) + entryFee;
    state.admin.transactions = [adminEntry, ...(state.admin.transactions || [])];
    state.admin.revenue = Number(state.admin.revenue || 0) + payout.adminShare;
    state.admin.availableBalance = Number(state.admin.availableBalance || 0) + payout.adminShare;
  }

  return { state: await writeState(state), tournament };
}

async function joinTournament(id, clubName) {
  const state = await readState();
  const tournament = (state.tournaments || []).find((item) => item.id === id);
  if (!tournament) return null;
  if (tournament.teamsJoined >= tournament.maxTeams) {
    return { state, tournament, full: true };
  }

  tournament.teamsJoined += 1;
  if (tournament.teamsJoined >= tournament.maxTeams) tournament.status = "Full";
  addNotification(state, {
    title: tournament.access === "private" ? "Tournament join request sent" : "Tournament joined",
    note: `${clubName || "Your club"} requested ${tournament.title}.`
  });

  return { state: await writeState(state), tournament, full: false };
}

async function recordWalletTransaction(transaction, kind, scope = "manager") {
  const state = await readState();
  const target = scope === "admin" ? state.admin : state.wallet;
  target.transactions = [transaction, ...(target.transactions || [])];
  target.pendingRequests = [transaction, ...(target.pendingRequests || [])];

  if (scope === "admin") {
    target.pendingWithdrawals = Number(target.pendingWithdrawals || 0) + Number(transaction.amount || 0);
  } else if (kind === "deposit") {
    target.pendingDeposits = Number(target.pendingDeposits || 0) + Number(transaction.amount || 0);
  } else if (kind === "withdraw") {
    target.pendingWithdrawals = Number(target.pendingWithdrawals || 0) + Number(transaction.amount || 0);
  }

  return writeState(state);
}

async function requestPayoutReview(payload) {
  const state = await readState();
  const amount = Number(payload.amount || state.wallet.heldFunds || 0);
  const request = {
    title: "Payout review requested",
    note: payload.note || "Manager requested payout approval",
    amount,
    status: "In Review",
    date: nowLabel()
  };

  state.wallet.pendingRequests = [request, ...(state.wallet.pendingRequests || [])];
  state.admin.pendingRequests = [request, ...(state.admin.pendingRequests || [])];
  addNotification(state, {
    title: "Payout review requested",
    note: "Admin review is required before payout processing."
  });

  return { state: await writeState(state), request };
}

async function resolveDispute(id, decision, note = "") {
  const state = await readState();
  const dispute = (state.disputes || []).find((item) => item.id === id);
  if (!dispute) return null;

  const decisions = {
    approve: {
      status: "Resolved",
      title: "Dispute resolved - payout approved",
      walletStatus: "Completed",
      notification: "Admin approved the payout after dispute review."
    },
    reject: {
      status: "Rejected",
      title: "Dispute resolved - claim rejected",
      walletStatus: "Rejected",
      notification: "Admin rejected the dispute claim after review."
    },
    review: {
      status: "In Review",
      title: "Dispute kept in review",
      walletStatus: "In Review",
      notification: "Admin kept the dispute under review."
    }
  };
  const resolution = decisions[decision] || decisions.review;

  dispute.status = resolution.status;
  dispute.adminDecision = resolution.title;
  dispute.adminNote = note || resolution.notification;
  dispute.resolvedAt = new Date().toISOString();

  const transaction = {
    title: resolution.title,
    note: `${dispute.match}${note ? ` - ${note}` : ""}`,
    amount: Number(dispute.funds || 0),
    status: resolution.walletStatus,
    date: nowLabel()
  };

  state.wallet.transactions = [transaction, ...(state.wallet.transactions || [])];
  state.wallet.pendingRequests = (state.wallet.pendingRequests || []).filter((item) => item.note !== dispute.match);
  state.admin.transactions = [transaction, ...(state.admin.transactions || [])];
  state.admin.pendingRequests = (state.admin.pendingRequests || []).filter((item) => item.note !== dispute.match);

  if (decision === "approve") {
    state.wallet.heldFunds = Math.max(Number(state.wallet.heldFunds || 0) - Number(dispute.funds || 0), 0);
    state.wallet.availableBalance = Number(state.wallet.availableBalance || 0) + Number(dispute.funds || 0);
  }

  addNotification(state, {
    title: resolution.title,
    note: `${dispute.match}: ${dispute.adminNote}`
  });

  return { state: await writeState(state), dispute };
}

module.exports = {
  addMatch,
  addTournament,
  joinTournament,
  readState,
  recordWalletTransaction,
  resolveDispute,
  requestPayoutReview,
  updateMatchStatus
};

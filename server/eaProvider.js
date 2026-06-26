const data = require("./data");

const DEFAULT_BASE_URL = "https://proclubs.ea.com/api/fc";
const BASE_URL = process.env.EA_PRO_CLUBS_API_URL || DEFAULT_BASE_URL;

const PLATFORM_MAP = {
  "PlayStation 5": "common-gen5",
  "Xbox Series X/S": "common-gen5",
  PC: "pc",
  PS5: "common-gen5",
  Xbox: "common-gen5",
  Crossplay: "common-gen5"
};

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function platformCode(platform) {
  return PLATFORM_MAP[platform] || platform || "common-gen5";
}

async function eaRequest(pathname, params = {}) {
  const url = new URL(`${BASE_URL}${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.EA_API_TIMEOUT_MS || 8000));

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "FC-MatchHub/0.1"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`EA provider returned ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function mockSearch(clubName, clubId, platform) {
  const queryName = normalize(clubName);
  const queryId = normalize(clubId);
  const platformValue = platform || "PS5";
  const localClubs = [
    {
      name: data.club.name,
      clubId: "PCZ-26001",
      eaClubId: "PCZ-26001",
      platform: data.club.platform,
      region: data.club.region
    },
    {
      name: "BOSTON BEASTS",
      clubId: "LOCAL-BOSTON-BEASTS",
      eaClubId: "LOCAL-BOSTON-BEASTS",
      platform: "PlayStation 5",
      region: "NA East"
    },
    {
      name: "BOSTON BEASTS B",
      clubId: "LOCAL-BOSTON-BEASTS-B",
      eaClubId: "LOCAL-BOSTON-BEASTS-B",
      platform: "PlayStation 5",
      region: "NA East"
    },
    {
      name: "PILOTTHEFLYEST",
      clubId: "LOCAL-PILOTTHEFLYEST",
      eaClubId: "LOCAL-PILOTTHEFLYEST",
      platform: "PlayStation 5",
      region: "NA East"
    },
    ...data.opponents
  ];

  return localClubs
    .filter((club) => {
      const candidateName = normalize(club.name);
      const candidateId = normalize(club.eaClubId || club.clubId);
      const nameMatches = !queryName || candidateName === queryName || candidateName.includes(queryName) || queryName.includes(candidateName);
      const idMatches = !queryId || candidateId === queryId;
      return nameMatches && idMatches;
    })
    .map((club) => ({
      clubId: club.eaClubId || club.clubId,
      name: club.name,
      platform: club.platform || platformValue,
      region: club.region || "Unknown",
      source: "verified-directory"
    }));
}

function normalizeClubResult(rawClub, platform) {
  return {
    clubId: String(rawClub.clubId || rawClub.id || rawClub.eaClubId || ""),
    name: rawClub.name || rawClub.clubName || rawClub.teamName || "Unknown Club",
    platform,
    region: rawClub.regionName || rawClub.region || rawClub.locale || "Unknown",
    source: "ea"
  };
}

async function searchClubs({ clubName, clubId, platform }) {
  if (process.env.EA_API_MODE === "mock") {
    return { source: "mock", clubs: mockSearch(clubName, clubId, platform) };
  }

  try {
    const payload = await eaRequest("/clubs/search", {
      platform: platformCode(platform),
      clubName,
      clubId
    });
    const clubs = Array.isArray(payload?.clubs)
      ? payload.clubs
      : Array.isArray(payload)
        ? payload
        : Object.values(payload || {});

    return {
      source: "ea",
      clubs: clubs.map((club) => normalizeClubResult(club, platform)).filter((club) => club.clubId || club.name)
    };
  } catch (error) {
    return {
      source: "mock",
      warning: "EA provider unavailable. Showing local demo matches until official access is configured.",
      clubs: mockSearch(clubName, clubId, platform)
    };
  }
}

async function verifyClub({ clubName, clubId, platform }) {
  const result = await searchClubs({ clubName, clubId, platform });
  const expectedName = normalize(clubName);
  const expectedId = normalize(clubId);
  const match = result.clubs.find((club) => {
    const nameMatches = !expectedName || normalize(club.name) === expectedName;
    const idMatches = !expectedId || normalize(club.clubId) === expectedId;
    return nameMatches && idMatches;
  });

  return {
    ok: Boolean(match),
    source: match?.source || result.source,
    warning: result.warning,
    club: match || null,
    candidates: result.clubs.slice(0, 5)
  };
}

async function clubMatches({ clubId, platform }) {
  if (process.env.EA_API_MODE === "mock") {
    return { source: "mock", matches: data.matches };
  }

  try {
    const payload = await eaRequest("/matches", {
      platform: platformCode(platform),
      clubIds: clubId,
      matchType: "gameType9"
    });
    const matches = Array.isArray(payload?.matches) ? payload.matches : Array.isArray(payload) ? payload : [];
    return { source: "ea", matches };
  } catch (error) {
    return {
      source: "mock",
      warning: "EA provider unavailable. Showing local demo match records.",
      matches: data.matches
    };
  }
}

module.exports = {
  searchClubs,
  verifyClub,
  clubMatches
};

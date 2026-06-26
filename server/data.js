const data = {
  club: {
    name: "ProClubz FC",
    manager: "ProManager26",
    platform: "PS5",
    region: "North America East",
    timezone: "America/Chicago",
    status: "Verified"
  },
  matches: [
    {
      id: "M-45871",
      home: "ProClubz FC",
      away: "TopTier FC",
      type: "Pro Clubs Friendly",
      platform: "PS5",
      region: "NA East",
      timezone: "America/Chicago",
      startTime: "2026-06-16T20:30:00-05:00",
      status: "Disputed",
      wager: true,
      pool: 100
    },
    {
      id: "M-45922",
      home: "ProClubz FC",
      away: "RedDevils FC",
      type: "Pro Clubs Friendly",
      platform: "PS5",
      region: "NA East",
      timezone: "America/Chicago",
      startTime: "2026-06-17T21:00:00-05:00",
      status: "Pending",
      wager: true,
      pool: 50
    },
    {
      id: "M-45951",
      home: "BlueLock FC",
      away: "ProClubz FC",
      type: "Pro Clubs Friendly",
      platform: "Xbox",
      region: "Europe",
      timezone: "Europe/London",
      startTime: "2026-06-20T19:00:00+01:00",
      status: "Accepted",
      wager: false,
      pool: 0
    },
    {
      id: "M-46008",
      home: "Ballers United",
      away: "ProClubz FC",
      type: "Pro Clubs Friendly",
      platform: "Crossplay",
      region: "NA East",
      timezone: "America/New_York",
      startTime: "2026-06-21T20:00:00-04:00",
      status: "Open Challenge",
      wager: false,
      pool: 0
    }
  ],
  tournaments: [
    {
      id: "CCE26",
      title: "Champions Cup Europe",
      format: "Knockout",
      teamsJoined: 24,
      maxTeams: 32,
      region: "Europe",
      platform: "PS5",
      prizePool: 2500,
      status: "Open",
      startTime: "2026-06-28T19:00:00+01:00"
    },
    {
      id: "PCS26",
      title: "Pro Clubs Showdown",
      format: "Group Stage",
      teamsJoined: 11,
      maxTeams: 16,
      region: "NA East",
      platform: "Crossplay",
      prizePool: 0,
      status: "Open",
      startTime: "2026-06-22T20:00:00-05:00"
    },
    {
      id: "RL26",
      title: "Rivalry League",
      format: "League Table",
      teamsJoined: 20,
      maxTeams: 20,
      region: "Europe",
      platform: "Xbox",
      prizePool: 1000,
      status: "Live",
      startTime: "2026-06-18T20:30:00+01:00"
    }
  ],
  opponents: [
    {
      name: "EliteStrikers",
      eaClubId: "ES-11092",
      platform: "PS5",
      region: "Europe",
      record: "42-11-8",
      availability: "21:00 GMT",
      bio: "Organized eleven-man side looking for structured friendlies and weekend cup prep."
    },
    {
      name: "Ballers United",
      eaClubId: "BU-77420",
      platform: "Xbox",
      region: "NA East",
      record: "31-14-5",
      availability: "8 PM CT",
      bio: "Competitive North American club with fast response times and verified manager contact."
    },
    {
      name: "Ultimate XI",
      eaClubId: "UXI-54602",
      platform: "PC",
      region: "Europe",
      record: "18-8-4",
      availability: "Pending",
      bio: "Flexible PC squad open to testing custom rules, home-away legs, and prize tournaments."
    }
  ],
  disputes: [
    {
      id: "D-45871",
      match: "ProClubz FC vs TopTier FC",
      reason: "Both managers submitted different final scores.",
      submittedScore: "ProClubz FC 1 - 1 TopTier FC",
      contestedScore: "ProClubz FC 1 - 2 TopTier FC",
      funds: 100,
      status: "Contested"
    },
    {
      id: "D-45922",
      match: "BlueLock FC vs EliteStrikers",
      reason: "Screenshot proof uploaded by both managers.",
      submittedScore: "BlueLock FC 2 - 0 EliteStrikers",
      contestedScore: "BlueLock FC 1 - 0 EliteStrikers",
      funds: 50,
      status: "In Review"
    },
    {
      id: "D-45901",
      match: "Ballers United vs ProClubz FC",
      reason: "Scores matched after review.",
      submittedScore: "Ballers United 0 - 3 ProClubz FC",
      contestedScore: "Resolved",
      funds: 25,
      status: "Resolved"
    }
  ],
  leaderboards: {
    matches: [
      { team: "ProClubz FC", region: "NA East", platform: "PS5", wins: 42, losses: 8, ties: 6, goalsScored: 132, matchesPlayed: 56 },
      { team: "EliteStrikers", region: "Europe", platform: "PS5", wins: 39, losses: 11, ties: 5, goalsScored: 121, matchesPlayed: 55 },
      { team: "Ballers United", region: "NA East", platform: "Xbox", wins: 34, losses: 12, ties: 8, goalsScored: 108, matchesPlayed: 54 },
      { team: "TopTier FC", region: "NA East", platform: "Crossplay", wins: 31, losses: 14, ties: 7, goalsScored: 96, matchesPlayed: 52 },
      { team: "BlueLock FC", region: "Europe", platform: "Xbox", wins: 29, losses: 16, ties: 6, goalsScored: 92, matchesPlayed: 51 }
    ],
    tournaments: [
      { team: "Champions XI", region: "Europe", platform: "PS5", wins: 18, losses: 3, ties: 1, goalsScored: 58, matchesPlayed: 22 },
      { team: "ProClubz FC", region: "NA East", platform: "PS5", wins: 16, losses: 4, ties: 2, goalsScored: 51, matchesPlayed: 22 },
      { team: "RedDevils FC", region: "NA East", platform: "PS5", wins: 14, losses: 5, ties: 3, goalsScored: 44, matchesPlayed: 22 },
      { team: "Ultimate XI", region: "Europe", platform: "PC", wins: 13, losses: 6, ties: 2, goalsScored: 39, matchesPlayed: 21 },
      { team: "Rivalry Kings", region: "Europe", platform: "Xbox", wins: 12, losses: 7, ties: 2, goalsScored: 37, matchesPlayed: 21 }
    ]
  },
  wallet: {
    availableBalance: 1250,
    pendingDeposits: 300,
    pendingWithdrawals: 420,
    heldFunds: 150,
    pendingRequests: [
      {
        title: "Deposit request submitted",
        note: "Card deposit - Ref DEP-1024",
        amount: 200,
        status: "Pending",
        date: "Today, 9:12 AM"
      },
      {
        title: "Withdrawal request submitted",
        note: "PayPal withdrawal - approval required before processing",
        amount: 420,
        status: "Pending",
        date: "Yesterday"
      },
      {
        title: "Match payout awaiting approval",
        note: "ProClubz FC vs TopTier FC",
        amount: 80,
        status: "In Review",
        date: "Jun 15"
      }
    ],
    transactions: [
      {
        title: "Tournament prize approved",
        note: "Champions Cup Europe - payout approved",
        amount: 640,
        status: "Completed",
        date: "Jun 14"
      },
      {
        title: "Match funds held",
        note: "ProClubz FC vs RedDevils FC",
        amount: 50,
        status: "Held",
        date: "Jun 13"
      },
      {
        title: "Match payout approved",
        note: "Approved result payout",
        amount: 80,
        status: "Completed",
        date: "Jun 12"
      }
    ]
  },
  admin: {
    availableBalance: 320,
    pendingWithdrawals: 0,
    revenue: 320,
    transactions: [
      {
        title: "Admin share recorded",
        note: "Completed paid match",
        amount: 15,
        status: "Completed",
        date: "Jun 12"
      }
    ],
    pendingRequests: []
  }
};

module.exports = data;

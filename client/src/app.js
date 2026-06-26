const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: 'bi-grid-fill' },
  { id: 'matches', label: 'Matches', icon: 'bi-lightning-charge-fill' },
  { id: 'tournaments', label: 'Tournaments', icon: 'bi-trophy-fill' },
  { id: 'opponents', label: 'Opponents', icon: 'bi-people-fill' },
  { id: 'leaderboards', label: 'Leaderboards', icon: 'bi-bar-chart-fill' },
  { id: 'disputes', label: 'Disputes', icon: 'bi-shield-fill-exclamation' },
  { id: 'wallet', label: 'Wallet', icon: 'bi-wallet2' },
  { id: 'settings', label: 'Settings', icon: 'bi-gear-fill' }
];

const CURRENCIES = {
  USD: { label: 'USD', symbol: '$', rate: 1 },
  EUR: { label: 'EUR', symbol: 'EUR', rate: 0.92 },
  GBP: { label: 'GBP', symbol: 'GBP', rate: 0.78 },
  CAD: { label: 'CAD', symbol: 'CAD', rate: 1.37 },
  AUD: { label: 'AUD', symbol: 'AUD', rate: 1.52 },
  NGN: { label: 'NGN', symbol: 'NGN', rate: 1500 }
};

const regionCurrency = {
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  NG: 'NGN',
  AU: 'AUD',
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  NL: 'EUR'
};

const LOGO_STYLES = ['icons', 'shapes', 'identicon', 'bottts', 'thumbs', 'initials'];

function defaultCurrency() {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  const region = locale.split('-')[1]?.toUpperCase();
  return regionCurrency[region] || 'USD';
}

const state = {
  view: initialView(),
  data: null,
  theme: localStorage.getItem('fcm-theme') || 'dark',
  currency: localStorage.getItem('fcm-currency') || defaultCurrency(),
  authenticated: localStorage.getItem('fcm-authenticated') === 'true',
  club: JSON.parse(localStorage.getItem('fcm-club') || 'null'),
  managerEmail: localStorage.getItem('fcm-manager-email') || '',
  adminUnlocked: localStorage.getItem('fcm-admin-unlocked') === 'true',
  opponentResults: [],
  opponentQuery: '',
  openMatchPicker: false
};

const app = document.querySelector('#app');
document.documentElement.dataset.theme = state.theme;

const money = (amount) => {
  const currency = CURRENCIES[state.currency] ? state.currency : 'USD';
  const converted = amount * CURRENCIES[currency].rate;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'NGN' ? 0 : 2
  }).format(converted);
};

const dateTime = (value) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(new Date(value));

const initials = (name) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const tone = (index) => ['gold', 'blue', 'red', 'navy'][index % 4];

function clubLogoUrl(seed, style = 'icons') {
  const safeStyle = LOGO_STYLES.includes(style) ? style : 'icons';
  return `https://api.dicebear.com/10.x/${safeStyle}/svg?seed=${encodeURIComponent(seed || 'FC MatchHub')}&backgroundColor=d4a820,101827,0f2a44&radius=12`;
}

function clubLogoMarkup(club, className = 'club-emblem') {
  if (club?.logoUrl) return `<img class="${className} club-logo-img" src="${club.logoUrl}" alt="${club.name || 'Club'} logo" />`;
  return `<div class="${className}"><i class="bi bi-star-fill"></i></div>`;
}

function initialView() {
  const path = window.location.pathname.replace(/^\/+/, '');
  if (path === 'creator-admin' || path === 'admin') return 'creator-admin';
  if (localStorage.getItem('fcm-authenticated') === 'true') return path && !['join', 'login', 'forgot-password', 'reset-password'].includes(path) ? (path === 'admin' ? 'creator-admin' : path) : 'home';
  return ['join', 'login', 'forgot-password', 'reset-password'].includes(path) ? path : 'landing';
}

function publicPath(view) {
  return ['join', 'login', 'forgot-password', 'reset-password'].includes(view) ? `/${view}${view === 'reset-password' && resetToken() ? `?token=${encodeURIComponent(resetToken())}` : ''}` : '/';
}

function appPath(view) {
  if (view === 'creator-admin') return '/creator-admin';
  return `/${view === 'home' ? 'home' : view}`;
}

function viewFromPath() {
  const path = window.location.pathname.replace(/^\/+/, '') || 'landing';
  if (path === 'creator-admin' || path === 'admin') return 'creator-admin';
  if (state.authenticated) return path === 'landing' ? 'home' : path === 'admin' ? 'creator-admin' : path;
  return ['join', 'login', 'forgot-password', 'reset-password'].includes(path) ? path : 'landing';
}

function activeClub() {
  return state.club || state.data?.club || { name: 'Your Club', platform: 'Pro Clubs' };
}

function resetToken() {
  return new URLSearchParams(window.location.search).get('token') || '';
}

function payoutPlan(amount, outcome = 'winner') {
  const total = Number(amount || 0);
  const adminShare = Math.round(total * 0.15 * 100) / 100;
  const playerShare = Math.max(total - adminShare, 0);
  return {
    total,
    adminShare,
    winnerShare: outcome === 'tie' ? playerShare / 2 : playerShare,
    tieShare: outcome === 'tie' ? playerShare / 2 : 0
  };
}

function statusPill(status) {
  const lower = status.toLowerCase();
  const cls = lower.includes('accepted') || lower.includes('resolved') || lower.includes('completed') || lower.includes('open')
    ? 'green'
    : lower.includes('disputed') || lower.includes('contested')
      ? 'red'
      : lower.includes('review')
        ? 'blue'
        : '';
  return `<span class="pill ${cls}">${status}</span>`;
}

async function load() {
  const response = await fetch('/api/bootstrap');
  state.data = await response.json();
  state.data.notifications = state.data.notifications || [
    { title: 'Welcome to MatchHub', note: 'Your club dashboard is ready.', time: 'Now' }
  ];
  state.data.admin = state.data.admin || { availableBalance: 0, pendingWithdrawals: 0, revenue: 0, transactions: [], pendingRequests: [] };
  if (state.view === 'creator-admin') {
    renderCreatorAdminShell();
    return;
  }
  if (state.authenticated) {
    if (state.view === 'creator-admin') {
      setView('creator-admin', false);
    } else {
      renderShell();
      setView(state.view);
    }
  } else {
    renderPublicShell();
    setPublicView(state.view);
  }
}

function renderPublicShell() {
  app.className = '';
  app.innerHTML = `
    <div class="public-root">
      <header class="public-topbar">
        <div class="logo" data-public-view="landing">
          <img class="logo-mark" src="/assets/fc-matchhub-logo.svg" alt="FC MatchHub logo" />
          <div class="logo-text">
            <span class="logo-name">MatchHub</span>
            <span class="logo-tag">Pro Clubs Only</span>
          </div>
        </div>
        <div class="public-actions">
          <label class="currency-select" aria-label="Display currency">
            <i class="bi bi-currency-exchange"></i>
            <select id="currencySelect">
              ${Object.keys(CURRENCIES).map((currency) => `<option value="${currency}" ${state.currency === currency ? 'selected' : ''}>${currency}</option>`).join('')}
            </select>
          </label>
          <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle light or dark mode" title="Toggle light or dark mode">
            <span class="theme-toggle-knob"><i class="bi ${state.theme === 'dark' ? 'bi-moon-fill' : 'bi-sun-fill'}"></i></span>
          </button>
          <button class="hbtn hbtn-ghost" type="button" data-public-view="login">Login</button>
          <button class="hbtn hbtn-primary" type="button" data-public-view="join">Join Now</button>
        </div>
      </header>
      <main id="publicView"></main>
    </div>
  `;
}

function setPublicView(view, updateHistory = true) {
  state.view = view;
  document.body.dataset.page = view;
  if (updateHistory && window.location.pathname !== publicPath(view)) window.history.pushState({}, '', publicPath(view));
  document.querySelector('#publicView').innerHTML = ['join', 'login', 'forgot-password', 'reset-password'].includes(view) ? publicAuthView(view) : landingView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderShell() {
  const { wallet } = state.data;
  const club = activeClub();
  app.className = '';
  app.innerHTML = `
    <div class="app-root">
      <header class="topbar">
        <div class="logo" data-view="home">
          <img class="logo-mark" src="/assets/fc-matchhub-logo.svg" alt="FC MatchHub logo" />
          <div class="logo-text">
            <span class="logo-name">MatchHub</span>
            <span class="logo-tag">Compete / Connect / Conquer</span>
          </div>
        </div>

        <div class="club-sel">
          ${clubLogoMarkup(club)}
          <div class="club-label">
            <div class="cname">${club.name}</div>
            <div class="cdiv">Elite Division</div>
          </div>
          <i class="bi bi-chevron-down"></i>
        </div>

        <div class="topbar-right">
          <label class="currency-select" aria-label="Display currency">
            <i class="bi bi-currency-exchange"></i>
            <select id="currencySelect">
              ${Object.keys(CURRENCIES).map((currency) => `<option value="${currency}" ${state.currency === currency ? 'selected' : ''}>${currency}</option>`).join('')}
            </select>
          </label>
          <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle light or dark mode" title="Toggle light or dark mode">
            <span class="theme-toggle-knob"><i class="bi ${state.theme === 'dark' ? 'bi-moon-fill' : 'bi-sun-fill'}"></i></span>
          </button>
          <button class="icon-btn" type="button" aria-label="Notifications" data-view="notifications"><i class="bi bi-bell-fill"></i><span class="notif-dot">${state.data.notifications.length}</span></button>
          <button class="wallet-chip" type="button" data-view="wallet">
            <span class="wallet-copy"><span class="wlabel">Wallet</span><span class="wamt">${money(wallet.availableBalance)}</span></span>
            <span class="wadd"><i class="bi bi-plus"></i></span>
          </button>
          <button class="profile-chip top-logout" type="button" data-logout aria-label="Logout" title="Logout">
            <span class="avatar logout-avatar"><i class="bi bi-box-arrow-left"></i></span>
          </button>
        </div>
      </header>

      <div class="page">
        <aside class="sidebar">
          <div class="nav-group-label">Menu</div>
          ${NAV_ITEMS.slice(0, 4).map(navButton).join('')}
          <div class="sidebar-divider"></div>
          <div class="nav-group-label">Account</div>
          ${NAV_ITEMS.slice(4).map(navButton).join('')}
          <button class="nav-link logout-link" type="button" data-logout><i class="bi bi-box-arrow-left"></i>Logout</button>
          <div class="sidebar-divider"></div>
          <div class="sidebar-fc">
            <div class="fclabel">Pro Clubs</div>
            <div class="fc26tag"><i class="bi bi-shield-shaded"></i><span class="ftxt">FC26</span></div>
          </div>
          <div class="sidebar-promo">
            <div class="pt">Pro Clubs Season</div>
            <h4>PLAY. WIN. EARN.</h4>
            <p>Compete in elite tournaments and approved prize events.</p>
            <button class="promo-btn" type="button" data-view="tournaments"><i class="bi bi-lightning-charge-fill"></i> Browse Tournaments</button>
          </div>
        </aside>
        <main class="main" id="view"></main>
      </div>

      <nav class="bottom-nav">
        <div class="bottom-nav-inner">
          ${NAV_ITEMS.filter((item) => ['home', 'matches', 'tournaments', 'opponents', 'wallet'].includes(item.id)).map((item) => `<button class="bnav-item" type="button" data-view="${item.id}"><i class="bi ${item.icon}"></i>${item.label}</button>`).join('')}
        </div>
      </nav>
    </div>
  `;
}

function renderCreatorAdminShell() {
  app.className = '';
  app.innerHTML = `
    <div class="creator-root">
      <header class="public-topbar creator-topbar">
        <div class="logo">
          <img class="logo-mark" src="/assets/fc-matchhub-logo.svg" alt="FC MatchHub logo" />
          <div class="logo-text">
            <span class="logo-name">Creator Admin</span>
            <span class="logo-tag">FC MatchHub Operations</span>
          </div>
        </div>
        <div class="public-actions">
          <button class="hbtn hbtn-ghost" type="button" data-view="home"><i class="bi bi-arrow-left"></i> Manager App</button>
        </div>
      </header>
      <main class="creator-main">${state.adminUnlocked ? adminView() : adminLockView()}</main>
    </div>
  `;
}

function adminLockView() {
  return `
    <section class="app-page">
      <div class="app-shell auth-card">
        ${cardHead('bi-shield-lock-fill', 'Creator Access', 'creator-admin')}
        <form class="form-grid" data-admin-login-form>
          <label class="form-field">Admin Access Key<input name="accessKey" type="password" required placeholder="Enter creator key" /></label>
          <button class="auth-submit" type="submit">Unlock Admin</button>
          <div class="form-message" data-form-message>Creator admin is separate from manager accounts.</div>
        </form>
      </div>
    </section>
  `;
}

function navButton(item) {
  return `<button class="nav-link" type="button" data-view="${item.id}"><i class="bi ${item.icon}"></i>${item.label}</button>`;
}

function setView(view, updateHistory = true) {
  if (view === 'creator-admin') {
    state.view = view;
    document.body.dataset.page = view;
    if (updateHistory && window.location.pathname !== appPath(view)) window.history.pushState({}, '', appPath(view));
    renderCreatorAdminShell();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (!state.authenticated) {
    setPublicView(view === 'join' || view === 'login' ? view : 'landing', updateHistory);
    return;
  }
  state.view = view;
  document.body.dataset.page = view;
  if (updateHistory && window.location.pathname !== appPath(view)) window.history.pushState({}, '', appPath(view));
  if (!document.querySelector('#view')) renderShell();
  document.querySelectorAll('[data-view]').forEach((node) => {
    node.classList.toggle('active', node.dataset.view === view);
  });
  document.querySelector('#view').innerHTML = renderView(view);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderView(view) {
  if (view === 'create-match') return createMatchView();
  if (view === 'create-tournament') return createTournamentView();
  if (view === 'notifications') return notificationsView();
  if (view === 'matches') return matchesView();
  if (view === 'tournaments') return tournamentsView();
  if (view === 'opponents') return opponentsView();
  if (view === 'leaderboards') return leaderboardsView();
  if (view === 'disputes') return disputesView();
  if (view === 'wallet') return walletView();
  if (view === 'settings') return settingsView();
  if (view === 'auth') return authView();
  return homeView();
}

function landingView() {
  return `
    <section class="landing-page">
      <div class="landing-hero">
        <div class="landing-bg"></div>
        <div class="landing-content">
          <div class="hero-eyebrow">FC MatchHub</div>
          <h1>Find Clubs.<span class="gold-line">Book Fixtures.</span></h1>
          <p class="hero-sub">A private manager hub for EA Sports FC Pro Clubs teams. Join to schedule friendlies, find verified opponents, create tournaments, and manage prize matches with admin-reviewed payouts.</p>
          <div class="hero-btns">
            <button class="hbtn hbtn-primary hbtn-large" type="button" data-public-view="join"><i class="bi bi-person-plus-fill"></i> Join Now</button>
            <button class="hbtn hbtn-ghost hbtn-large" type="button" data-public-view="login"><i class="bi bi-box-arrow-in-right"></i> Manager Login</button>
          </div>
        </div>
      </div>
      <div class="landing-grid">
        <article class="landing-card"><i class="bi bi-lightning-charge-fill"></i><h2>Real Fixtures</h2><p>Create Pro Clubs friendlies, propose times, and keep every request organized.</p></article>
        <article class="landing-card"><i class="bi bi-people-fill"></i><h2>Verified Rivals</h2><p>Search clubs by platform, region, availability, and EA club details.</p></article>
        <article class="landing-card"><i class="bi bi-trophy-fill"></i><h2>Mini Tournaments</h2><p>Launch knockout, group stage, and league-table events with shareable links.</p></article>
        <article class="landing-card"><i class="bi bi-shield-fill-check"></i><h2>Approved Payouts</h2><p>Match funds stay held until results are confirmed or reviewed by admins.</p></article>
      </div>
    </section>
  `;
}

function publicAuthView(mode) {
  const isJoin = mode === 'join';
  const isForgot = mode === 'forgot-password';
  const isReset = mode === 'reset-password';
  return `
    <section class="public-auth-page">
      <div class="public-auth-art">
        <div class="hero-eyebrow">${isJoin ? 'Manager Signup' : isForgot || isReset ? 'Password Access' : 'Manager Login'}</div>
        <h1>${isJoin ? 'Join the Hub.' : isForgot ? 'Reset Access.' : isReset ? 'Choose Password.' : 'Welcome Back.'}<span class="gold-line">${isJoin ? 'Run the Club.' : isForgot || isReset ? 'Secure the Club.' : 'Run Matchday.'}</span></h1>
        <p class="hero-sub">${isJoin ? 'Create your manager profile, verify your club, pick a badge, and activate access after email verification.' : isForgot ? 'Enter your manager email and we will send a secure password reset link.' : isReset ? 'Create a new password using the reset link from your email.' : 'Login with your verified manager email to open your club dashboard.'}</p>
      </div>
      <div class="public-auth-panel">
        ${authForms(mode)}
      </div>
    </section>
  `;
}

function homeView() {
  const { matches, tournaments, wallet, disputes } = state.data;
  return `
    <section class="home-page">
      <div class="hero">
        <div class="hero-bg"></div>
        <div class="hero-content">
          <div class="hero-eyebrow">FC MatchHub</div>
          <h1>Your Club.<span class="gold-line">Your Legacy.</span></h1>
          <p class="hero-sub">Find opponents. Create Pro Clubs fixtures. Compete for glory, prize pools, and clean result approval.</p>
          <div class="hero-btns">
            <button class="hbtn hbtn-primary" type="button" data-view="create-match"><i class="bi bi-plus-circle-fill"></i> Create Match</button>
            <button class="hbtn hbtn-ghost" type="button" data-view="opponents"><i class="bi bi-search"></i> Find Opponents</button>
            <button class="hbtn hbtn-navy" type="button" data-view="create-tournament"><i class="bi bi-trophy-fill"></i> Create Tournament</button>
          </div>
        </div>
      </div>

      <div class="content">
        ${matchRequestCard(matches)}
        ${tournamentCard(tournaments)}
        ${walletOverviewCard(wallet)}
        ${recentResultsCard()}
        ${disputeStatusCard(disputes)}
        ${bracketPreviewCard(tournaments)}
      </div>
    </section>
  `;
}

function cardHead(icon, title, view, color = 'gold') {
  return `
    <div class="card-head">
      <div class="card-head-left">
        <div class="chip chip-${color}"><i class="bi ${icon}"></i></div>
        <span class="card-title">${title}</span>
      </div>
      <button class="view-all" type="button" data-view="${view}">View all <i class="bi bi-chevron-right"></i></button>
    </div>
  `;
}

function matchRequestCard(matches) {
  const club = activeClub().name;
  return `
    <article class="card">
      ${cardHead('bi-lightning-charge-fill', 'Match Requests', 'matches')}
      ${matches.slice(0, 3).map((match, index) => `
        <div class="mrow">
          <div class="mbadge">${initials(match.away)}</div>
          <div class="minfo"><div class="mname">${match.away}</div><div class="mdiv">${match.region} / ${match.platform}</div></div>
          <div class="mwager"><div class="mwlbl">Pool</div><div class="mwamt">${match.wager ? money(match.pool) : 'Free'}</div></div>
          <div class="mbtns">${match.home !== club ? `<button class="btn-acc" type="button" data-match-status="Accepted" data-match-id="${match.id}">Accept</button>` : '<span class="pill blue">Sent</span>'}<button class="btn-dec" type="button" data-match-status="Rejected" data-match-id="${match.id}"><i class="bi bi-x-lg"></i></button></div>
        </div>
      `).join('')}
    </article>
  `;
}

function tournamentCard(tournaments) {
  return `
    <article class="card">
      ${cardHead('bi-trophy-fill', 'Open Tournaments', 'tournaments')}
      ${tournaments.map((tournament, index) => `
        <div class="trow">
          <div class="tthumb"><i class="bi ${index === 0 ? 'bi-trophy-fill' : index === 1 ? 'bi-stars' : 'bi-fire'}"></i></div>
          <div class="tinfo">
            <div class="tregion"><i class="bi bi-globe2"></i>${tournament.region}</div>
            <div class="tname">${tournament.title}</div>
            <div class="tmeta"><span><i class="bi bi-people-fill"></i>${tournament.maxTeams} Teams</span><span><i class="bi bi-diagram-3-fill"></i>${tournament.format}</span></div>
          </div>
          <div class="tright"><div class="tplbl">Prize Pool</div><div class="tpamt">${tournament.prizePool ? money(tournament.prizePool) : 'Free'}</div><button class="btn-join" type="button" data-tournament-join="${tournament.id}">Join</button></div>
        </div>
      `).join('')}
    </article>
  `;
}

function walletOverviewCard(wallet) {
  return `
    <article class="card">
      ${cardHead('bi-wallet2', 'Wallet Overview', 'wallet')}
      <div class="wallet-top">
        <div><div class="wbal-lbl"><i class="bi bi-coin"></i> Balance</div><div class="wbal-amt">${money(wallet.availableBalance)}</div></div>
        <div class="wallet-coin"><i class="bi bi-currency-dollar"></i></div>
      </div>
      <button class="addfunds" type="button" data-view="wallet"><i class="bi bi-plus-circle"></i> Add Funds</button>
      <div class="wallet-stats">
        <div class="wstat"><div class="wslbl">Pending</div><div class="wsval pending">${money(wallet.pendingDeposits + wallet.pendingWithdrawals)}</div></div>
        <div class="wstat"><div class="wslbl">Held</div><div class="wsval pending">${money(wallet.heldFunds)}</div></div>
        <div class="wstat"><div class="wslbl">Available</div><div class="wsval earned">${money(wallet.availableBalance)}</div></div>
      </div>
    </article>
  `;
}

function recentResultsCard() {
  return `
    <article class="card">
      ${cardHead('bi-activity', 'Recent Results', 'matches', 'navy')}
      ${[
        ['ProClubz FC', '3-1', 'EliteStrikers', 'W', 50],
        ['ProClubz FC', '2-2', 'Ballers United', 'D', 25],
        ['ProClubz FC', '1-0', 'RedDevils FC', 'W', 100]
      ].map((row) => `
        <div class="mrow">
          <div class="mbadge">${initials(row[0])}</div>
          <div class="minfo"><div class="mname">${row[0]} vs ${row[2]}</div><div class="mdiv">Final score ${row[1]}</div></div>
          <div class="mwager"><div class="mwlbl">Result</div><div class="mwamt">${row[3]}</div></div>
          <span class="pill green">${money(row[4])}</span>
        </div>
      `).join('')}
    </article>
  `;
}

function disputeStatusCard(disputes) {
  return `
    <article class="card">
      ${cardHead('bi-shield-fill-exclamation', 'Dispute Status', 'disputes', 'red')}
      ${disputes.map(disputeMiniRow).join('')}
    </article>
  `;
}

function disputeMiniRow(dispute) {
  const resolved = dispute.status.toLowerCase().includes('resolved');
  return `
    <div class="drow">
      <div class="dico"><i class="bi ${resolved ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'}"></i></div>
      <div class="dinfo"><div class="dvs">${dispute.match}</div><div class="dmid">Case ${dispute.id}</div></div>
      <div class="dstatus"><div class="dpill ${resolved ? 'resolved' : ''}">${dispute.status}</div><div class="ddecision">${resolved ? 'Closed' : 'Admin review'}</div></div>
    </div>
  `;
}

function bracketPreviewCard(tournaments) {
  return `
    <article class="card">
      ${cardHead('bi-diagram-3-fill', 'Bracket Preview', 'tournaments')}
      ${tournaments.map((tournament) => `
        <div class="mrow">
          <div class="mbadge">${initials(tournament.title)}</div>
          <div class="minfo"><div class="mname">${tournament.title}</div><div class="mdiv">${tournament.teamsJoined}/${tournament.maxTeams} teams joined</div></div>
          <div class="mwager"><div class="mwlbl">Prize</div><div class="mwamt">${tournament.prizePool ? money(tournament.prizePool) : 'Free'}</div></div>
        </div>
      `).join('')}
    </article>
  `;
}

function notificationRows() {
  return state.data.notifications.map((item) => `
    <div class="data-row">
      <div class="row-icon"><i class="bi bi-bell-fill"></i></div>
      <div><div class="row-title">${item.title}</div><div class="row-sub">${item.time} / ${item.note}</div></div>
    </div>
  `).join('');
}

function notificationsView() {
  return `
    <section class="app-page">
      <div class="app-shell">
        <div class="app-hero">
          <div class="app-title-row">
            <div><div class="match-kicker">Club Inbox</div><h1 class="app-title">Notifications</h1><p class="app-copy">Match requests, tournament updates, join requests, and payout alerts appear here.</p></div>
          </div>
        </div>
        <div class="data-list">${notificationRows()}</div>
      </div>
    </section>
  `;
}

function matchesView() {
  return `
    <section class="match-page">
      <div class="match-panel">
        ${panelHero('Friendly Requests', 'My Matches', 'Manage pending requests, scheduled fixtures, wagers, reschedules, and contested match outcomes.', 'Create Match', 'Find Opponents', 'create-match')}
        <div class="match-tabs">
          ${['Pending', 'Accepted', 'Rescheduled', 'Completed', 'Cancelled', 'Disputed'].map((tab, index) => `<button class="match-tab ${index === 0 ? 'active' : ''}" type="button">${tab}<span class="tab-count">${index + 1}</span></button>`).join('')}
        </div>
        <div class="match-tools"><div class="match-search"><i class="bi bi-search"></i> Search clubs, platforms, match IDs</div></div>
        ${listingFilters(['Platform', 'Region', 'Timezone', 'Date', 'Format', 'Wager'])}
        <div class="match-table">
          <div class="match-head"><div>Matchup</div><div>Date & Time</div><div>Timezone</div><div>Platform</div><div>Type</div><div>Pool</div><div>Actions</div></div>
          ${state.data.matches.map(matchTableRow).join('')}
        </div>
      </div>
    </section>
  `;
}

function panelHero(kicker, title, copy, primary, secondary, page) {
  return `
    <div class="match-hero">
      <div class="match-title-row">
        <div><div class="match-kicker">${kicker}</div><h1 class="match-title">${title}</h1><p class="match-copy">${copy}</p></div>
        <div class="match-actions">
          <button class="hbtn hbtn-primary" type="button" data-view="${page}"><i class="bi bi-plus-circle-fill"></i>${primary}</button>
          <button class="hbtn hbtn-ghost" type="button" data-view="opponents"><i class="bi bi-search"></i>${secondary}</button>
        </div>
      </div>
    </div>
  `;
}

function createMatchView() {
  const club = activeClub();
  const openMatches = [...state.data.matches].sort((a, b) => {
    const aSame = a.region === club.region ? 0 : 1;
    const bSame = b.region === club.region ? 0 : 1;
    return aSame - bSame;
  });
  return `
    <section class="app-page">
      <div class="app-grid">
        <div class="app-main">
          <div class="app-shell">
            <div class="app-hero">
              <div class="app-title-row">
                <div><div class="match-kicker">Match Request</div><h1 class="app-title">Create Match</h1><p class="app-copy">Send a friendly request to another Pro Clubs manager. The request will appear in their match queue and trigger a notification.</p></div>
              </div>
            </div>
            <form class="form-grid form-grid-wide" data-match-create-form>
              <label class="form-field">Your Club<input name="home" value="${club.name}" readonly /></label>
              <label class="form-field">Opponent Club<div class="field-with-action"><input name="away" required placeholder="BOSTON BEASTS" /><button type="button" data-open-match-picker>Open Matches</button></div></label>
              <label class="form-field">Platform<select name="platform"><option>${club.platform || 'PlayStation 5'}</option><option>PlayStation 5</option><option>Xbox Series X/S</option><option>PC</option><option>Crossplay</option></select></label>
              <label class="form-field">Region<select name="region"><option>${club.region || 'NA East'}</option><option>NA East</option><option>NA West</option><option>Europe</option><option>South America</option></select></label>
              <label class="form-field">Date & Time<input name="startTime" type="datetime-local" required /></label>
              <label class="form-field">Match Type<select name="type"><option>Pro Clubs Friendly</option></select></label>
              <label class="form-field">Prize Pool<input name="pool" type="number" min="0" value="0" /></label>
              <label class="form-field">Notes<textarea name="notes" placeholder="Rules, kit notes, stream link, or contact info"></textarea></label>
              <button class="auth-submit" type="submit">Send Match Request</button>
              <div class="form-message" data-form-message></div>
            </form>
          </div>
        </div>
        <aside class="app-side">
          <div class="app-shell">${cardHead('bi-lightning-charge-fill', 'Open Matches', 'matches')}${openMatches.slice(0, 5).map((match) => `<div class="opponent-row"><div class="small-emblem">${initials(match.away)}</div><div><div class="row-title">${match.home} vs ${match.away}</div><div class="row-sub">${match.region} / ${dateTime(match.startTime)}</div></div><button class="action-btn details" type="button" data-use-open-match="${match.away}">Use</button></div>`).join('')}</div>
          <div class="app-shell">${cardHead('bi-bell-fill', 'Request Flow', 'matches')}${notificationRows()}</div>
        </aside>
      </div>
      ${state.openMatchPicker ? openMatchPicker(openMatches) : ''}
    </section>
  `;
}

function openMatchPicker(matches) {
  return `
    <div class="modal-backdrop" data-close-modal>
      <div class="modal-panel" role="dialog" aria-modal="true" aria-label="Select open match">
        <div class="modal-head">
          <div><div class="match-kicker">Same Region First</div><h2>Select Open Match</h2></div>
          <button class="icon-btn" type="button" data-close-modal aria-label="Close"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="data-list">
          ${matches.slice(0, 8).map((match) => `<div class="data-row"><div class="row-icon">${initials(match.away)}</div><div><div class="row-title">${match.home} vs ${match.away}</div><div class="row-sub">${match.region} / ${match.platform} / ${dateTime(match.startTime)}</div></div><button class="action-btn details" type="button" data-use-open-match="${match.away}">Use Match</button></div>`).join('')}
        </div>
      </div>
    </div>
  `;
}

function listingFilters(labels) {
  return `
    <div class="listing-filters">
      ${labels.map((label) => `<div class="filter-box"><div><div class="label">${label}</div><div class="value">All</div></div><i class="bi bi-chevron-down"></i></div>`).join('')}
    </div>
  `;
}

function matchTableRow(match, index) {
  return `
    <article class="match-item">
      <div class="versus">
        <div class="club-mini"><div class="club-badge gold">${initials(match.home)}</div><div><div class="club-name">${match.home}</div><div class="club-div">Elite Division</div></div></div>
        <div class="vs-mark">VS</div>
        <div class="club-mini"><div class="club-badge ${tone(index + 1)}">${initials(match.away)}</div><div><div class="club-name">${match.away}</div><div class="club-div">${match.region}</div></div></div>
      </div>
      <div class="match-date">${dateTime(match.startTime)}</div>
      <div class="match-timezone">${match.timezone}</div>
      <div class="match-platform"><span><i class="bi bi-controller"></i> EA FC 26</span><span class="match-sub">${match.platform}</span></div>
      <div class="match-type">${match.type.replace('Pro Clubs ', '')}</div>
      <div class="match-wager"><strong>${match.wager ? money(match.pool) : 'Free'}</strong><span class="match-sub">Held after entry</span></div>
      <div class="row-actions"><button class="action-btn accept" type="button" data-match-status="Accepted" data-match-id="${match.id}">Accept</button><button class="action-btn details" type="button" data-match-details="${match.id}">Details</button></div>
    </article>
  `;
}

function tournamentsView() {
  return `
    <section class="match-page tournament-page">
      <div class="match-panel">
        ${panelHero('Tournament Control', 'Tournaments', 'Create Pro Clubs brackets with rules, participants, results, prize details, and approval before payout.', 'Create Tournament', 'Invite Clubs', 'create-tournament')}
        ${listingFilters(['Format', 'Region', 'Platform', 'Start Time', 'Prize', 'Teams'])}
        <div class="content">
          ${state.data.tournaments.map((tournament, index) => tournamentTile(tournament, index)).join('')}
        </div>
      </div>
    </section>
  `;
}

function createTournamentView() {
  const club = activeClub();
  return `
    <section class="app-page">
      <div class="app-grid">
        <div class="app-main">
          <div class="app-shell">
            <div class="app-hero">
              <div class="app-title-row">
                <div><div class="match-kicker">Tournament Builder</div><h1 class="app-title">Create Tournament</h1><p class="app-copy">Add the basics, choose public or private access, and publish it to clubs nearby first.</p></div>
              </div>
            </div>
            <form class="form-grid form-grid-wide" data-tournament-create-form>
              <label class="form-field">Tournament Name<input name="title" required placeholder="Friday Pro Clubs Cup" /></label>
              <label class="form-field">Host Club<input name="host" value="${club.name}" readonly /></label>
              <label class="form-field">Format<select name="format"><option>Knockout</option><option>Group Stage</option><option>League Table</option></select></label>
              <label class="form-field">Max Teams<input name="maxTeams" type="number" min="2" max="64" value="2" required /></label>
              <label class="form-field">Region<select name="region"><option>${club.region || 'NA East'}</option><option>NA East</option><option>NA West</option><option>Europe</option><option>South America</option></select></label>
              <label class="form-field">Start Time<input name="startTime" type="datetime-local" required /></label>
              <label class="form-field">Prize Pool<input name="prizePool" type="number" min="0" value="0" /></label>
              <label class="form-field">Entry Fee<input name="entryFee" type="number" min="0" value="0" /></label>
              <label class="form-field">Access<select name="access"><option value="public">Public - anyone can join</option><option value="private">Private - approve join requests</option></select></label>
              <label class="form-field">Rules<textarea name="rules" placeholder="Home/away, screenshots, no-shows, dispute rules"></textarea></label>
              <button class="auth-submit" type="submit">Publish Tournament</button>
              <div class="form-message" data-form-message></div>
            </form>
          </div>
        </div>
        <aside class="app-side">
          <div class="app-shell">${cardHead('bi-info-circle-fill', 'Visibility', 'tournaments')}<div class="data-row"><div class="row-icon"><i class="bi bi-globe2"></i></div><div><div class="row-title">Public tournaments</div><div class="row-sub">Displayed to clubs, with same-region clubs prioritized first.</div></div></div><div class="data-row"><div class="row-icon"><i class="bi bi-lock-fill"></i></div><div><div class="row-title">Private tournaments</div><div class="row-sub">Join requests wait for creator approval.</div></div></div></div>
        </aside>
      </div>
    </section>
  `;
}

function tournamentTile(tournament, index) {
  return `
    <article class="card">
      ${cardHead(index === 0 ? 'bi-trophy-fill' : 'bi-diagram-3-fill', tournament.title, 'tournaments')}
      <div class="trow">
        <div class="tthumb"><i class="bi bi-trophy-fill"></i></div>
        <div class="tinfo">
          <div class="tregion"><i class="bi bi-globe2"></i>${tournament.region}</div>
          <div class="tname">${tournament.format}</div>
          <div class="tmeta"><span>${tournament.teamsJoined}/${tournament.maxTeams} Teams</span><span>${dateTime(tournament.startTime)}</span></div>
        </div>
        <div class="tright"><div class="tplbl">Prize Pool</div><div class="tpamt">${tournament.prizePool ? money(tournament.prizePool) : 'Free'}</div><button class="btn-join" type="button" data-tournament-join="${tournament.id}">Join</button></div>
      </div>
      <div class="wallet-stats">
        <div class="wstat"><div class="wslbl">Status</div><div class="wsval pending">${tournament.status}</div></div>
        <div class="wstat"><div class="wslbl">Format</div><div class="wsval earned">${tournament.format}</div></div>
        <div class="wstat"><div class="wslbl">Platform</div><div class="wsval">${tournament.platform}</div></div>
      </div>
    </article>
  `;
}

function opponentsView() {
  const region = activeClub().region || 'NA East';
  const results = state.opponentResults.length ? state.opponentResults : state.data.opponents;
  const suggested = state.data.opponents.filter((opponent) => opponent.region === region || region.includes(opponent.region));
  return `
    <section class="opponents-page">
      <div class="opponents-main">
        <div class="opponents-shell">
          <div class="opponents-hero">
            <div class="opponents-title-row">
              <div><div class="match-kicker">Opponent Finder</div><h1 class="opponents-title">Opponents</h1><p class="opponents-copy">Search EA club data by club name, then send a direct challenge request.</p></div>
              <button class="hbtn hbtn-primary" type="button" data-view="create-match"><i class="bi bi-send-fill"></i> Challenge Club</button>
            </div>
            <form class="invite-strip" data-opponent-search-form>
              <label class="invite-input"><i class="bi bi-search"></i><input name="clubName" value="${state.opponentQuery}" placeholder="Search EA club name" /></label>
              <select class="invite-select" name="platform"><option>PlayStation 5</option><option>Xbox Series X/S</option><option>PC</option></select>
              <button class="hbtn hbtn-primary" type="submit">Search</button>
            </form>
          </div>
          <div class="opponents-toolbar"><div class="opponent-search"><i class="bi bi-broadcast"></i> EA search results and same-region suggestions</div></div>
          <div class="opponents-grid">${results.length ? results.map(opponentCard).join('') : emptyState('No clubs found', 'Try the exact club name from EA Sports FC Pro Clubs.')}</div>
        </div>
      </div>
      <aside class="opponents-side">
        <div class="app-shell">${cardHead('bi-stars', 'Same Region', 'opponents', 'navy')}${(suggested.length ? suggested : state.data.opponents).slice(0, 4).map(opponentSideRow).join('')}</div>
        <div class="app-shell">${cardHead('bi-clock-history', 'Recently Faced', 'matches', 'navy')}${state.data.matches.slice(0, 3).map((match) => `<div class="opponent-row"><div class="small-emblem">${initials(match.away)}</div><div><div class="row-title">${match.away}</div><div class="row-sub">${match.region}</div></div><button class="action-btn details" type="button" data-view="create-match">Rematch</button></div>`).join('')}</div>
      </aside>
    </section>
  `;
}

function winRate(row) {
  return row.matchesPlayed ? Math.round((row.wins / row.matchesPlayed) * 100) : 0;
}

function leaderboardsView() {
  const { leaderboards } = state.data;
  return `
    <section class="app-page leaderboard-page">
      <div class="app-shell">
        <div class="app-hero">
          <div class="app-title-row">
            <div>
              <div class="match-kicker">Club Rankings</div>
              <h1 class="app-title">Leaderboards</h1>
              <p class="app-copy">Compare top-performing Pro Clubs across tournament play and regular friendly matches using win rate, record, goals scored, and total matches played.</p>
            </div>
          </div>
        </div>
        <div class="leaderboard-tabs">
          <button class="match-tab active" type="button" data-leaderboard-tab="matches">Regular Matches <span class="tab-count">${leaderboards.matches.length}</span></button>
          <button class="match-tab" type="button" data-leaderboard-tab="tournaments">Tournaments <span class="tab-count">${leaderboards.tournaments.length}</span></button>
        </div>
        <div class="leaderboard-board" id="leaderboardBoard">
          ${leaderboardTable('Regular Match Leaders', leaderboards.matches)}
        </div>
      </div>
    </section>
  `;
}

function leaderboardTable(title, rows) {
  return `
    <div class="leaderboard-headline">
      <div>
        <div class="match-kicker">${title}</div>
        <h2>${title}</h2>
      </div>
      <span class="pill green">Updated live</span>
    </div>
    <div class="leaderboard-table">
      <div class="leaderboard-row leaderboard-row-head">
        <div>Rank</div>
        <div>Club</div>
        <div>Win Rate</div>
        <div>Wins</div>
        <div>Losses</div>
        <div>Ties</div>
        <div>Goals</div>
        <div>Played</div>
      </div>
      ${rows.map((row, index) => leaderboardRow(row, index)).join('')}
    </div>
  `;
}

function leaderboardRow(row, index) {
  return `
    <article class="leaderboard-row">
      <div class="rank-badge">#${index + 1}</div>
      <div class="leader-club">
        <div class="club-badge ${tone(index)}">${initials(row.team)}</div>
        <div>
          <div class="club-name">${row.team}</div>
          <div class="club-div">${row.region} / ${row.platform}</div>
        </div>
      </div>
      <div class="rank-score">${winRate(row)}%</div>
      <div>${row.wins}</div>
      <div>${row.losses}</div>
      <div>${row.ties}</div>
      <div>${row.goalsScored}</div>
      <div>${row.matchesPlayed}</div>
    </article>
  `;
}

function opponentCard(opponent, index) {
  return `
    <article class="opponent-card">
      <div class="opponent-cover ${index === 1 ? 'blue' : index === 2 ? 'red' : ''}"></div>
      <div class="opponent-top">
        <div class="opponent-emblem">${initials(opponent.name)}</div>
        <div><div class="opponent-name">${opponent.name}</div><div class="opponent-id">${opponent.eaClubId || opponent.clubId || 'Verified club'}</div></div>
        <div class="availability">${opponent.source === 'ea' ? 'EA' : 'Verified'}</div>
      </div>
      <div class="opponent-body">
        <div class="opponent-meta"><span><i class="bi bi-globe2"></i>${opponent.region || 'Unknown region'}</span><span><i class="bi bi-controller"></i>${opponent.platform || 'Platform unknown'}</span></div>
        <p class="opponent-bio">${opponent.bio || 'Verified club result. Create a request to challenge this manager.'}</p>
        <div class="opponent-actions single"><button class="challenge-btn" type="button" data-create-match-opponent="${opponent.name}">Challenge</button></div>
      </div>
    </article>
  `;
}

function opponentSideRow(opponent) {
  return `<div class="opponent-row"><div class="small-emblem">${initials(opponent.name)}</div><div><div class="row-title">${opponent.name}</div><div class="row-sub">${opponent.region} / ${opponent.platform}</div></div><button class="action-btn accept" type="button" data-create-match-opponent="${opponent.name}">Challenge</button></div>`;
}

function emptyState(title, copy) {
  return `<div class="empty-state"><i class="bi bi-search"></i><h3>${title}</h3><p>${copy}</p></div>`;
}

function disputesView() {
  return `
    <section class="app-page">
      <div class="app-shell">
        <div class="app-hero">
          <div class="app-title-row">
            <div><div class="match-kicker">Result Review</div><h1 class="app-title">Disputes</h1><p class="app-copy">Contest match results, compare submitted scores, upload proof, and keep match funds held until admin approval.</p></div>
          </div>
        </div>
        <div class="data-list">${state.data.disputes.map((dispute) => `
          <div class="data-row">
            <div class="row-icon"><i class="bi bi-shield-fill-exclamation"></i></div>
            <div><div class="row-title">${dispute.match}</div><div class="row-sub">${dispute.reason} Submitted: ${dispute.submittedScore}. Contested: ${dispute.contestedScore}.</div></div>
            <div class="row-meta-right">${statusPill(dispute.status)}<span class="meta">Funds ${money(dispute.funds)}</span></div>
          </div>
        `).join('')}</div>
      </div>
    </section>
  `;
}

function walletView() {
  const { wallet } = state.data;
  return `
    <section class="app-page">
      <div class="app-grid">
        <div class="app-main">
          <div class="app-shell">
            <div class="app-hero">
              <div class="app-title-row">
                <div><div class="match-kicker">Club Finance</div><h1 class="app-title">Wallet</h1><p class="app-copy">Track deposits, withdrawals, pending requests, held match funds, and payout approval before money is released.</p></div>
                <button class="hbtn hbtn-primary" type="button" data-payout-review><i class="bi bi-check-circle-fill"></i> Request Payout Review</button>
              </div>
            </div>
            <div class="stat-grid">
              <div class="stat-card"><div class="stat-label">Available</div><div class="stat-value">${money(wallet.availableBalance)}</div><div class="stat-note">Ready balance</div></div>
              <div class="stat-card"><div class="stat-label">Held Funds</div><div class="stat-value">${money(wallet.heldFunds)}</div><div class="stat-note">Awaiting result approval</div></div>
              <div class="stat-card"><div class="stat-label">Pending Deposits</div><div class="stat-value">${money(wallet.pendingDeposits)}</div><div class="stat-note">Admin review</div></div>
              <div class="stat-card"><div class="stat-label">Withdrawals</div><div class="stat-value">${money(wallet.pendingWithdrawals)}</div><div class="stat-note">Approval required</div></div>
            </div>
            <div class="data-list">${wallet.transactions.map(transactionRow).join('')}</div>
          </div>
        </div>
        <aside class="app-side">
          ${walletForm('deposit', 'Deposit Request', 'Submit Deposit Request')}
          ${walletForm('withdraw', 'Withdraw Request', 'Submit Withdrawal Request')}
          <div class="app-shell">${cardHead('bi-hourglass-split', 'Pending Requests', 'wallet')}${wallet.pendingRequests.map(transactionRow).join('')}</div>
        </aside>
      </div>
    </section>
  `;
}

function settingsView() {
  const club = activeClub();
  return `
    <section class="app-page settings-page">
      <div class="app-grid">
        <div class="app-main">
          <div class="app-shell">
            <div class="app-hero">
              <div class="app-title-row">
                <div><div class="match-kicker">Manager Settings</div><h1 class="app-title">Settings</h1><p class="app-copy">Manage account access, club display details, and basic manager preferences.</p></div>
              </div>
            </div>
            <div class="settings-profile">
              ${clubLogoMarkup(club, 'settings-logo')}
              <div>
                <div class="settings-club-name">${club.name}</div>
                <div class="settings-club-meta">${club.region || 'Region pending'} / ${club.platform || 'Platform pending'}</div>
              </div>
            </div>
            <form class="form-grid form-grid-wide" data-settings-password-form>
              <label class="form-field">Manager Email<input name="email" type="email" value="${state.managerEmail}" required placeholder="manager@club.com" /></label>
              <label class="form-field">Current Password<input name="currentPassword" type="password" required minlength="6" placeholder="Current password" /></label>
              <label class="form-field">New Password<input name="newPassword" type="password" required minlength="6" placeholder="Minimum 6 characters" /></label>
              <button class="auth-submit" type="submit">Change Password</button>
              <div class="form-message" data-form-message></div>
            </form>
          </div>
        </div>
        <aside class="app-side">
          <div class="app-shell">
            ${cardHead('bi-palette-fill', 'Club Logo', 'settings')}
            <div class="logo-preview-list">
              ${LOGO_STYLES.slice(0, 4).map((style, index) => `<img src="${clubLogoUrl(`${club.name} preview ${index}`, style)}" alt="${style} logo preview" />`).join('')}
            </div>
            <p class="side-copy">Logo choices are available during signup. More profile editing can be connected here once the database is added.</p>
          </div>
          <div class="app-shell">
            ${cardHead('bi-shield-lock-fill', 'Security', 'settings')}
            <div class="data-row"><div class="row-icon"><i class="bi bi-envelope-check-fill"></i></div><div><div class="row-title">Email verification</div><div class="row-sub">Required before manager access is active.</div></div></div>
            <div class="data-row"><div class="row-icon"><i class="bi bi-key-fill"></i></div><div><div class="row-title">Password reset</div><div class="row-sub">Available from the login page by email link.</div></div></div>
          </div>
        </aside>
      </div>
    </section>
  `;
}

function adminView() {
  const { admin } = state.data;
  return `
    <section class="app-page">
      <div class="app-grid">
        <div class="app-main">
          <div class="app-shell">
            <div class="app-hero">
              <div class="app-title-row">
                <div><div class="match-kicker">Admin Finance</div><h1 class="app-title">Admin</h1><p class="app-copy">Track platform revenue, pending admin withdrawals, and payout operations.</p></div>
              </div>
            </div>
            <div class="stat-grid">
              <div class="stat-card"><div class="stat-label">Admin Balance</div><div class="stat-value">${money(admin.availableBalance)}</div><div class="stat-note">Available to withdraw</div></div>
              <div class="stat-card"><div class="stat-label">Revenue</div><div class="stat-value">${money(admin.revenue)}</div><div class="stat-note">Admin share from paid events</div></div>
              <div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value">${money(admin.pendingWithdrawals)}</div><div class="stat-note">Withdrawal review</div></div>
            </div>
            <div class="data-list">${admin.transactions.map(transactionRow).join('')}</div>
          </div>
        </div>
        <aside class="app-side">
          ${adminWithdrawForm()}
          <div class="app-shell">${cardHead('bi-hourglass-split', 'Admin Requests', 'creator-admin')}${admin.pendingRequests.map(transactionRow).join('') || emptyState('No pending admin requests', 'Admin withdrawal requests will appear here.')}</div>
        </aside>
      </div>
    </section>
  `;
}

function adminWithdrawForm() {
  return `
    <div class="app-shell">
      ${cardHead('bi-bank2', 'Admin Withdraw', 'creator-admin')}
      <form class="form-grid" data-admin-withdraw-form>
        <label class="form-field">Amount<input name="amount" type="number" min="1" required placeholder="100" /></label>
        <label class="form-field">Method<select name="method" data-payment-method><option value="paypal">PayPal</option><option value="bank-transfer">Bank Transfer</option><option value="crypto-wallet">Crypto Wallet</option></select></label>
        <div class="payment-method-fields" data-method-fields="paypal">
          <label class="form-field">PayPal Email<input name="paypalEmail" type="email" placeholder="creator@example.com" /></label>
        </div>
        <div class="payment-method-fields hidden" data-method-fields="bank-transfer">
          <label class="form-field">Bank Memo<input name="reference" placeholder="Bank destination or memo" /></label>
        </div>
        <div class="payment-method-fields hidden" data-method-fields="crypto-wallet">
          <label class="form-field">Wallet Address<input name="walletAddress" placeholder="0x... or BTC address" /></label>
          <label class="form-field">Network<select name="cryptoNetwork"><option>USDC Base</option><option>Ethereum</option><option>Bitcoin</option><option>Solana</option></select></label>
        </div>
        <button class="auth-submit" type="submit">Submit Admin Withdraw</button>
        <div class="form-message" data-form-message></div>
      </form>
    </div>
  `;
}

function walletForm(kind, title, button) {
  const isDeposit = kind === 'deposit';
  return `
    <div class="app-shell">
      ${cardHead(kind === 'deposit' ? 'bi-plus-circle' : 'bi-cash-coin', title, 'wallet')}
      <form class="form-grid" data-wallet-form="${kind}">
        <label class="form-field">Amount<input name="amount" type="number" min="1" required placeholder="100" /></label>
        <label class="form-field">Method<select name="method" data-payment-method><option value="${isDeposit ? 'card' : 'paypal'}">${isDeposit ? 'Card' : 'PayPal'}</option><option value="${isDeposit ? 'paypal' : 'bank-transfer'}">${isDeposit ? 'PayPal' : 'Bank Transfer'}</option><option value="${isDeposit ? 'coinbase-crypto' : 'crypto-wallet'}">${isDeposit ? 'Coinbase / Crypto' : 'Crypto Wallet'}</option></select></label>
        <div class="payment-method-fields" data-method-fields="card">
          <label class="form-field">Card Number<input name="cardNumber" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" /></label>
          <label class="form-field">Name on Card<input name="cardName" autocomplete="cc-name" placeholder="Manager Name" /></label>
          <label class="form-field">Expiry<input name="cardExpiry" autocomplete="cc-exp" placeholder="MM/YY" /></label>
          <label class="form-field">CVC<input name="cardCvc" inputmode="numeric" autocomplete="cc-csc" placeholder="123" /></label>
        </div>
        <div class="payment-method-fields hidden" data-method-fields="paypal">
          <label class="form-field">PayPal Email<input name="paypalEmail" type="email" placeholder="manager@example.com" /></label>
          <button class="payment-redirect" type="button" data-paypal-redirect><i class="bi bi-paypal"></i> Continue to PayPal</button>
        </div>
        <div class="payment-method-fields hidden" data-method-fields="coinbase-crypto crypto-wallet">
          <label class="form-field">Wallet Address<input name="walletAddress" placeholder="0x... or BTC address" /></label>
          <label class="form-field">Network<select name="cryptoNetwork"><option>USDC Base</option><option>Ethereum</option><option>Bitcoin</option><option>Solana</option></select></label>
        </div>
        <label class="form-field">Reference<input name="reference" placeholder="${isDeposit ? 'Optional note' : 'Payout memo'}" /></label>
        <button class="auth-submit" type="submit">${button}</button>
        <div class="form-message" data-form-message></div>
      </form>
    </div>
  `;
}

function transactionRow(item) {
  return `
    <div class="data-row">
      <div class="row-icon"><i class="bi bi-receipt"></i></div>
      <div><div class="row-title">${item.title}</div><div class="row-sub">${item.date} / ${item.note}</div></div>
      <div class="row-meta-right"><strong>${money(item.amount)}</strong>${statusPill(item.status)}</div>
    </div>
  `;
}

function authView() {
  return `
    <section class="app-page">
      <div class="app-shell">
        <div class="app-hero"><div class="app-title-row"><div><div class="match-kicker">Manager Access</div><h1 class="app-title">Login</h1><p class="app-copy">Create a club manager account with email verification and EA club details for future verification checks.</p></div></div></div>
      </div>
      <div class="two-col">
        ${authForms('login')}
      </div>
    </section>
  `;
}

function authForms(mode = 'join') {
  if (mode === 'forgot-password') {
    return `
      <div class="app-shell auth-card">${cardHead('bi-key-fill', 'Forgot Password', 'auth')}
        <form class="form-grid" data-auth-form="forgot">
          <label class="form-field">Manager Email<input name="email" type="email" required pattern="^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$" placeholder="manager@club.com" /></label>
          <button class="auth-submit" type="submit">Send Reset Link</button>
          <div class="auth-switch">Remembered it? <button type="button" data-public-view="login">Login</button></div>
          <div class="form-message" data-form-message></div>
        </form>
      </div>
    `;
  }

  if (mode === 'reset-password') {
    return `
      <div class="app-shell auth-card">${cardHead('bi-shield-lock-fill', 'Reset Password', 'auth')}
        <form class="form-grid" data-auth-form="reset">
          <input name="token" type="hidden" value="${resetToken()}" />
          <label class="form-field">New Password<input name="password" type="password" required minlength="6" placeholder="Minimum 6 characters" /></label>
          <button class="auth-submit" type="submit">Update Password</button>
          <div class="auth-switch">Already updated? <button type="button" data-public-view="login">Login</button></div>
          <div class="form-message" data-form-message>${resetToken() ? '' : 'This reset link is missing a token. Request a new password reset email.'}</div>
        </form>
      </div>
    `;
  }

  if (mode === 'login') {
    return `
      <div class="app-shell auth-card">${cardHead('bi-box-arrow-in-right', 'Manager Login', 'auth')}
        <form class="form-grid" data-auth-form="login">
          <label class="form-field">Email<input name="email" type="email" required pattern="^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$" placeholder="manager@club.com" /></label>
          <label class="form-field">Password<input name="password" type="password" required minlength="6" placeholder="Your password" /></label>
          <button class="auth-submit" type="submit">Login</button>
          <div class="auth-switch"><button type="button" data-public-view="forgot-password">Forgot password?</button></div>
          <div class="auth-switch">New manager? <button type="button" data-public-view="join">Create account</button></div>
          <div class="form-message" data-form-message></div>
        </form>
      </div>
    `;
  }

  return `
    <div class="app-shell auth-card">${cardHead('bi-person-plus-fill', 'Create Account', 'auth')}
      <form class="form-grid" data-auth-form="register">
        <label class="form-field">Email<input name="email" type="email" required pattern="^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$" placeholder="manager@club.com" /></label>
        <label class="form-field">Password<input name="password" type="password" required minlength="6" placeholder="Minimum 6 characters" /></label>
        <label class="form-field">Club Name<input name="clubName" required placeholder="Your Pro Clubs name" /></label>
        <label class="form-field">EA Club ID Optional<input name="clubId" placeholder="Add it only if you know it" /></label>
        <label class="form-field">Platform<select name="platform"><option>PlayStation 5</option><option>Xbox Series X/S</option><option>PC</option></select></label>
        <div class="logo-picker">
          <div class="logo-picker-head"><span>Club Logo</span><button type="button" data-refresh-logos><i class="bi bi-arrow-clockwise"></i> Refresh</button></div>
          <div class="logo-options">
            ${LOGO_STYLES.map((style, index) => {
              const url = clubLogoUrl(`FC MatchHub ${style} ${index}`, style);
              return `<label class="logo-choice ${index === 0 ? 'selected' : ''}"><input type="radio" name="logoUrl" value="${url}" ${index === 0 ? 'checked' : ''} /><img src="${url}" alt="${style} club logo" /><span>${style.replace('-', ' ')}</span></label>`;
            }).join('')}
          </div>
        </div>
        <button class="verify-club-btn" type="button" data-club-verify><i class="bi bi-shield-check"></i> Verify Club Details</button>
        <div class="club-verify-result" data-club-verify-result></div>
        <button class="auth-submit" type="submit">Create Manager Account</button>
        <div class="auth-switch">Already verified? <button type="button" data-public-view="login">Login instead</button></div>
        <div class="form-message" data-form-message></div>
      </form>
    </div>
  `;
}

document.addEventListener('click', async (event) => {
  const publicViewButton = event.target.closest('[data-public-view]');
  if (publicViewButton) {
    setPublicView(publicViewButton.dataset.publicView);
    return;
  }

  if (event.target.closest('[data-logout]')) {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    state.authenticated = false;
    state.view = 'landing';
    localStorage.removeItem('fcm-authenticated');
    localStorage.removeItem('fcm-club');
    localStorage.removeItem('fcm-manager-email');
    localStorage.removeItem('fcm-admin-unlocked');
    state.club = null;
    state.managerEmail = '';
    state.adminUnlocked = false;
    renderPublicShell();
    setPublicView('landing');
    return;
  }

  const viewButton = event.target.closest('[data-view]');
  if (viewButton) {
    setView(viewButton.dataset.view);
    return;
  }

  if (event.target.closest('[data-open-match-picker]')) {
    state.openMatchPicker = true;
    setView('create-match', false);
    return;
  }

  if (event.target.matches('[data-close-modal]') || event.target.closest('[data-close-modal]')) {
    if (event.target.closest('.modal-panel') && !event.target.closest('[data-close-modal].icon-btn')) return;
    state.openMatchPicker = false;
    setView('create-match', false);
    return;
  }

  const matchOpponentButton = event.target.closest('[data-create-match-opponent]');
  if (matchOpponentButton) {
    setView('create-match');
    setTimeout(() => {
      const input = document.querySelector('[data-match-create-form] input[name="away"]');
      if (input) input.value = matchOpponentButton.dataset.createMatchOpponent;
    }, 0);
    return;
  }

  const openMatchButton = event.target.closest('[data-use-open-match]');
  if (openMatchButton) {
    state.openMatchPicker = false;
    setView('create-match');
    setTimeout(() => {
      const input = document.querySelector('[data-match-create-form] input[name="away"]');
      if (input) input.value = openMatchButton.dataset.useOpenMatch;
    }, 0);
    return;
  }

  const matchStatusButton = event.target.closest('[data-match-status]');
  if (matchStatusButton) {
    const response = await fetch(`/api/matches/${encodeURIComponent(matchStatusButton.dataset.matchId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: matchStatusButton.dataset.matchStatus })
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.message || 'Match update failed.');
      return;
    }
    state.data = result.data;
    showToast(result.message);
    setView(state.view, false);
    return;
  }

  const matchDetailsButton = event.target.closest('[data-match-details]');
  if (matchDetailsButton) {
    const match = state.data.matches.find((item) => item.id === matchDetailsButton.dataset.matchDetails);
    showToast(match ? `${match.home} vs ${match.away} / ${match.status} / ${dateTime(match.startTime)}` : 'Match details unavailable.');
    return;
  }

  const tournamentJoinButton = event.target.closest('[data-tournament-join]');
  if (tournamentJoinButton) {
    const response = await fetch(`/api/tournaments/${encodeURIComponent(tournamentJoinButton.dataset.tournamentJoin)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubName: activeClub().name })
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.message || 'Tournament join failed.');
      return;
    }
    state.data = result.data;
    showToast(result.message);
    setView(state.view, false);
    return;
  }

  const verifyButton = event.target.closest('[data-club-verify]');
  if (verifyButton) {
    const form = verifyButton.closest('form');
    const resultNode = form.querySelector('[data-club-verify-result]');
    const values = Object.fromEntries(new FormData(form).entries());

    if (!values.clubName || !values.platform) {
      resultNode.className = 'club-verify-result error';
      resultNode.textContent = 'Enter club name and platform before checking.';
      return;
    }

    verifyButton.disabled = true;
    resultNode.className = 'club-verify-result';
    resultNode.textContent = 'Checking EA club details...';

    try {
      const response = await fetch('/api/ea/clubs/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const result = await response.json();
      resultNode.className = `club-verify-result ${result.ok ? 'success' : 'error'}`;
      resultNode.textContent = result.ok
        ? `Verified: ${result.club.name}${result.club.clubId ? ` (${result.club.clubId})` : ''} via ${result.source.toUpperCase()}.`
        : 'No exact club match found. Check spelling and platform.';
    } catch (error) {
      resultNode.className = 'club-verify-result error';
      resultNode.textContent = 'Club verification is unavailable right now. Try again shortly.';
    } finally {
      verifyButton.disabled = false;
    }
    return;
  }

  const refreshLogos = event.target.closest('[data-refresh-logos]');
  if (refreshLogos) {
    const form = refreshLogos.closest('form');
    const clubName = form.querySelector('input[name="clubName"]')?.value || 'FC MatchHub';
    const options = form.querySelector('.logo-options');
    options.innerHTML = LOGO_STYLES.map((style, index) => {
      const url = clubLogoUrl(`${clubName} ${style} ${Date.now()} ${index}`, style);
      return `<label class="logo-choice ${index === 0 ? 'selected' : ''}"><input type="radio" name="logoUrl" value="${url}" ${index === 0 ? 'checked' : ''} /><img src="${url}" alt="${style} club logo" /><span>${style.replace('-', ' ')}</span></label>`;
    }).join('');
    return;
  }

  const logoChoice = event.target.closest('.logo-choice');
  if (logoChoice) {
    logoChoice.closest('.logo-options').querySelectorAll('.logo-choice').forEach((choice) => choice.classList.toggle('selected', choice === logoChoice));
  }

  if (event.target.closest('#themeToggle')) {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('fcm-theme', state.theme);
    document.documentElement.dataset.theme = state.theme;
    document.querySelector('.theme-toggle-knob').innerHTML = `<i class="bi ${state.theme === 'dark' ? 'bi-moon-fill' : 'bi-sun-fill'}"></i>`;
    return;
  }

  if (event.target.closest('[data-payout-review]')) {
    const response = await fetch('/api/payout-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: state.data.wallet.heldFunds,
        note: `${activeClub().name} requested held funds review`
      })
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.message || 'Payout review request failed.');
      return;
    }
    state.data = result.data;
    showToast(result.message);
    setView('wallet', false);
    return;
  }

  if (event.target.closest('[data-paypal-redirect]')) {
    showToast('Opening PayPal processing flow. Add PayPal client credentials to enable live checkout.');
    return;
  }
});

document.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-leaderboard-tab]');
  if (!tab || !state.data?.leaderboards) return;
  document.querySelectorAll('[data-leaderboard-tab]').forEach((button) => {
    button.classList.toggle('active', button === tab);
  });
  const type = tab.dataset.leaderboardTab;
  const title = type === 'tournaments' ? 'Tournament Leaders' : 'Regular Match Leaders';
  document.querySelector('#leaderboardBoard').innerHTML = leaderboardTable(title, state.data.leaderboards[type]);
});

document.addEventListener('submit', async (event) => {
  const authForm = event.target.closest('[data-auth-form]');
  const walletForm = event.target.closest('[data-wallet-form]');
  const matchCreateForm = event.target.closest('[data-match-create-form]');
  const tournamentCreateForm = event.target.closest('[data-tournament-create-form]');
  const opponentSearchForm = event.target.closest('[data-opponent-search-form]');
  const adminWithdrawForm = event.target.closest('[data-admin-withdraw-form]');
  const adminLoginForm = event.target.closest('[data-admin-login-form]');
  const settingsPasswordForm = event.target.closest('[data-settings-password-form]');
  if (!authForm && !walletForm && !matchCreateForm && !tournamentCreateForm && !opponentSearchForm && !adminWithdrawForm && !adminLoginForm && !settingsPasswordForm) return;
  event.preventDefault();

  const message = event.target.querySelector('[data-form-message]');
  const values = Object.fromEntries(new FormData(event.target).entries());

  if (opponentSearchForm) {
    state.opponentQuery = values.clubName || '';
    const response = await fetch(`/api/ea/clubs/search?clubName=${encodeURIComponent(values.clubName || '')}&platform=${encodeURIComponent(values.platform || 'PlayStation 5')}`);
    const result = await response.json();
    state.opponentResults = result.clubs.map((club) => ({
      ...club,
      eaClubId: club.clubId,
      bio: `${club.name} is available from the club search directory.`
    }));
    setView('opponents');
    return;
  }

  if (adminLoginForm) {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });
    const result = await response.json();
    message.textContent = result.message || 'Admin access failed.';
    if (response.ok) {
      state.adminUnlocked = true;
      localStorage.setItem('fcm-admin-unlocked', 'true');
      setTimeout(() => setView('creator-admin', false), 300);
    }
    return;
  }

  if (walletForm) {
    const kind = walletForm.dataset.walletForm;
    const endpoint = kind === 'deposit' ? '/api/payments/deposit' : '/api/payments/withdraw';
    const reference = values.method === 'card'
      ? `Card ending ${String(values.cardNumber || '').replace(/\D/g, '').slice(-4) || 'pending'}`
      : values.method === 'paypal'
        ? values.paypalEmail
        : values.method?.includes('crypto')
          ? `${values.cryptoNetwork || 'Crypto'} wallet ${String(values.walletAddress || '').slice(0, 8)}...`
          : values.reference;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, reference, currency: state.currency.toLowerCase() })
    });
    const result = await response.json();
    if (!response.ok) {
      message.textContent = result.message || 'Payment request failed.';
      return;
    }
    state.data.wallet.transactions = [result.transaction, ...state.data.wallet.transactions];
    state.data.wallet.pendingRequests = [result.transaction, ...state.data.wallet.pendingRequests];
    if (kind === 'deposit') state.data.wallet.pendingDeposits += Number(values.amount || 0);
    if (kind === 'withdraw') state.data.wallet.pendingWithdrawals += Number(values.amount || 0);
    message.textContent = `${result.transaction.title}. Status: ${result.transaction.status}.`;
    event.target.reset();
    setTimeout(() => {
      renderShell();
      setView('wallet');
    }, 650);
    return;
  }

  if (adminWithdrawForm) {
    const reference = values.method === 'paypal'
      ? values.paypalEmail || values.reference
      : values.method?.includes('crypto')
        ? `${values.cryptoNetwork || 'Crypto'} wallet ${String(values.walletAddress || values.reference || '').slice(0, 8)}...`
        : values.reference;
    const response = await fetch('/api/payments/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, reference, scope: 'admin' })
    });
    const result = await response.json();
    if (!response.ok) {
      message.textContent = result.message || 'Admin withdrawal failed.';
      return;
    }
    result.transaction.title = 'Admin withdrawal request submitted';
    state.data.admin.transactions = [result.transaction, ...state.data.admin.transactions];
    state.data.admin.pendingRequests = [result.transaction, ...state.data.admin.pendingRequests];
    state.data.admin.pendingWithdrawals += Number(values.amount || 0);
    message.textContent = `${result.transaction.title}. Status: ${result.transaction.status}.`;
    event.target.reset();
    setTimeout(() => {
      renderShell();
      setView('creator-admin');
    }, 650);
    return;
  }

  if (settingsPasswordForm) {
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });
    const result = await response.json();
    message.textContent = result.message || (response.ok ? 'Password changed.' : 'Password change failed.');
    if (response.ok) {
      state.managerEmail = values.email;
      localStorage.setItem('fcm-manager-email', values.email);
      event.target.reset();
      event.target.querySelector('input[name="email"]').value = state.managerEmail;
    }
    return;
  }

  if (matchCreateForm) {
    const response = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        startTime: new Date(values.startTime).toISOString()
      })
    });
    const result = await response.json();
    if (!response.ok) {
      message.textContent = result.message || 'Match request failed.';
      return;
    }
    state.data = result.data;
    message.textContent = result.message || 'Match request saved.';
    event.target.reset();
    setTimeout(() => {
      renderShell();
      setView('matches');
    }, 600);
    return;
  }

  if (tournamentCreateForm) {
    const response = await fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        platform: activeClub().platform || 'PlayStation 5',
        startTime: new Date(values.startTime).toISOString()
      })
    });
    const result = await response.json();
    if (!response.ok) {
      message.textContent = result.message || 'Tournament creation failed.';
      return;
    }
    state.data = result.data;
    message.textContent = result.message || 'Tournament saved.';
    event.target.reset();
    setTimeout(() => {
      renderShell();
      setView('tournaments');
    }, 600);
    return;
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  const authKind = authForm.dataset.authForm;
  const actionLabels = {
    register: 'Creating account...',
    login: 'Logging in...',
    forgot: 'Sending reset link...',
    reset: 'Updating password...'
  };
  const actionLabel = actionLabels[authKind] || 'Working...';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.dataset.originalText = submitButton.innerHTML;
    submitButton.innerHTML = `<span class="btn-spinner"></span>${actionLabel}`;
  }
  message.classList.add('is-working');
  message.textContent = actionLabel;

  const endpoints = {
    register: '/api/auth/register',
    login: '/api/auth/login',
    forgot: '/api/auth/forgot-password',
    reset: '/api/auth/reset-password'
  };
  const endpoint = endpoints[authKind] || '/api/auth/login';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });
    const result = await response.json();
    message.classList.remove('is-working');
    if (result.devResetLink) {
      message.innerHTML = `${result.message}<br><a href="${result.devResetLink}">Reset password locally</a>`;
    } else if (result.devVerificationLink) {
      message.innerHTML = `${result.message}<br><a href="${result.devVerificationLink}">Verify email locally</a>`;
    } else {
      message.textContent = result.message || 'Request processed.';
    }
    if (response.ok && authKind === 'login') {
      state.authenticated = true;
      state.club = result.user?.club || null;
      state.managerEmail = result.user?.email || values.email;
      localStorage.setItem('fcm-authenticated', 'true');
      if (state.club) localStorage.setItem('fcm-club', JSON.stringify(state.club));
      if (state.managerEmail) localStorage.setItem('fcm-manager-email', state.managerEmail);
      event.target.reset();
      setTimeout(() => {
        window.history.pushState({}, '', '/home');
        renderShell();
        setView('home');
      }, 400);
    } else if (response.ok && authKind === 'reset') {
      event.target.reset();
      setTimeout(() => setPublicView('login'), 700);
    } else if (response.ok) {
      event.target.reset();
    }
  } catch (error) {
    message.classList.remove('is-working');
    message.textContent = 'Connection failed. Please try again.';
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = submitButton.dataset.originalText;
      delete submitButton.dataset.originalText;
    }
  }
});

document.addEventListener('change', (event) => {
  if (event.target.matches('[data-payment-method]')) {
    const form = event.target.closest('form');
    form.querySelectorAll('[data-method-fields]').forEach((group) => {
      const methods = group.dataset.methodFields.split(' ');
      group.classList.toggle('hidden', !methods.includes(event.target.value));
    });
    return;
  }

  if (event.target.id !== 'currencySelect') return;
  state.currency = event.target.value;
  localStorage.setItem('fcm-currency', state.currency);
  if (state.authenticated) {
    renderShell();
    setView(state.view);
  } else {
    renderPublicShell();
    setPublicView(state.view);
  }
});

window.addEventListener('popstate', () => {
  const view = viewFromPath();
  if (state.authenticated) {
    setView(view, false);
  } else {
    setPublicView(view, false);
  }
});

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 3600);
}

load().catch((error) => {
  app.className = 'app-loading';
  app.textContent = `Unable to load FC MatchHub: ${error.message}`;
});

/**
 * Viral Bolt Public Marketplace & Modals (Vanilla JS + Bootstrap 5 + Tailwind)
 */
window.MW = window.MW || {};

(function (MW) {
  let state = {
    search: '',
    categoryId: 'all',
    sortBy: 'featured',
    howMode: 'worker',
    activeJob: null,
    shotBase64: '',
  };

  function getFilteredJobs(bootstrap) {
    const q = state.search.trim().toLowerCase();
    let list = (bootstrap.jobs || []).filter(function (job) {
      if (state.categoryId !== 'all' && Number(job.categoryId) !== Number(state.categoryId)) return false;
      if (q && !job.title.toLowerCase().includes(q) && !job.categoryName.toLowerCase().includes(q)) return false;
      return true;
    });
    if (state.sortBy === 'highest') {
      list = list.slice().sort(function (a, b) { return b.rewardPerWorker - a.rewardPerWorker; });
    } else if (state.sortBy === 'slots') {
      list = list.slice().sort(function (a, b) {
        return (b.workersNeeded - b.workersCompleted) - (a.workersNeeded - a.workersCompleted);
      });
    }
    return list;
  }

  MW.renderMarketplace = function (bootstrap, currentUser) {
    const mount = document.getElementById('view-marketplace');
    if (!mount || !bootstrap) return;
    const sym = bootstrap.settings.currencySymbol || '$';
    const jobs = getFilteredJobs(bootstrap);

    const catCardsHtml = (bootstrap.categories || []).map(function (cat) {
      const count = (bootstrap.jobs || []).filter(function (j) { return Number(j.categoryId) === Number(cat.id); }).length;
      const isActive = state.categoryId !== 'all' && Number(state.categoryId) === Number(cat.id);
      return `
        <div class="col-md-6 col-lg-4">
          <button type="button" data-cat-pick="${cat.id}" class="mw-card w-100 text-start p-4 d-flex align-items-start gap-3 ${isActive ? 'border-primary ring-2 ring-indigo-500/25 bg-indigo-50/40' : ''}">
            <div class="mw-cat-${MW.esc(cat.color || 'indigo')} rounded-3 d-flex align-items-center justify-content-center flex-shrink-0" style="width:44px;height:44px;">
              <i class="bi bi-layers-fill fs-5"></i>
            </div>
            <div class="flex-grow-1 min-w-0">
              <div class="d-flex justify-content-between align-items-center gap-2">
                <h3 class="h6 fw-bold text-slate-900 mb-0 text-truncate">${MW.esc(cat.name)}</h3>
                <span class="font-mono small text-secondary">${count} open</span>
              </div>
              <p class="small text-secondary mt-1 mb-2">${MW.esc(cat.description)}</p>
              <div class="font-mono small fw-semibold mw-text-${MW.esc(cat.color || 'indigo')}">
                Min ${MW.reward(cat.minCpc, sym)} / task
              </div>
            </div>
          </button>
        </div>
      `;
    }).join('');

    const filterBtnsHtml = [
      `<button type="button" data-cat-filter="all" class="btn btn-sm ${state.categoryId === 'all' ? 'btn-primary' : 'btn-light text-secondary'} fw-semibold">All Tasks</button>`,
    ].concat((bootstrap.categories || []).map(function (cat) {
      const act = Number(state.categoryId) === Number(cat.id);
      return `<button type="button" data-cat-filter="${cat.id}" class="btn btn-sm ${act ? 'btn-primary' : 'btn-light text-secondary'} fw-semibold">${MW.esc(cat.name)}</button>`;
    })).join('');

    const jobsHtml = jobs.length === 0
      ? `<div class="mw-card p-5 text-center"><p class="fw-semibold mb-1">No active micro-jobs match your filter.</p><p class="small text-secondary mb-3">Try clearing search or switching categories.</p><button type="button" id="mp-reset-filters" class="btn btn-primary btn-sm">Reset Filters</button></div>`
      : `<div class="row g-4">` + jobs.map(function (job) {
          const pct = Math.min(100, Math.round((job.workersCompleted / Math.max(1, job.workersNeeded)) * 100));
          const col = MW.esc(job.categoryColor || 'indigo');
          return `
            <div class="col-md-6">
              <div class="mw-card p-4 h-100 d-flex flex-column justify-content-between">
                <div>
                  <div class="d-flex justify-content-between align-items-center gap-2 small">
                    <div class="text-truncate">
                      <span class="fw-bold mw-text-${col}">${MW.esc(job.categoryName)}</span>
                      <span class="text-secondary"> · ${MW.esc(job.targetRegion)}</span>
                      ${job.featured ? '<span class="text-warning fw-bold"> · Featured</span>' : ''}
                    </div>
                    <span class="font-mono fs-5 fw-bold text-success">${MW.reward(job.rewardPerWorker, sym)}</span>
                  </div>
                  <h3 class="h6 fw-bold text-slate-900 mt-2 mb-1">${MW.esc(job.title)}</h3>
                  <p class="small text-secondary mb-0">Posted by ${MW.esc(job.employerName)} · Est. ${Number(job.estimatedMinutes)} min</p>
                </div>
                <div class="d-flex align-items-center justify-content-between gap-3 pt-3 mt-4 border-top">
                  <div class="flex-grow-1">
                    <div class="d-flex justify-content-between small text-secondary mb-1">
                      <span>Progress</span>
                      <span class="font-mono fw-semibold">${job.workersCompleted} / ${job.workersNeeded}</span>
                    </div>
                    <div class="progress" style="height:8px;">
                      <div class="progress-bar mw-progress-${col}" style="width:${pct}%"></div>
                    </div>
                  </div>
                  <button type="button" data-open-job="${job.id}" class="btn btn-sm fw-bold text-white mw-cat-${col} px-3 py-2 flex-shrink-0">
                    Do Task
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('') + `</div>`;

    const howSteps = state.howMode === 'worker'
      ? [
          { num: '01.', title: 'Pick a Micro-Task', desc: 'Filter tasks by category or payout rate and read the exact steps before starting.', cls: 'mw-cat-indigo' },
          { num: '02.', title: 'Submit Text & Screenshot Proof', desc: 'Complete the task on your phone or laptop and attach verification proof.', cls: 'mw-cat-emerald' },
          { num: '03.', title: 'Cash Out or Reinvest', desc: 'Withdraw your Earning Balance via bKash, Nagad, Binance USDT, or PayPal.', cls: 'mw-cat-amber' },
        ]
      : [
          { num: '01.', title: 'Fund Your Deposit Wallet', desc: 'Add funds securely via local mobile wallets, Binance USDT, or PayPal.', cls: 'mw-cat-rose' },
          { num: '02.', title: 'Launch a Targeted Campaign', desc: 'Set step-by-step instructions, worker slots, and reward per completion.', cls: 'mw-cat-indigo' },
          { num: '03.', title: 'Review Real Human Proofs', desc: 'Satisfy accurate submissions to release funds or reject invalid proofs to free slots.', cls: 'mw-cat-emerald' },
        ];

    const gatewaysHtml = (bootstrap.gateways || []).map(function (gw) {
      return `
        <div class="col-sm-6">
          <div class="d-flex align-items-center justify-content-between rounded-3 border border-white border-opacity-25 bg-white bg-opacity-10 px-3 py-3">
            <div>
              <div class="fw-semibold small text-white">${MW.esc(gw.name)}</div>
              <div class="small text-white-50">Min ${MW.money(gw.minAmount, sym)} · Fee ${gw.feePercent}%</div>
            </div>
            <i class="bi bi-wallet2 text-info fs-5"></i>
          </div>
        </div>
      `;
    }).join('');

    const s = bootstrap.settings || {};
    const themeMap = {
      teal: { hex: '#0d9488', textCls: 'text-teal-700' },
      indigo: { hex: '#4f46e5', textCls: 'text-indigo-700' },
      violet: { hex: '#7c3aed', textCls: 'text-violet-700' },
      emerald: { hex: '#059669', textCls: 'text-emerald-700' },
      rose: { hex: '#e11d48', textCls: 'text-rose-700' },
      amber: { hex: '#d97706', textCls: 'text-amber-700' },
      sky: { hex: '#0284c7', textCls: 'text-sky-700' },
    };
    const ac = themeMap[s.accentTheme || 'teal'] || themeMap.teal;
    const logoSafe = MW.safeUrl(s.logoUrl);
    const heroImgSafe = MW.safeUrl(s.heroImageUrl) || '/assets/images/hero_workspace.jpg';
    const headerPages = (bootstrap.pages || []).filter(function (p) { return p.published && p.showInHeader; });
    const footerPages = (bootstrap.pages || []).filter(function (p) { return p.published && p.showInFooter; });
    const visiblePosts = (bootstrap.blogPosts || []).filter(function (p) { return p.published; });

    const blogHtml = visiblePosts.map(function (p) {
      const cov = MW.safeUrl(p.coverImageUrl) || '/assets/images/category_social.jpg';
      return `
        <div class="col-md-4">
          <div class="mw-card overflow-hidden h-100 d-flex flex-column justify-content-between">
            <div>
              <img src="${cov}" alt="${MW.esc(p.title)}" class="w-100 object-fit-cover" style="height:185px;" />
              <div class="p-4">
                <div class="small text-secondary mb-1">
                  <span class="fw-semibold" style="color:${ac.hex};">${MW.esc(p.category)}</span>
                  <span> · ${new Date(p.createdAt).toLocaleDateString()}</span>
                  ${p.featured ? '<span class="text-warning fw-bold"> · Featured</span>' : ''}
                </div>
                <h3 class="h6 fw-bold text-slate-900 mb-2">${MW.esc(p.title)}</h3>
                <p class="small text-secondary mb-0">${MW.esc(p.excerpt)}</p>
              </div>
            </div>
            <div class="px-4 pb-3 pt-2 border-top d-flex justify-content-between align-items-center small">
              <span class="text-secondary">By ${MW.esc(p.authorName)}</span>
              <button type="button" data-open-post="${p.id}" class="btn btn-link btn-sm p-0 fw-bold text-decoration-none" style="color:${ac.hex};">
                Read Guide <i class="bi bi-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    mount.innerHTML = `
      <!-- Top Bar -->
      <nav class="navbar navbar-expand-lg sticky-top bg-white border-bottom py-3">
        <div class="container">
          <a class="navbar-brand font-display fw-bolder d-flex align-items-center gap-2 fs-4" style="color:${ac.hex};" href="#top">
            ${logoSafe
              ? `<img src="${logoSafe}" alt="${MW.esc(s.siteName)}" class="rounded-3 object-fit-cover border" style="width:36px;height:36px;" />`
              : `<span class="d-inline-flex align-items-center justify-content-center rounded-3 text-white" style="width:36px;height:36px;background:${ac.hex};"><i class="bi bi-lightning-charge-fill"></i></span>`}
            <span>${MW.esc(s.siteName)}</span>
          </a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="mainNav">
            <ul class="navbar-nav mx-auto gap-lg-3 fw-medium small">
              <li class="nav-item"><a class="nav-link text-nowrap" href="#jobs">Browse Jobs</a></li>
              <li class="nav-item"><a class="nav-link text-nowrap" href="#categories">Categories</a></li>
              ${s.showBlogSection && visiblePosts.length > 0
                ? `<li class="nav-item"><a class="nav-link text-nowrap" href="#blog">Blog</a></li>`
                : `<li class="nav-item"><a class="nav-link text-nowrap" href="#payments">Payments</a></li>`}
              ${headerPages.slice(0, 2).map(function (pg) {
                return `<li class="nav-item"><button type="button" data-open-page="${pg.id}" class="nav-link btn btn-link text-decoration-none text-nowrap">${MW.esc(pg.title)}</button></li>`;
              }).join('')}
              <li class="nav-item"><button type="button" id="nav-post-job" class="nav-link btn btn-link text-decoration-none text-nowrap">Post a Job</button></li>
            </ul>
            <div class="d-flex align-items-center gap-2">
              ${currentUser
                ? `<button type="button" id="nav-go-dash" class="btn fw-semibold px-4 text-white text-nowrap" style="background:${ac.hex};">${currentUser.role === 'admin' ? 'Admin Console' : 'My Dashboard'}</button>`
                : `<button type="button" id="nav-signin" class="btn fw-semibold px-4 text-white text-nowrap" style="background:${ac.hex};">Sign In</button>`}
            </div>
          </div>
        </div>
      </nav>

      ${s.maintenanceMode ? `
        <div class="bg-warning-subtle border-bottom border-warning text-center py-2 px-3 small fw-semibold text-dark">
          <i class="bi bi-exclamation-triangle-fill text-warning me-1"></i> ${MW.esc(s.maintenanceMessage || 'Scheduled maintenance is active.')}
        </div>
      ` : ''}

      <!-- Hero Section -->
      <section id="top" class="border-bottom" style="background: linear-gradient(135deg, #f0fdfa 0%, #ffffff 55%, #fff7ed 100%);">
        <div class="container py-5">
          <div class="row g-5 align-items-stretch">
            <div class="col-lg-6 d-flex flex-column justify-content-center">
              <p class="small fw-bold mb-2" style="color:${ac.hex};">${MW.esc(s.heroKicker || 'Human-Verified Micro-Jobs · Instant Proofs · Multi-Gateway Payouts')}</p>
              <h1 class="display-5 fw-bolder text-slate-900 lh-sm mb-3">${MW.esc(s.heroTitle || 'Complete small digital tasks daily or launch real-human campaigns.')}</h1>
              <p class="lead fs-6 text-secondary mb-4">${MW.esc(s.heroSubtitle || 'Workers earn steady payouts for social engagement, app testing, and web research. Employers pay only for approved proofs—never bots.')}</p>
              <div class="d-flex flex-wrap gap-3">
                <button type="button" id="hero-start-btn" class="btn btn-lg fw-bold px-4 fs-6 text-white" style="background:${ac.hex};">
                  ${MW.esc(s.heroPrimaryCta || 'Start Earning Free')} <i class="bi bi-arrow-right ms-1"></i>
                </button>
                <a href="#jobs" class="btn btn-outline-secondary btn-lg fw-semibold px-4 fs-6 bg-white">${MW.esc(s.heroSecondaryCta || 'Explore Live Tasks')}</a>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="position-relative h-100 rounded-4 overflow-hidden shadow-lg border" style="min-height:300px;">
                <img src="${heroImgSafe}" alt="Freelancer workspace" class="w-100 h-100 object-fit-cover" />
                <div class="position-absolute bottom-0 start-0 end-0 m-3 rounded-3 bg-white bg-opacity-95 p-3 d-flex justify-content-between align-items-center shadow-sm small">
                  <span class="fw-medium text-dark">${MW.esc(s.tagline || 'Fast bKash, Nagad, Binance USDT & PayPal payouts')}</span>
                  <span class="font-mono fw-bold text-success">${s.referralCommissionPercent}% Referral Bonus</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        ${s.showStatsStrip !== false ? `
          <div class="bg-white border-top">
            <div class="container">
              <div class="row text-start">
                <div class="col-6 col-md-3 py-3 border-end">
                  <div class="small text-secondary">Active Campaigns</div>
                  <div class="font-mono fs-4 fw-bold" style="color:${ac.hex};">${bootstrap.stats.activeJobsCount}</div>
                </div>
                <div class="col-6 col-md-3 py-3 border-end">
                  <div class="small text-secondary">Registered Members</div>
                  <div class="font-mono fs-4 fw-bold text-success">${bootstrap.stats.totalWorkersCount + 1420}</div>
                </div>
                <div class="col-6 col-md-3 py-3 border-end">
                  <div class="small text-secondary">Verified Tasks Paid</div>
                  <div class="font-mono fs-4 fw-bold text-warning">${bootstrap.stats.totalTasksPaid + 8640}</div>
                </div>
                <div class="col-6 col-md-3 py-3">
                  <div class="small text-secondary">Minimum Withdraw</div>
                  <div class="font-mono fs-4 fw-bold text-danger">${MW.money(s.minWithdrawAmount || 2, sym)}</div>
                </div>
              </div>
            </div>
          </div>
        ` : ''}
      </section>

      <!-- Categories -->
      <section id="categories" class="container py-5">
        <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
          <div>
            <h2 class="h3 fw-bold mb-1">Task Categories</h2>
            <p class="small text-secondary mb-0">Select any category to filter open micro-jobs ready for immediate submission.</p>
          </div>
          <button type="button" data-cat-filter="all" class="btn btn-link btn-sm fw-bold text-decoration-none">View All Categories</button>
        </div>
        <div class="row g-3">${catCardsHtml}</div>
      </section>

      <!-- Live Micro-Jobs Board -->
      <section id="jobs" class="bg-white border-top border-bottom py-5">
        <div class="container">
          <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
            <div>
              <h2 class="h3 fw-bold mb-1">Live Micro-Jobs Board</h2>
              <p class="small text-secondary mb-0">Pick any task, follow instructions carefully, and upload proof to earn.</p>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <div class="input-group" style="width: 240px;">
                <span class="input-group-text bg-light"><i class="bi bi-search"></i></span>
                <input type="text" id="mp-search" class="form-control form-control-sm" value="${MW.esc(state.search)}" placeholder="Search tasks..." />
              </div>
              <select id="mp-sort" class="form-select form-select-sm" style="width: 170px;">
                <option value="featured" ${state.sortBy === 'featured' ? 'selected' : ''}>Featured First</option>
                <option value="highest" ${state.sortBy === 'highest' ? 'selected' : ''}>Highest Reward</option>
                <option value="slots" ${state.sortBy === 'slots' ? 'selected' : ''}>Most Slots Open</option>
              </select>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-2 p-2 bg-light rounded-3 mb-4">${filterBtnsHtml}</div>
          ${jobsHtml}
        </div>
      </section>

      ${s.showHowItWorks !== false ? `
        <section id="how-it-works" class="container py-5">
          <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
            <div>
              <h2 class="h3 fw-bold mb-1">How ${MW.esc(s.siteName)} Works</h2>
              <p class="small text-secondary mb-0">One unified account lets you earn as a worker and launch campaigns as an employer.</p>
            </div>
            <div class="btn-group bg-light p-1 rounded-3">
              <button type="button" data-how-mode="worker" class="btn btn-sm fw-bold ${state.howMode === 'worker' ? 'btn-primary' : 'btn-light'}">For Workers</button>
              <button type="button" data-how-mode="employer" class="btn btn-sm fw-bold ${state.howMode === 'employer' ? 'btn-warning text-white' : 'btn-light'}">For Employers</button>
            </div>
          </div>

          <div class="row g-4">
            <div class="col-lg-5 d-flex flex-column gap-3">
              ${howSteps.map(function (st) {
                return `
                  <div class="mw-card p-4 d-flex gap-3">
                    <div class="${st.cls} rounded-3 d-flex align-items-center justify-content-center font-mono fw-bold flex-shrink-0" style="width:42px;height:42px;">${st.num}</div>
                    <div>
                      <h3 class="h6 fw-bold mb-1">${st.title}</h3>
                      <p class="small text-secondary mb-0">${st.desc}</p>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            <div class="col-lg-7">
              <div class="row g-3 h-100">
                <div class="col-sm-6">
                  <div class="mw-card overflow-hidden h-100">
                    <img src="/assets/images/category_social.jpg" alt="Social media engagement" class="w-100 object-fit-cover" style="height:190px;" />
                    <div class="p-4">
                      <h3 class="h6 fw-bold mb-1">Organic Social &amp; Video</h3>
                      <p class="small text-secondary mb-0">Real members watch videos, follow pages, and write authentic comments with proof.</p>
                    </div>
                  </div>
                </div>
                <div class="col-sm-6">
                  <div class="mw-card overflow-hidden h-100">
                    <img src="/assets/images/category_apps.jpg" alt="App testing tasks" class="w-100 object-fit-cover" style="height:190px;" />
                    <div class="p-4">
                      <h3 class="h6 fw-bold mb-1">App Testing &amp; UX Research</h3>
                      <p class="small text-secondary mb-0">Gather real device screenshots, onboarding feedback, and survey responses.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ` : ''}

      ${s.showBlogSection !== false && visiblePosts.length > 0 ? `
        <section id="blog" class="bg-white border-top py-5">
          <div class="container">
            <div class="mb-4">
              <h2 class="h3 fw-bold mb-1">Guides &amp; Platform Updates</h2>
              <p class="small text-secondary mb-0">Tips for maximizing daily task payouts and running high-conversion campaigns.</p>
            </div>
            <div class="row g-4">${blogHtml}</div>
          </div>
        </section>
      ` : ''}

      <!-- Gateways & Trust -->
      <section id="payments" class="py-5 text-white" style="background: linear-gradient(135deg, #0f172a 0%, #134e4a 55%, #0f172a 100%);">
        <div class="container">
          <div class="row g-4 align-items-center">
            <div class="col-lg-7">
              <h2 class="h3 fw-bold mb-2">Flexible Local &amp; Global Payment Gateways</h2>
              <p class="small text-white-50 mb-4">Deposit campaign funds or cash out daily earnings through trusted mobile banking and digital wallets.</p>
              <div class="row g-3">${gatewaysHtml}</div>
            </div>
            <div class="col-lg-5">
              <div class="rounded-4 border border-white border-opacity-25 bg-white bg-opacity-10 p-4">
                <div class="d-flex align-items-center gap-3 mb-3">
                  <img src="/assets/images/avatar_founder.jpg" alt="Operations Lead" class="rounded-circle object-fit-cover" style="width:54px;height:54px;" />
                  <div>
                    <div class="fw-bold">${MW.esc(s.founderName || 'Tariq Ahmed')}</div>
                    <div class="small text-white-50">${MW.esc(s.founderRole || 'Marketplace Operations · Dhaka & Global')}</div>
                  </div>
                </div>
                <p class="small text-white-75 mb-4">“${MW.esc(s.founderQuote || 'Every campaign budget is held safely until employers review worker screenshots, and our support team resolves disputes within 24 hours.')}”</p>
                <button type="button" id="footer-cta-btn" class="btn btn-success fw-bold px-4">Create Free Account</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer class="bg-white border-top py-4">
        <div class="container d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3 small text-secondary">
          <div><strong class="text-dark">${MW.esc(s.siteName)}</strong> · ${MW.esc(s.footerText || ('© ' + new Date().getFullYear() + ' All rights reserved.'))}</div>
          <div class="d-flex flex-wrap align-items-center gap-4">
            ${footerPages.map(function (pg) {
              return `<button type="button" data-open-page="${pg.id}" class="btn btn-link btn-sm p-0 text-secondary text-decoration-none">${MW.esc(pg.title)}</button>`;
            }).join('')}
            <button type="button" id="footer-admin-btn" class="btn btn-link btn-sm p-0 text-decoration-none fw-semibold" style="color:${ac.hex};">Admin Login</button>
            <span>Support: ${MW.esc(s.supportEmail)}</span>
          </div>
        </div>
      </footer>
    `;

    // Bind events
    const navSignIn = document.getElementById('nav-signin');
    if (navSignIn) navSignIn.onclick = function () { MW.openAuthModal('login'); };

    const navDash = document.getElementById('nav-go-dash');
    if (navDash) navDash.onclick = function () { MW.openWorkspace(); };

    const navPost = document.getElementById('nav-post-job');
    if (navPost) navPost.onclick = function () {
      if (MW.getCurrentUser()) MW.openWorkspace('post-job');
      else MW.openAuthModal('register');
    };

    const heroStart = document.getElementById('hero-start-btn');
    if (heroStart) heroStart.onclick = function () {
      if (MW.getCurrentUser()) MW.openWorkspace('find-jobs');
      else MW.openAuthModal('register');
    };

    const ctaBtn = document.getElementById('footer-cta-btn');
    if (ctaBtn) ctaBtn.onclick = function () {
      if (MW.getCurrentUser()) MW.openWorkspace();
      else MW.openAuthModal('register');
    };

    const adminBtn = document.getElementById('footer-admin-btn');
    if (adminBtn) adminBtn.onclick = function () { MW.openAuthModal('admin'); };

    mount.querySelectorAll('[data-open-post]').forEach(function (btn) {
      btn.onclick = function () {
        const pid = Number(btn.getAttribute('data-open-post'));
        const post = visiblePosts.find(function (x) { return Number(x.id) === pid; });
        if (!post) return;
        const cov = MW.safeUrl(post.coverImageUrl);
        const covEl = document.getElementById('cms-cover');
        if (cov) {
          covEl.src = cov;
          covEl.classList.remove('d-none');
        } else {
          covEl.classList.add('d-none');
        }
        document.getElementById('cms-meta').textContent = `${post.category} · By ${post.authorName} · ${new Date(post.createdAt).toLocaleDateString()}`;
        document.getElementById('cms-title').textContent = post.title;
        document.getElementById('cms-body').textContent = post.content;
        bootstrapModal(document.getElementById('cmsReaderModal')).show();
      };
    });

    mount.querySelectorAll('[data-open-page]').forEach(function (btn) {
      btn.onclick = function () {
        const pgId = Number(btn.getAttribute('data-open-page'));
        const page = (bootstrap.pages || []).find(function (x) { return Number(x.id) === pgId; });
        if (!page) return;
        document.getElementById('cms-cover').classList.add('d-none');
        document.getElementById('cms-meta').textContent = '/' + page.slug;
        document.getElementById('cms-title').textContent = page.title;
        document.getElementById('cms-body').textContent = page.content;
        bootstrapModal(document.getElementById('cmsReaderModal')).show();
      };
    });

    const searchInput = document.getElementById('mp-search');
    if (searchInput) {
      searchInput.oninput = function (e) {
        state.search = e.target.value;
        MW.renderMarketplace(bootstrap, currentUser);
        const refocused = document.getElementById('mp-search');
        if (refocused) {
          refocused.focus();
          refocused.setSelectionRange(state.search.length, state.search.length);
        }
      };
    }

    const sortSel = document.getElementById('mp-sort');
    if (sortSel) {
      sortSel.onchange = function (e) {
        state.sortBy = e.target.value;
        MW.renderMarketplace(bootstrap, currentUser);
      };
    }

    const resetBtn = document.getElementById('mp-reset-filters');
    if (resetBtn) resetBtn.onclick = function () {
      state.search = '';
      state.categoryId = 'all';
      MW.renderMarketplace(bootstrap, currentUser);
    };

    mount.querySelectorAll('[data-cat-pick]').forEach(function (btn) {
      btn.onclick = function () {
        const cid = btn.getAttribute('data-cat-pick');
        state.categoryId = Number(state.categoryId) === Number(cid) ? 'all' : Number(cid);
        MW.renderMarketplace(bootstrap, currentUser);
        document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth' });
      };
    });

    mount.querySelectorAll('[data-cat-filter]').forEach(function (btn) {
      btn.onclick = function () {
        const cid = btn.getAttribute('data-cat-filter');
        state.categoryId = cid === 'all' ? 'all' : Number(cid);
        MW.renderMarketplace(bootstrap, currentUser);
      };
    });

    mount.querySelectorAll('[data-how-mode]').forEach(function (btn) {
      btn.onclick = function () {
        state.howMode = btn.getAttribute('data-how-mode');
        MW.renderMarketplace(bootstrap, currentUser);
      };
    });

    mount.querySelectorAll('[data-open-job]').forEach(function (btn) {
      btn.onclick = function () {
        const jid = Number(btn.getAttribute('data-open-job'));
        const found = (bootstrap.jobs || []).find(function (j) { return Number(j.id) === jid; });
        if (found) MW.openTaskModal(found);
      };
    });
  };

  MW.openTaskModal = function (job) {
    const bootstrap = MW.getBootstrap();
    const user = MW.getCurrentUser();
    const sym = bootstrap.settings.currencySymbol || '$';
    state.activeJob = job;
    state.shotBase64 = '';

    document.getElementById('tm-meta').textContent = `${job.categoryName} · ${job.targetRegion} · ~${job.estimatedMinutes} min`;
    document.getElementById('tm-title').textContent = job.title;
    document.getElementById('tm-reward').textContent = MW.reward(job.rewardPerWorker, sym);
    document.getElementById('tm-slots').textContent = `${job.workersCompleted} / ${job.workersNeeded}`;
    const pct = Math.min(100, Math.round((job.workersCompleted / Math.max(1, job.workersNeeded)) * 100));
    document.getElementById('tm-progress').style.width = pct + '%';

    const urlBtn = document.getElementById('tm-url');
    const safeLink = MW.safeUrl(job.targetUrl);
    if (safeLink) {
      urlBtn.href = safeLink;
      urlBtn.classList.remove('d-none');
    } else {
      urlBtn.classList.add('d-none');
    }

    const stepsList = document.getElementById('tm-steps');
    stepsList.innerHTML = (job.steps || []).map(function (st) {
      return `<li class="list-group-item small">${MW.esc(st)}</li>`;
    }).join('');

    document.getElementById('tm-proof-req').textContent = job.proofRequirement;
    document.getElementById('tm-shot-req').textContent = job.requireScreenshot ? '(Required)' : '(Optional)';
    document.getElementById('tm-proof-text').value = '';
    document.getElementById('tm-proof-file').value = '';
    document.getElementById('tm-shot-preview').classList.add('d-none');
    document.getElementById('tm-alert').classList.add('d-none');
    document.getElementById('tm-submit-btn').textContent = user ? 'Submit Task Proof' : 'Sign In to Submit';

    const modalEl = document.getElementById('taskModal');
    const modal = bootstrapModal(modalEl);
    modal.show();
  };

  function bootstrapModal(el) {
    return window.bootstrap.Modal.getOrCreateInstance(el);
  }

  MW.initModals = function () {
    const fileInput = document.getElementById('tm-proof-file');
    if (fileInput) {
      fileInput.onchange = async function (e) {
        const f = e.target.files[0];
        if (!f) return;
        try {
          state.shotBase64 = await MW.fileToBase64(f);
          const prev = document.getElementById('tm-shot-preview');
          prev.src = state.shotBase64;
          prev.classList.remove('d-none');
        } catch (err) {
          const al = document.getElementById('tm-alert');
          al.className = 'alert alert-danger small';
          al.textContent = err.message;
        }
      };
    }

    const tmForm = document.getElementById('tm-form');
    if (tmForm) {
      tmForm.onsubmit = async function (e) {
        e.preventDefault();
        const user = MW.getCurrentUser();
        if (!user) {
          bootstrapModal(document.getElementById('taskModal')).hide();
          MW.openAuthModal('login');
          return;
        }
        const al = document.getElementById('tm-alert');
        al.classList.add('d-none');
        try {
          await MW.api('/jobs/' + state.activeJob.id + '/proofs', {
            method: 'POST',
            body: JSON.stringify({
              proofText: document.getElementById('tm-proof-text').value,
              screenshotData: state.shotBase64,
            }),
          });
          al.className = 'alert alert-success small';
          al.textContent = 'Proof submitted! Employer review will credit your Earning Balance.';
          await MW.refreshBootstrap();
          setTimeout(function () {
            bootstrapModal(document.getElementById('taskModal')).hide();
          }, 1200);
        } catch (err) {
          al.className = 'alert alert-danger small';
          al.textContent = err.message;
        }
      };
    }

    let currentAuthTab = 'login';
    let adminStatus = { claimed: true, hasEnvPasscode: false };

    function syncAuthTabUI() {
      const bootstrap = MW.getBootstrap();
      const siteName = (bootstrap && bootstrap.settings && bootstrap.settings.siteName) || 'MiniWorkers';
      const isLogin = currentAuthTab === 'login';
      const isRegister = currentAuthTab === 'register';
      const isAdmin = currentAuthTab === 'admin';

      const brandEl = document.getElementById('auth-brand-title');
      if (brandEl) brandEl.textContent = siteName;

      document.getElementById('auth-tabs-bar').classList.toggle('d-none', isAdmin);
      document.getElementById('auth-admin-header').classList.toggle('d-none', !isAdmin);

      const tabLoginBtn = document.getElementById('auth-tab-login');
      const tabRegBtn = document.getElementById('auth-tab-register');
      if (tabLoginBtn && tabRegBtn) {
        tabLoginBtn.className = 'btn btn-sm fw-bold ' + (isLogin ? 'bg-white shadow-xs text-teal-700' : 'text-secondary');
        tabRegBtn.className = 'btn btn-sm fw-bold ' + (isRegister ? 'bg-white shadow-xs text-teal-700' : 'text-secondary');
      }

      document.getElementById('auth-login-fields').classList.toggle('d-none', !isLogin);
      document.getElementById('auth-register-fields').classList.toggle('d-none', !isRegister);
      document.getElementById('auth-admin-fields').classList.toggle('d-none', !isAdmin);
      document.getElementById('auth-admin-name-wrap').classList.toggle('d-none', !(isAdmin && !adminStatus.claimed && !adminStatus.hasEnvPasscode));
      document.getElementById('auth-email-wrap').classList.toggle('d-none', !(isAdmin && !adminStatus.hasEnvPasscode));
      document.getElementById('auth-confirm-wrap').classList.toggle('d-none', !isRegister);
      document.getElementById('auth-pass-col').className = isRegister ? 'col-sm-6' : 'col-12';
      document.getElementById('auth-reg-extra').classList.toggle('d-none', !isRegister);
      document.getElementById('auth-demo-wrap').classList.toggle('d-none', !isLogin);
      document.getElementById('auth-admin-hint').classList.toggle('d-none', !(isAdmin && !adminStatus.claimed && !adminStatus.hasEnvPasscode));

      document.getElementById('auth-identifier').required = isLogin;
      document.getElementById('auth-name').required = isRegister;
      document.getElementById('auth-username').required = isRegister;
      document.getElementById('auth-reg-email').required = isRegister;
      document.getElementById('auth-pass-confirm').required = isRegister;
      document.getElementById('auth-email').required = isAdmin && !adminStatus.hasEnvPasscode;

      const passLabel = document.getElementById('auth-pass-label');
      if (passLabel) {
        passLabel.textContent = (isAdmin && adminStatus.hasEnvPasscode) ? 'Admin Passcode' : 'Password';
      }

      const btn = document.getElementById('auth-submit-btn');
      btn.textContent = isRegister
        ? 'Create Free Account'
        : isLogin
          ? 'Sign In to Workspace'
          : (!adminStatus.claimed && !adminStatus.hasEnvPasscode ? 'Claim & Open Admin' : 'Admin Sign In');

      document.getElementById('auth-switch-prefix').textContent = isRegister ? 'Already registered?' : ('New to ' + siteName + '?');
      document.getElementById('auth-switch-btn').textContent = isRegister ? 'Sign In Here' : 'Register Free';
      document.getElementById('auth-admin-toggle').classList.toggle('d-none', isAdmin);
    }

    MW.openAuthModal = async function (tab) {
      currentAuthTab = tab || 'login';
      document.getElementById('auth-error').classList.add('d-none');
      try {
        adminStatus = await MW.api('/auth/admin-status');
      } catch (_e) {}
      syncAuthTabUI();
      bootstrapModal(document.getElementById('authModal')).show();
    };

    const tabLoginBtn = document.getElementById('auth-tab-login');
    if (tabLoginBtn) tabLoginBtn.onclick = function () { currentAuthTab = 'login'; document.getElementById('auth-error').classList.add('d-none'); syncAuthTabUI(); };
    const tabRegBtn = document.getElementById('auth-tab-register');
    if (tabRegBtn) tabRegBtn.onclick = function () { currentAuthTab = 'register'; document.getElementById('auth-error').classList.add('d-none'); syncAuthTabUI(); };
    const backMemberBtn = document.getElementById('auth-back-member');
    if (backMemberBtn) backMemberBtn.onclick = function () { currentAuthTab = 'login'; document.getElementById('auth-error').classList.add('d-none'); syncAuthTabUI(); };

    const passToggle = document.getElementById('auth-pass-toggle');
    if (passToggle) {
      passToggle.onclick = function () {
        const passInput = document.getElementById('auth-pass');
        const showing = passInput.type === 'text';
        passInput.type = showing ? 'password' : 'text';
        passToggle.innerHTML = showing ? '<i class="bi bi-eye-slash-fill"></i>' : '<i class="bi bi-eye-fill"></i>';
      };
    }

    const switchBtn = document.getElementById('auth-switch-btn');
    if (switchBtn) {
      switchBtn.onclick = function () {
        currentAuthTab = currentAuthTab === 'register' ? 'login' : 'register';
        document.getElementById('auth-error').classList.add('d-none');
        syncAuthTabUI();
      };
    }

    const adminToggle = document.getElementById('auth-admin-toggle');
    if (adminToggle) {
      adminToggle.onclick = function () {
        currentAuthTab = 'admin';
        document.getElementById('auth-error').classList.add('d-none');
        syncAuthTabUI();
      };
    }

    const demoBtn = document.getElementById('auth-demo-btn');
    if (demoBtn) {
      demoBtn.onclick = function () {
        document.getElementById('auth-identifier').value = 'arif@demo.com';
        document.getElementById('auth-pass').value = 'worker123';
      };
    }

    const authForm = document.getElementById('auth-form');
    if (authForm) {
      authForm.onsubmit = async function (e) {
        e.preventDefault();
        const errBox = document.getElementById('auth-error');
        errBox.classList.add('d-none');
        const password = document.getElementById('auth-pass').value;

        try {
          let res;
          if (currentAuthTab === 'login') {
            const identifier = document.getElementById('auth-identifier').value;
            res = await MW.api('/auth/login', {
              method: 'POST',
              body: JSON.stringify({ identifier: identifier, email: identifier, phone: identifier, password: password }),
            });
          } else if (currentAuthTab === 'register') {
            const confirmPass = document.getElementById('auth-pass-confirm').value;
            if (password !== confirmPass) {
              throw new Error('Passwords do not match.');
            }
            if (!document.getElementById('auth-terms').checked) {
              throw new Error('Please agree to the Marketplace Terms & Fair-Use Rules.');
            }
            res = await MW.api('/auth/register', {
              method: 'POST',
              body: JSON.stringify({
                name: document.getElementById('auth-name').value,
                username: document.getElementById('auth-username').value,
                email: document.getElementById('auth-reg-email').value,
                country: document.getElementById('auth-country').value,
                phone: document.getElementById('auth-phone').value,
                password: password,
                referralCode: document.getElementById('auth-ref').value,
              }),
            });
          } else {
            const email = document.getElementById('auth-email').value;
            const adminName = document.getElementById('auth-admin-name').value;
            if (!adminStatus.claimed || adminStatus.hasEnvPasscode) {
              res = await MW.api('/auth/claim-admin', {
                method: 'POST',
                body: JSON.stringify({ name: adminName || 'Platform Admin', email: email || 'admin@miniworkers.local', password: password }),
              });
            } else {
              res = await MW.api('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: email, identifier: email, password: password }),
              });
              if (res.user.role !== 'admin') throw new Error('This account does not have Administrator access.');
            }
          }
          MW.setToken(res.token);
          bootstrapModal(document.getElementById('authModal')).hide();
          MW.onAuthSuccess(res.user);
        } catch (err) {
          errBox.textContent = err.message;
          errBox.classList.remove('d-none');
        }
      };
    }
  };
})(window.MW);

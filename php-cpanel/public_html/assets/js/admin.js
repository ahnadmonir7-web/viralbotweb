/**
 * MiniWorkers Full Admin & Website Control Panel (Vanilla JS + Bootstrap 5 + Tailwind + PHP/MySQL API)
 */
window.MW = window.MW || {};

(function (MW) {
  let aState = {
    tab: 'overview',
    msg: null,
    overview: null,
    jobs: [],
    categories: [],
    deposits: [],
    withdrawals: [],
    users: [],
    gateways: [],
    tickets: [],
    blogPosts: [],
    pages: [],
    logs: [],
    settings: null,
    userSearch: '',
    depFilter: 'all',
    wdFilter: 'all',
    editingJobId: null,
    editingCatId: null,
    editingGwId: null,
    editingUserId: null,
    editingUserActivity: null,
    confirmDeleteUserId: null,
    editingPostId: null,
    editingPageId: null,
    showJobForm: false,
    showUserForm: false,
  };

  MW.loadAdminData = async function () {
    const [ov, jb, ct, dp, wd, us, gw, tk, st, bl, pg, lg] = await Promise.all([
      MW.api('/admin/overview'),
      MW.api('/admin/jobs'),
      MW.api('/admin/categories'),
      MW.api('/admin/deposits'),
      MW.api('/admin/withdrawals'),
      MW.api('/admin/users'),
      MW.api('/admin/gateways'),
      MW.api('/admin/tickets'),
      MW.api('/admin/settings'),
      MW.api('/admin/blog'),
      MW.api('/admin/pages'),
      MW.api('/admin/activity'),
    ]);
    aState.overview = ov;
    aState.jobs = jb.jobs || [];
    aState.categories = ct.categories || [];
    aState.deposits = dp.deposits || [];
    aState.withdrawals = wd.withdrawals || [];
    aState.users = us.users || [];
    aState.gateways = gw.gateways || [];
    aState.tickets = tk.tickets || [];
    aState.settings = st.settings;
    aState.blogPosts = bl.posts || [];
    aState.pages = pg.pages || [];
    aState.logs = lg.logs || [];
  };

  function setMsg(type, text) {
    aState.msg = { type: type, text: text };
  }

  MW.renderAdmin = function () {
    const mount = document.getElementById('view-admin');
    const admin = MW.getCurrentUser();
    const bootstrap = MW.getBootstrap();
    if (!mount || !admin || !bootstrap) return;
    const settings = aState.settings || bootstrap.settings;
    const sym = settings.currencySymbol || '$';

    const navGroups = [
      {
        title: 'Operations',
        items: [
          { id: 'overview', label: 'Overview', icon: 'bi-speedometer2' },
          { id: 'jobs', label: 'Manage Jobs', icon: 'bi-briefcase', badge: aState.overview?.pendingJobs },
          { id: 'categories', label: 'Categories', icon: 'bi-layers' },
          { id: 'users', label: 'Users & KYC', icon: 'bi-people' },
          { id: 'tickets', label: 'Support Tickets', icon: 'bi-life-preserver', badge: aState.overview?.openTickets },
        ],
      },
      {
        title: 'Finance & Gateways',
        items: [
          { id: 'deposits', label: 'Deposits & Credit', icon: 'bi-wallet2', badge: aState.overview?.pendingDeposits },
          { id: 'withdrawals', label: 'Payouts & Withdraw', icon: 'bi-credit-card', badge: aState.overview?.pendingWithdrawals },
          { id: 'gateways', label: 'Payment Methods', icon: 'bi-bank' },
        ],
      },
      {
        title: 'Website & CMS Control',
        items: [
          { id: 'branding', label: 'Website & Logo', icon: 'bi-palette' },
          { id: 'homepage', label: 'Home Page Builder', icon: 'bi-layout-text-window' },
          { id: 'blog', label: 'Blog Manager', icon: 'bi-journal-richtext' },
          { id: 'pages', label: 'All Pages CMS', icon: 'bi-file-earmark-text' },
          { id: 'settings', label: 'System Controls', icon: 'bi-sliders' },
        ],
      },
    ];

    const allNavItems = navGroups.flatMap(function (g) { return g.items; });
    const sidebarHtml = navGroups.map(function (grp) {
      return `<div class="mb-3">
        <div class="px-3 mb-1 text-uppercase fw-bold text-secondary" style="font-size:10px;letter-spacing:0.06em;">${grp.title}</div>
        ${grp.items.map(function (it) {
          const act = aState.tab === it.id;
          return `<button type="button" data-atab="${it.id}" class="mw-sidebar-btn ${act ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}">
            <span><i class="bi ${it.icon} me-2"></i>${it.label}</span>
            ${it.badge ? `<span class="badge bg-danger font-mono">${it.badge}</span>` : ''}
          </button>`;
        }).join('')}
      </div>`;
    }).join('');

    const mobileTabsHtml = allNavItems.map(function (it) {
      const act = aState.tab === it.id;
      return `<button type="button" data-atab="${it.id}" class="btn btn-sm text-nowrap ${act ? 'btn-success' : 'btn-outline-light'}">${it.label}</button>`;
    }).join('');

    const alertHtml = aState.msg
      ? `<div class="alert alert-${aState.msg.type === 'ok' ? 'success' : 'danger'} d-flex justify-content-between align-items-center small">
          <span>${MW.esc(aState.msg.text)}</span>
          <button type="button" id="a-close-msg" class="btn-close btn-sm"></button>
        </div>`
      : '';

    let bodyHtml = '';

    if (aState.tab === 'overview' && aState.overview) {
      const ov = aState.overview;
      bodyHtml = `
        <div class="row g-3 mb-4">
          <div class="col-sm-6 col-lg-3"><div class="mw-card p-4"><div class="small text-secondary fw-semibold">Registered Users</div><div class="font-mono fs-2 fw-bold text-teal-700 mt-1">${ov.totalUsers}</div></div></div>
          <div class="col-sm-6 col-lg-3"><div class="mw-card p-4"><div class="small text-secondary fw-semibold">Active / Pending Jobs</div><div class="font-mono fs-2 fw-bold text-primary mt-1">${ov.activeJobs || 0} <span class="fs-6 text-warning">(${ov.pendingJobs} pending)</span></div></div></div>
          <div class="col-sm-6 col-lg-3"><div class="mw-card p-4"><div class="small text-secondary fw-semibold">Approved Deposits</div><div class="font-mono fs-4 fw-bold text-success mt-1">${MW.money(ov.approvedDepositsTotal || 0, sym)}</div><div class="small text-secondary">${ov.pendingDeposits} pending (${MW.money(ov.pendingDepositsAmount, sym)})</div></div></div>
          <div class="col-sm-6 col-lg-3"><div class="mw-card p-4"><div class="small text-secondary fw-semibold">Platform Fee Revenue</div><div class="font-mono fs-4 fw-bold text-info mt-1">${MW.money(ov.platformRevenue, sym)}</div><div class="small text-secondary">Paid Out: ${MW.money(ov.approvedWithdrawalsTotal || 0, sym)}</div></div></div>
        </div>
        <div class="row g-3 mb-4">
          <div class="col-md-6"><div class="mw-card p-4"><div class="small text-secondary">Total Worker Earning Liabilities</div><div class="font-mono fs-4 fw-bold text-dark">${MW.money(ov.totalEarningLiability || 0, sym)}</div></div></div>
          <div class="col-md-6"><div class="mw-card p-4"><div class="small text-secondary">Total Advertiser Deposit Balances</div><div class="font-mono fs-4 fw-bold text-dark">${MW.money(ov.totalDepositLiability || 0, sym)}</div></div></div>
        </div>
        <div class="mw-card p-4">
          <h6 class="fw-bold mb-3">Recent Admin Audit Log</h6>
          <div class="list-group list-group-flush">
            ${aState.logs.slice(0, 8).map(function (lg) {
              return `<div class="list-group-item px-0 py-2 d-flex justify-content-between align-items-center small">
                <div><strong>${MW.esc(lg.action)}</strong> — <span class="text-secondary">${MW.esc(lg.details)}</span></div>
                <span class="font-mono text-secondary text-nowrap ms-2">${new Date(lg.createdAt).toLocaleString()}</span>
              </div>`;
            }).join('') || '<div class="small text-secondary">No admin activity logged yet.</div>'}
          </div>
        </div>
      `;
    } else if (aState.tab === 'jobs') {
      const edJob = aState.editingJobId ? aState.jobs.find(function (j) { return Number(j.id) === Number(aState.editingJobId); }) : null;
      const showForm = aState.showJobForm || Boolean(edJob);
      bodyHtml = `
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div class="fw-bold">Campaigns &amp; Official Jobs (${aState.jobs.length})</div>
          <button type="button" id="a-new-job-btn" class="btn btn-sm btn-primary fw-bold">${showForm && !edJob ? 'Close Form' : '+ Create Official Job'}</button>
        </div>
        ${showForm ? `
          <div class="mw-card p-4 mb-4">
            <h6 class="fw-bold mb-3">${edJob ? 'Edit Campaign #' + edJob.id : 'Publish Official Micro-Job'}</h6>
            <form id="a-job-form" class="row g-3">
              <div class="col-md-6"><label class="form-label small fw-semibold">Job Title</label><input id="aj-title" required class="form-control" value="${MW.esc(edJob ? edJob.title : '')}" /></div>
              <div class="col-md-3"><label class="form-label small fw-semibold">Category</label><select id="aj-cat" class="form-select">${aState.categories.map(function (c) { return `<option value="${c.id}" ${edJob && Number(edJob.categoryId) === Number(c.id) ? 'selected' : ''}>${MW.esc(c.name)}</option>`; }).join('')}</select></div>
              <div class="col-md-3"><label class="form-label small fw-semibold">Target Region</label><input id="aj-region" class="form-control" value="${MW.esc(edJob ? edJob.targetRegion : 'Worldwide')}" /></div>
              <div class="col-md-4"><label class="form-label small fw-semibold">Target URL</label><input id="aj-url" class="form-control" value="${MW.esc(edJob ? edJob.targetUrl : '')}" placeholder="https://..." /></div>
              <div class="col-md-2"><label class="form-label small fw-semibold">Reward (${sym})</label><input id="aj-rew" type="number" step="0.01" required class="form-control font-mono" value="${edJob ? edJob.rewardPerWorker : '0.15'}" /></div>
              <div class="col-md-2"><label class="form-label small fw-semibold">Workers</label><input id="aj-wrk" type="number" required class="form-control font-mono" value="${edJob ? edJob.workersNeeded : '50'}" /></div>
              <div class="col-md-2"><label class="form-label small fw-semibold">Est. Min</label><input id="aj-min" type="number" class="form-control font-mono" value="${edJob ? edJob.estimatedMinutes : '3'}" /></div>
              <div class="col-md-2"><label class="form-label small fw-semibold">Status</label><select id="aj-stat" class="form-select"><option value="active" ${!edJob || edJob.status === 'active' ? 'selected' : ''}>Active</option><option value="paused" ${edJob && edJob.status === 'paused' ? 'selected' : ''}>Paused</option><option value="pending" ${edJob && edJob.status === 'pending' ? 'selected' : ''}>Pending</option></select></div>
              <div class="col-md-6"><label class="form-label small fw-semibold">Steps (One per line)</label><textarea id="aj-steps" rows="3" class="form-control">${MW.esc(edJob ? (edJob.steps || []).join('\n') : 'Open target link\nComplete action\nCapture screenshot')}</textarea></div>
              <div class="col-md-6"><label class="form-label small fw-semibold">Proof Requirement</label><textarea id="aj-proof" rows="3" required class="form-control">${MW.esc(edJob ? edJob.proofRequirement : 'Submit username and screenshot proof.')}</textarea></div>
              <div class="col-12 d-flex gap-3 align-items-center">
                <div class="form-check"><input type="checkbox" id="aj-shot" class="form-check-input" ${!edJob || edJob.requireScreenshot ? 'checked' : ''} /><label class="form-check-label small" for="aj-shot">Require Screenshot</label></div>
                <div class="form-check"><input type="checkbox" id="aj-feat" class="form-check-input" ${edJob && edJob.featured ? 'checked' : ''} /><label class="form-check-label small" for="aj-feat">Featured Campaign</label></div>
                <button type="submit" class="btn btn-primary btn-sm fw-bold ms-auto">${edJob ? 'Save Job Changes' : 'Publish Job Now'}</button>
                <button type="button" id="a-job-cancel" class="btn btn-outline-secondary btn-sm">Cancel</button>
              </div>
            </form>
          </div>
        ` : ''}
        <div class="mw-card overflow-hidden">
          <div class="list-group list-group-flush">
            ${aState.jobs.map(function (j) {
              return `<div class="list-group-item p-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                  <div class="small text-secondary">#${j.id} · ${MW.esc(j.categoryName)} · By ${MW.esc(j.employerName)} · <strong class="text-uppercase text-primary">${MW.esc(j.status)}</strong></div>
                  <div class="fw-bold">${MW.esc(j.title)}</div>
                  <div class="font-mono small text-secondary">${j.workersCompleted}/${j.workersNeeded} slots · ${MW.reward(j.rewardPerWorker, sym)}/task · Budget ${MW.money(j.totalBudget, sym)}</div>
                </div>
                <div class="d-flex flex-wrap gap-2">
                  ${j.status === 'pending' ? `<button type="button" data-ajob="${j.id}" data-act="approve" class="btn btn-success btn-sm fw-bold">Approve</button>
                    <button type="button" data-ajob="${j.id}" data-act="reject" class="btn btn-danger btn-sm fw-bold">Reject</button>` : ''}
                  ${j.status === 'active' ? `<button type="button" data-ajob="${j.id}" data-act="pause" class="btn btn-outline-warning btn-sm">Pause</button>` : ''}
                  ${j.status === 'paused' ? `<button type="button" data-ajob="${j.id}" data-act="resume" class="btn btn-outline-success btn-sm">Resume</button>` : ''}
                  <button type="button" data-edit-job="${j.id}" class="btn btn-outline-primary btn-sm">Edit</button>
                  <button type="button" data-ajob="${j.id}" data-act="toggle_feature" class="btn btn-sm ${j.featured ? 'btn-warning text-white' : 'btn-outline-secondary'}">${j.featured ? 'Featured' : 'Feature'}</button>
                  <button type="button" data-ajob="${j.id}" data-act="delete" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash"></i></button>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
      `;
    } else if (aState.tab === 'categories') {
      const edCat = aState.editingCatId ? aState.categories.find(function (c) { return Number(c.id) === Number(aState.editingCatId); }) : null;
      bodyHtml = `<div class="row g-4">
        <div class="col-lg-4"><div class="mw-card p-4"><h6 class="fw-bold mb-3">${edCat ? 'Edit Category' : 'Add Job Category'}</h6>
          <form id="a-cat-form">
            <input id="ac-name" required placeholder="Category Name" class="form-control mb-2" value="${MW.esc(edCat ? edCat.name : '')}" />
            <div class="row g-2 mb-2">
              <div class="col-6"><select id="ac-color" class="form-select form-select-sm">${['indigo', 'rose', 'emerald', 'sky', 'amber', 'violet'].map(function (col) { return `<option value="${col}" ${edCat && edCat.color === col ? 'selected' : ''}>${col}</option>`; }).join('')}</select></div>
              <div class="col-6"><input id="ac-min" type="number" step="0.01" value="${edCat ? edCat.minCpc : '0.05'}" class="form-control form-control-sm font-mono" /></div>
            </div>
            <input id="ac-desc" placeholder="Description" class="form-control mb-3" value="${MW.esc(edCat ? edCat.description : '')}" />
            <div class="d-flex gap-2">
              <button type="submit" class="btn btn-primary flex-grow-1 fw-bold">${edCat ? 'Update' : 'Save Category'}</button>
              ${edCat ? `<button type="button" id="a-cat-cancel" class="btn btn-outline-secondary">Cancel</button>` : ''}
            </div>
          </form>
        </div></div>
        <div class="col-lg-8"><div class="mw-card overflow-hidden"><div class="list-group list-group-flush">
          ${aState.categories.map(function (c) {
            return `<div class="list-group-item p-3 d-flex justify-content-between align-items-center">
              <div><div class="fw-bold">${MW.esc(c.name)}</div><div class="small text-secondary">Min ${MW.reward(c.minCpc, sym)} · ${MW.esc(c.description)}</div></div>
              <div class="d-flex gap-2">
                <button type="button" data-cat-edit="${c.id}" class="btn btn-sm btn-outline-primary">Edit</button>
                <button type="button" data-cat-toggle="${c.id}" class="btn btn-sm ${c.active ? 'btn-outline-success' : 'btn-outline-secondary'}">${c.active ? 'Active' : 'Disabled'}</button>
                <button type="button" data-cat-del="${c.id}" class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button>
              </div>
            </div>`;
          }).join('')}
        </div></div></div>
      </div>`;
    } else if (aState.tab === 'deposits') {
      const list = aState.deposits.filter(function (d) { return aState.depFilter === 'all' || d.status === aState.depFilter; });
      bodyHtml = `
        <div class="mw-card p-4 mb-4">
          <h6 class="fw-bold mb-3">Manual Deposit Credit (Cash / Bank / Admin Top-Up)</h6>
          <form id="a-man-dep-form" class="row g-2 align-items-end">
            <div class="col-md-3"><label class="form-label small fw-semibold">User</label><select id="amd-user" class="form-select form-select-sm">${aState.users.filter(function (u) { return u.role !== 'admin'; }).map(function (u) { return `<option value="${u.id}">${MW.esc(u.name)} (@${MW.esc(u.username || u.name)})</option>`; }).join('')}</select></div>
            <div class="col-md-3"><label class="form-label small fw-semibold">Gateway</label><select id="amd-gw" class="form-select form-select-sm">${aState.gateways.map(function (g) { return `<option value="${g.id}">${MW.esc(g.name)}</option>`; }).join('')}</select></div>
            <div class="col-md-2"><label class="form-label small fw-semibold">Amount (${sym})</label><input id="amd-amt" type="number" step="0.01" min="0.5" required class="form-control form-control-sm font-mono" value="10" /></div>
            <div class="col-md-2"><label class="form-label small fw-semibold">Ref / TrxID</label><input id="amd-trx" class="form-control form-control-sm font-mono" placeholder="MAN-TOPUP" /></div>
            <div class="col-md-2"><button type="submit" class="btn btn-success btn-sm w-100 fw-bold">Credit Deposit</button></div>
          </form>
        </div>
        <div class="d-flex gap-2 mb-3">
          ${['all', 'pending', 'approved', 'rejected'].map(function (st) {
            return `<button type="button" data-dep-flt="${st}" class="btn btn-sm text-capitalize ${aState.depFilter === st ? 'btn-primary' : 'btn-outline-secondary'}">${st}</button>`;
          }).join('')}
        </div>
        <div class="mw-card overflow-hidden"><div class="table-responsive"><table class="table table-hover mb-0 align-middle small">
          <thead class="table-light"><tr><th>User</th><th>Gateway &amp; TrxID</th><th class="text-end">Amount</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
          <tbody>
            ${list.map(function (d) {
              const shot = MW.safeUrl(d.screenshotUrl);
              return `<tr>
                <td><div class="fw-bold">${MW.esc(d.userName)}</div><div class="text-secondary">${MW.esc(d.userEmail)}</div></td>
                <td><div>${MW.esc(d.gatewayName)}</div><div class="font-mono text-secondary">${MW.esc(d.trxId)}</div>${shot ? `<a href="${shot}" target="_blank" rel="noopener noreferrer">View Receipt</a>` : ''}</td>
                <td class="text-end font-mono fw-bold">${MW.money(d.amount, sym)}</td>
                <td class="fw-bold text-capitalize">${MW.esc(d.status)}</td>
                <td class="text-end">${d.status === 'pending' ? `<button type="button" data-dep-dec="${d.id}" data-val="approved" class="btn btn-success btn-sm me-1">Approve</button><button type="button" data-dep-dec="${d.id}" data-val="rejected" class="btn btn-danger btn-sm">Reject</button>` : ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div></div>
      `;
    } else if (aState.tab === 'withdrawals') {
      const list = aState.withdrawals.filter(function (w) { return aState.wdFilter === 'all' || w.status === aState.wdFilter; });
      bodyHtml = `
        <div class="mw-card p-4 mb-4">
          <h6 class="fw-bold mb-3">Manual Worker Payout Entry</h6>
          <form id="a-man-wd-form" class="row g-2 align-items-end">
            <div class="col-md-3"><label class="form-label small fw-semibold">Worker</label><select id="amw-user" class="form-select form-select-sm">${aState.users.filter(function (u) { return u.role !== 'admin'; }).map(function (u) { return `<option value="${u.id}">${MW.esc(u.name)} (${MW.money(u.earningBalance, sym)})</option>`; }).join('')}</select></div>
            <div class="col-md-3"><label class="form-label small fw-semibold">Gateway</label><select id="amw-gw" class="form-select form-select-sm">${aState.gateways.map(function (g) { return `<option value="${g.id}">${MW.esc(g.name)}</option>`; }).join('')}</select></div>
            <div class="col-md-2"><label class="form-label small fw-semibold">Amount (${sym})</label><input id="amw-amt" type="number" step="0.01" min="0.5" required class="form-control form-control-sm font-mono" value="5" /></div>
            <div class="col-md-2"><label class="form-label small fw-semibold">Account</label><input id="amw-acc" required class="form-control form-control-sm font-mono" placeholder="017..." /></div>
            <div class="col-md-2"><button type="submit" class="btn btn-primary btn-sm w-100 fw-bold">Record Payout</button></div>
          </form>
        </div>
        <div class="d-flex gap-2 mb-3">
          ${['all', 'pending', 'approved', 'rejected'].map(function (st) {
            return `<button type="button" data-wd-flt="${st}" class="btn btn-sm text-capitalize ${aState.wdFilter === st ? 'btn-primary' : 'btn-outline-secondary'}">${st}</button>`;
          }).join('')}
        </div>
        <div class="mw-card overflow-hidden"><div class="table-responsive"><table class="table table-hover mb-0 align-middle small">
          <thead class="table-light"><tr><th>Worker</th><th>Gateway &amp; Account</th><th class="text-end">Net Payout</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
          <tbody>
            ${list.map(function (w) {
              return `<tr>
                <td><div class="fw-bold">${MW.esc(w.userName)}</div><div class="text-secondary">${MW.esc(w.userEmail)}</div></td>
                <td><div>${MW.esc(w.gatewayName)}</div><div class="font-mono text-secondary">${MW.esc(w.accountNumber)}</div></td>
                <td class="text-end font-mono fw-bold">${MW.money(w.netAmount, sym)}<div class="text-secondary fw-normal">Gross ${MW.money(w.amount, sym)}</div></td>
                <td class="fw-bold text-capitalize">${MW.esc(w.status)}</td>
                <td class="text-end">${w.status === 'pending' ? `<button type="button" data-wd-dec="${w.id}" data-val="approved" class="btn btn-success btn-sm me-1">Mark Paid</button><button type="button" data-wd-dec="${w.id}" data-val="rejected" class="btn btn-danger btn-sm">Reject &amp; Refund</button>` : ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div></div>
      `;
    } else if (aState.tab === 'users') {
      const q = aState.userSearch.trim().toLowerCase();
      const list = aState.users.filter(function (u) {
        return !q || u.name.toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q) || (u.phone || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      });
      const edUser = aState.editingUserId ? aState.users.find(function (u) { return Number(u.id) === Number(aState.editingUserId); }) : null;
      bodyHtml = `
        <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
          <input id="a-user-search" class="form-control form-control-sm" style="max-width:360px;" value="${MW.esc(aState.userSearch)}" placeholder="Search name, username, phone, email..." />
          <button type="button" id="a-new-user-btn" class="btn btn-sm btn-primary fw-bold">${aState.showUserForm ? 'Close Form' : '+ Add New User'}</button>
        </div>
        ${aState.showUserForm ? `
          <div class="mw-card p-4 mb-3">
            <h6 class="fw-bold mb-3">Create Member Account</h6>
            <form id="a-create-user-form" class="row g-2">
              <div class="col-md-3"><input id="au-name" required placeholder="Full Name" class="form-control form-control-sm" /></div>
              <div class="col-md-3"><input id="au-user" required placeholder="Username" class="form-control form-control-sm" /></div>
              <div class="col-md-3"><input id="au-email" required type="email" placeholder="Email" class="form-control form-control-sm" /></div>
              <div class="col-md-3"><input id="au-phone" placeholder="Phone (optional)" class="form-control form-control-sm" /></div>
              <div class="col-md-3"><input id="au-pass" required type="password" minlength="6" placeholder="Password (6+)" class="form-control form-control-sm" /></div>
              <div class="col-md-2"><input id="au-country" value="Bangladesh" class="form-control form-control-sm" /></div>
              <div class="col-md-2"><input id="au-earn" type="number" step="0.01" value="0" placeholder="Earning $" class="form-control form-control-sm font-mono" /></div>
              <div class="col-md-2"><input id="au-dep" type="number" step="0.01" value="5" placeholder="Deposit $" class="form-control form-control-sm font-mono" /></div>
              <div class="col-md-3"><button type="submit" class="btn btn-success btn-sm w-100 fw-bold">Create User</button></div>
            </form>
          </div>
        ` : ''}
        ${edUser ? `
          <div class="mw-card p-4 mb-3 border-primary">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="fw-bold mb-0">Edit User Profile &amp; Ledger: ${MW.esc(edUser.name)}</h6>
              <button type="button" id="a-close-eduser" class="btn btn-sm btn-outline-secondary">Close</button>
            </div>
            <form id="a-edit-user-form" class="row g-2 mb-3">
              <div class="col-md-3"><label class="small fw-semibold">Full Name</label><input id="aeu-name" required class="form-control form-control-sm" value="${MW.esc(edUser.name)}" /></div>
              <div class="col-md-3"><label class="small fw-semibold">Username</label><input id="aeu-user" required class="form-control form-control-sm" value="${MW.esc(edUser.username || '')}" /></div>
              <div class="col-md-3"><label class="small fw-semibold">Email</label><input id="aeu-email" required class="form-control form-control-sm" value="${MW.esc(edUser.email)}" /></div>
              <div class="col-md-3"><label class="small fw-semibold">Phone</label><input id="aeu-phone" class="form-control form-control-sm" value="${MW.esc(edUser.phone || '')}" /></div>
              <div class="col-md-3"><label class="small fw-semibold">Country</label><input id="aeu-country" class="form-control form-control-sm" value="${MW.esc(edUser.country)}" /></div>
              <div class="col-md-2"><label class="small fw-semibold">Status</label><select id="aeu-status" class="form-select form-select-sm"><option value="active" ${edUser.status === 'active' ? 'selected' : ''}>Active</option><option value="banned" ${edUser.status === 'banned' ? 'selected' : ''}>Banned</option></select></div>
              <div class="col-md-2"><label class="small fw-semibold">KYC</label><select id="aeu-kyc" class="form-select form-select-sm"><option value="unverified" ${edUser.kycStatus === 'unverified' ? 'selected' : ''}>Unverified</option><option value="pending" ${edUser.kycStatus === 'pending' ? 'selected' : ''}>Pending</option><option value="verified" ${edUser.kycStatus === 'verified' ? 'selected' : ''}>Verified</option><option value="rejected" ${edUser.kycStatus === 'rejected' ? 'selected' : ''}>Rejected</option></select></div>
              <div class="col-md-3"><label class="small fw-semibold">Reset Password (optional)</label><input id="aeu-pass" type="password" placeholder="Leave blank" class="form-control form-control-sm" /></div>
              <div class="col-md-2 d-flex align-items-end"><button type="submit" class="btn btn-primary btn-sm w-100 fw-bold">Save Profile</button></div>
            </form>
            ${aState.editingUserActivity ? `
              <div class="row g-3 border-top pt-3 small">
                <div class="col-md-6"><strong>Recent Ledger (${(aState.editingUserActivity.transactions || []).length})</strong>
                  <div class="mt-1" style="max-height:140px;overflow:auto;">
                    ${(aState.editingUserActivity.transactions || []).map(function (tx) { return `<div class="d-flex justify-content-between py-1 border-bottom"><span>${MW.esc(tx.description)}</span><span class="font-mono fw-bold">${tx.amount >= 0 ? '+' : ''}${MW.money(tx.amount, sym)}</span></div>`; }).join('') || 'No ledger entries.'}
                  </div>
                </div>
                <div class="col-md-6"><strong>Recent Task Proofs (${(aState.editingUserActivity.proofs || []).length})</strong>
                  <div class="mt-1" style="max-height:140px;overflow:auto;">
                    ${(aState.editingUserActivity.proofs || []).map(function (pr) { return `<div class="py-1 border-bottom"><strong>${MW.esc(pr.jobTitle)}</strong> · ${MW.esc(pr.status)}</div>`; }).join('') || 'No task proofs.'}
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}
        ${list.map(function (u) {
          const doc = MW.safeUrl(u.kycDocumentUrl);
          return `<div class="mw-card p-4 mb-3 d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <div class="fw-bold">${MW.esc(u.name)} <span class="font-mono small text-primary">@${MW.esc(u.username || u.name)}</span> <span class="font-mono small text-secondary">(${MW.esc(u.role)})</span></div>
              <div class="small text-secondary">${u.phone ? 'Phone: ' + MW.esc(u.phone) + ' · ' : ''}${MW.esc(u.email)} · ${MW.esc(u.country)} · Status: <strong class="text-uppercase">${MW.esc(u.status)}</strong> · KYC: <strong class="text-uppercase">${MW.esc(u.kycStatus)}</strong></div>
              <div class="font-mono small mt-1">Earning: ${MW.money(u.earningBalance, sym)} · Deposit: ${MW.money(u.depositBalance, sym)}</div>
              ${doc ? `<a href="${doc}" target="_blank" rel="noopener noreferrer" class="small fw-semibold">Inspect KYC ID</a>` : ''}
            </div>
            ${u.role !== 'admin' ? `<div class="d-flex flex-wrap gap-2 align-items-center">
              ${u.kycStatus === 'pending' ? `<button type="button" data-ukyc="${u.id}" data-val="verified" class="btn btn-success btn-sm">Verify KYC</button><button type="button" data-ukyc="${u.id}" data-val="rejected" class="btn btn-danger btn-sm">Reject KYC</button>` : ''}
              <input type="number" step="0.5" placeholder="+/- $" data-uadj-amt="${u.id}" class="form-control form-control-sm font-mono" style="width:85px;" />
              <select data-uadj-wal="${u.id}" class="form-select form-select-sm" style="width:100px;"><option value="deposit">Deposit</option><option value="earning">Earning</option></select>
              <button type="button" data-uadj-btn="${u.id}" class="btn btn-primary btn-sm">Adjust</button>
              <button type="button" data-uedit="${u.id}" class="btn btn-outline-primary btn-sm">Edit &amp; Ledger</button>
              <button type="button" data-uban="${u.id}" data-val="${u.status === 'active' ? 'banned' : 'active'}" class="btn btn-sm ${u.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'}">${u.status === 'active' ? 'Ban' : 'Unban'}</button>
              ${Number(aState.confirmDeleteUserId) === Number(u.id)
                ? `<button type="button" data-udel-yes="${u.id}" class="btn btn-danger btn-sm fw-bold">Confirm Delete</button><button type="button" id="a-udel-no" class="btn btn-outline-secondary btn-sm">Cancel</button>`
                : `<button type="button" data-udel="${u.id}" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash"></i></button>`}
            </div>` : ''}
          </div>`;
        }).join('')}
      `;
    } else if (aState.tab === 'gateways') {
      const edGw = aState.editingGwId ? aState.gateways.find(function (g) { return Number(g.id) === Number(aState.editingGwId); }) : null;
      bodyHtml = `<div class="row g-4">
        <div class="col-lg-4"><div class="mw-card p-4"><h6 class="fw-bold mb-3">${edGw ? 'Edit Payment Gateway' : 'Add Payment Gateway'}</h6>
          <form id="a-gw-form">
            <input id="ag-name" required placeholder="Gateway Name (e.g. Rocket)" class="form-control mb-2" value="${MW.esc(edGw ? edGw.name : '')}" />
            <select id="ag-type" class="form-select mb-2">
              <option value="both" ${!edGw || edGw.type === 'both' ? 'selected' : ''}>Deposit &amp; Withdraw</option>
              <option value="deposit" ${edGw && edGw.type === 'deposit' ? 'selected' : ''}>Deposit Only</option>
              <option value="withdraw" ${edGw && edGw.type === 'withdraw' ? 'selected' : ''}>Withdraw Only</option>
            </select>
            <input id="ag-acc" required placeholder="Account / Pay ID" class="form-control mb-2" value="${MW.esc(edGw ? edGw.accountDetails : '')}" />
            <textarea id="ag-inst" rows="2" placeholder="Instructions" class="form-control mb-2">${MW.esc(edGw ? edGw.instructions : '')}</textarea>
            <div class="row g-2 mb-3">
              <div class="col-4"><input id="ag-min" type="number" step="0.5" value="${edGw ? edGw.minAmount : '2'}" class="form-control form-control-sm font-mono" placeholder="Min" /></div>
              <div class="col-4"><input id="ag-max" type="number" step="1" value="${edGw ? edGw.maxAmount : '1000'}" class="form-control form-control-sm font-mono" placeholder="Max" /></div>
              <div class="col-4"><input id="ag-fee" type="number" step="0.5" value="${edGw ? edGw.feePercent : '2'}" class="form-control form-control-sm font-mono" placeholder="Fee %" /></div>
            </div>
            <div class="d-flex gap-2">
              <button type="submit" class="btn btn-primary flex-grow-1 fw-bold">${edGw ? 'Update Gateway' : 'Create Gateway'}</button>
              ${edGw ? `<button type="button" id="a-gw-cancel" class="btn btn-outline-secondary">Cancel</button>` : ''}
            </div>
          </form>
        </div></div>
        <div class="col-lg-8"><div class="mw-card overflow-hidden"><div class="list-group list-group-flush">
          ${aState.gateways.map(function (g) {
            return `<div class="list-group-item p-3 d-flex justify-content-between align-items-center">
              <div><div class="fw-bold">${MW.esc(g.name)} (${MW.esc(g.type)})</div><div class="font-mono small text-secondary">${MW.esc(g.accountDetails)}</div><div class="small text-secondary">Min ${MW.money(g.minAmount, sym)} · Max ${MW.money(g.maxAmount, sym)} · Fee ${g.feePercent}%</div></div>
              <div class="d-flex gap-2">
                <button type="button" data-gw-edit="${g.id}" class="btn btn-sm btn-outline-primary">Edit</button>
                <button type="button" data-gw-toggle="${g.id}" class="btn btn-sm ${g.active ? 'btn-outline-success' : 'btn-outline-secondary'}">${g.active ? 'Active' : 'Paused'}</button>
                <button type="button" data-gw-del="${g.id}" class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button>
              </div>
            </div>`;
          }).join('')}
        </div></div></div>
      </div>`;
    } else if (aState.tab === 'tickets') {
      bodyHtml = aState.tickets.map(function (t) {
        return `<div class="mw-card p-4 mb-3">
          <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
            <div><div class="small text-secondary">#${t.id} · ${MW.esc(t.userName)} (${MW.esc(t.userEmail)})</div><strong>${MW.esc(t.subject)}</strong></div>
            <select data-atk-status="${t.id}" class="form-select form-select-sm" style="width:130px;">
              <option value="open" ${t.status === 'open' ? 'selected' : ''}>Open</option>
              <option value="answered" ${t.status === 'answered' ? 'selected' : ''}>Answered</option>
              <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>Resolved</option>
              <option value="closed" ${t.status === 'closed' ? 'selected' : ''}>Closed</option>
            </select>
          </div>
          ${(t.replies || []).map(function (r) { return `<div class="rounded p-2 mb-2 small ${r.senderRole === 'admin' ? 'bg-teal-50' : 'bg-light'}"><strong>${MW.esc(r.senderName)}:</strong> ${MW.esc(r.message)}</div>`; }).join('')}
          <div class="input-group input-group-sm mt-2">
            <input type="text" data-atk-input="${t.id}" class="form-control" placeholder="Reply to user..." />
            <button type="button" data-atk-reply="${t.id}" class="btn btn-primary fw-semibold">Send Reply</button>
          </div>
        </div>`;
      }).join('') || '<div class="mw-card p-4 text-center small text-secondary">No tickets yet.</div>';
    } else if (aState.tab === 'branding') {
      const themes = [
        { id: 'teal', label: 'Ocean Teal' },
        { id: 'indigo', label: 'Indigo' },
        { id: 'violet', label: 'Violet' },
        { id: 'emerald', label: 'Emerald' },
        { id: 'rose', label: 'Rose' },
        { id: 'amber', label: 'Amber' },
        { id: 'sky', label: 'Sky' },
      ];
      bodyHtml = `<div class="mw-card p-4" style="max-width:780px;">
        <h5 class="fw-bold mb-3">Website Identity &amp; Logo Control</h5>
        <form id="a-brand-form" class="row g-3">
          <div class="col-12">
            <label class="form-label small fw-semibold">Website Logo Image</label>
            <div class="d-flex flex-wrap align-items-center gap-3 p-3 bg-light rounded-3 border">
              ${settings.logoUrl ? `<img src="${MW.safeUrl(settings.logoUrl)}" alt="Logo" class="rounded-3 object-fit-cover border" style="width:52px;height:52px;" />` : `<div class="rounded-3 border bg-white d-flex align-items-center justify-content-center text-secondary" style="width:52px;height:52px;"><i class="bi bi-image"></i></div>`}
              <input type="file" id="br-logo-file" class="form-control form-control-sm" style="max-width:240px;" accept="image/png,image/jpeg,image/webp" />
              <input type="text" id="br-logo-url" class="form-control form-control-sm flex-grow-1" value="${MW.esc(settings.logoUrl)}" placeholder="Or paste logo URL" />
            </div>
          </div>
          <div class="col-md-6"><label class="form-label small fw-semibold">Site Name</label><input id="br-name" class="form-control" value="${MW.esc(settings.siteName)}" /></div>
          <div class="col-md-6"><label class="form-label small fw-semibold">Accent Color Theme</label><select id="br-theme" class="form-select">${themes.map(function (t) { return `<option value="${t.id}" ${settings.accentTheme === t.id ? 'selected' : ''}>${t.label}</option>`; }).join('')}</select></div>
          <div class="col-12"><label class="form-label small fw-semibold">Tagline</label><input id="br-tag" class="form-control" value="${MW.esc(settings.tagline)}" /></div>
          <div class="col-md-6"><label class="form-label small fw-semibold">Support Email</label><input id="br-email" type="email" class="form-control" value="${MW.esc(settings.supportEmail)}" /></div>
          <div class="col-md-6"><label class="form-label small fw-semibold">Footer Text</label><input id="br-footer" class="form-control" value="${MW.esc(settings.footerText)}" /></div>
          <div class="col-12"><label class="form-label small fw-semibold">Member Notice Banner</label><textarea id="br-notice" rows="2" class="form-control">${MW.esc(settings.noticeBanner)}</textarea></div>
          <div class="col-12"><button type="submit" class="btn btn-primary fw-bold px-4">Save Website &amp; Logo</button></div>
        </form>
      </div>`;
    } else if (aState.tab === 'homepage') {
      bodyHtml = `<div class="mw-card p-4" style="max-width:820px;">
        <h5 class="fw-bold mb-3">Home Page Builder</h5>
        <form id="a-home-form" class="row g-3">
          <div class="col-12"><label class="form-label small fw-semibold">Hero Kicker</label><input id="hp-kicker" class="form-control" value="${MW.esc(settings.heroKicker)}" /></div>
          <div class="col-12"><label class="form-label small fw-semibold">Hero Main Title</label><input id="hp-title" class="form-control" value="${MW.esc(settings.heroTitle)}" /></div>
          <div class="col-12"><label class="form-label small fw-semibold">Hero Subtitle</label><textarea id="hp-sub" rows="2" class="form-control">${MW.esc(settings.heroSubtitle)}</textarea></div>
          <div class="col-md-6"><label class="form-label small fw-semibold">Primary CTA Button</label><input id="hp-cta1" class="form-control" value="${MW.esc(settings.heroPrimaryCta)}" /></div>
          <div class="col-md-6"><label class="form-label small fw-semibold">Secondary CTA Button</label><input id="hp-cta2" class="form-control" value="${MW.esc(settings.heroSecondaryCta)}" /></div>
          <div class="col-12">
            <label class="form-label small fw-semibold">Hero Banner Image</label>
            <div class="d-flex flex-wrap gap-2 align-items-center">
              <input type="file" id="hp-img-file" class="form-control form-control-sm" style="max-width:240px;" accept="image/png,image/jpeg,image/webp" />
              <input id="hp-img-url" class="form-control form-control-sm flex-grow-1" value="${MW.esc(settings.heroImageUrl)}" />
            </div>
          </div>
          <div class="col-md-6"><label class="form-label small fw-semibold">Founder / Lead Name</label><input id="hp-fname" class="form-control" value="${MW.esc(settings.founderName)}" /></div>
          <div class="col-md-6"><label class="form-label small fw-semibold">Founder Role &amp; Region</label><input id="hp-frole" class="form-control" value="${MW.esc(settings.founderRole)}" /></div>
          <div class="col-12"><label class="form-label small fw-semibold">Trust Quote</label><textarea id="hp-fquote" rows="2" class="form-control">${MW.esc(settings.founderQuote)}</textarea></div>
          <div class="col-12 d-flex flex-wrap gap-4">
            <div class="form-check"><input type="checkbox" id="hp-stats" class="form-check-input" ${settings.showStatsStrip !== false ? 'checked' : ''} /><label class="form-check-label small" for="hp-stats">Show Stats Strip</label></div>
            <div class="form-check"><input type="checkbox" id="hp-how" class="form-check-input" ${settings.showHowItWorks !== false ? 'checked' : ''} /><label class="form-check-label small" for="hp-how">Show How It Works</label></div>
            <div class="form-check"><input type="checkbox" id="hp-blog" class="form-check-input" ${settings.showBlogSection !== false ? 'checked' : ''} /><label class="form-check-label small" for="hp-blog">Show Blog Section</label></div>
          </div>
          <div class="col-12"><button type="submit" class="btn btn-primary fw-bold px-4">Save Home Page</button></div>
        </form>
      </div>`;
    } else if (aState.tab === 'blog') {
      const edPost = aState.editingPostId ? aState.blogPosts.find(function (p) { return Number(p.id) === Number(aState.editingPostId); }) : null;
      bodyHtml = `<div class="row g-4">
        <div class="col-lg-5"><div class="mw-card p-4"><h6 class="fw-bold mb-3">${edPost ? 'Edit Blog Post' : 'Publish Blog Article'}</h6>
          <form id="a-blog-form">
            <input id="ab-title" required placeholder="Article Title" class="form-control mb-2" value="${MW.esc(edPost ? edPost.title : '')}" />
            <div class="row g-2 mb-2">
              <div class="col-6"><input id="ab-cat" placeholder="Category" class="form-control form-control-sm" value="${MW.esc(edPost ? edPost.category : 'Worker Tips')}" /></div>
              <div class="col-6"><input id="ab-author" placeholder="Author Name" class="form-control form-control-sm" value="${MW.esc(edPost ? edPost.authorName : admin.name)}" /></div>
            </div>
            <div class="d-flex gap-2 mb-2">
              <input type="file" id="ab-cov-file" class="form-control form-control-sm" accept="image/png,image/jpeg,image/webp" />
              <input id="ab-cov-url" placeholder="Cover Image URL" class="form-control form-control-sm" value="${MW.esc(edPost ? edPost.coverImageUrl : '/assets/images/category_social.jpg')}" />
            </div>
            <textarea id="ab-excerpt" rows="2" placeholder="Short excerpt..." class="form-control mb-2">${MW.esc(edPost ? edPost.excerpt : '')}</textarea>
            <textarea id="ab-content" required rows="5" placeholder="Full article content..." class="form-control mb-2">${MW.esc(edPost ? edPost.content : '')}</textarea>
            <div class="d-flex gap-3 mb-3">
              <div class="form-check"><input type="checkbox" id="ab-pub" class="form-check-input" ${!edPost || edPost.published ? 'checked' : ''} /><label class="form-check-label small" for="ab-pub">Published</label></div>
              <div class="form-check"><input type="checkbox" id="ab-feat" class="form-check-input" ${edPost && edPost.featured ? 'checked' : ''} /><label class="form-check-label small" for="ab-feat">Featured</label></div>
            </div>
            <div class="d-flex gap-2">
              <button type="submit" class="btn btn-primary flex-grow-1 fw-bold">${edPost ? 'Update Post' : 'Publish Article'}</button>
              ${edPost ? `<button type="button" id="a-blog-cancel" class="btn btn-outline-secondary">Cancel</button>` : ''}
            </div>
          </form>
        </div></div>
        <div class="col-lg-7"><div class="mw-card overflow-hidden"><div class="list-group list-group-flush">
          ${aState.blogPosts.map(function (p) {
            return `<div class="list-group-item p-3 d-flex justify-content-between align-items-center gap-3">
              <div><div class="fw-bold">${MW.esc(p.title)}</div><div class="small text-secondary">${MW.esc(p.category)} · ${p.published ? 'Published' : 'Draft'} ${p.featured ? '· Featured' : ''}</div></div>
              <div class="d-flex gap-2 flex-shrink-0">
                <button type="button" data-bl-edit="${p.id}" class="btn btn-sm btn-outline-primary">Edit</button>
                <button type="button" data-bl-del="${p.id}" class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button>
              </div>
            </div>`;
          }).join('')}
        </div></div></div>
      </div>`;
    } else if (aState.tab === 'pages') {
      const edPage = aState.editingPageId ? aState.pages.find(function (p) { return Number(p.id) === Number(aState.editingPageId); }) : null;
      bodyHtml = `<div class="row g-4">
        <div class="col-lg-5"><div class="mw-card p-4"><h6 class="fw-bold mb-3">${edPage ? 'Edit Page' : 'Create Custom Page'}</h6>
          <form id="a-page-form">
            <input id="ap-title" required placeholder="Page Title" class="form-control mb-2" value="${MW.esc(edPage ? edPage.title : '')}" />
            <input id="ap-slug" placeholder="Slug (e.g. faq)" class="form-control mb-2 font-mono" value="${MW.esc(edPage ? edPage.slug : '')}" />
            <input id="ap-summary" placeholder="Short summary" class="form-control mb-2" value="${MW.esc(edPage ? edPage.summary : '')}" />
            <textarea id="ap-content" required rows="5" placeholder="Page body content..." class="form-control mb-2">${MW.esc(edPage ? edPage.content : '')}</textarea>
            <div class="d-flex flex-wrap gap-3 mb-3">
              <div class="form-check"><input type="checkbox" id="ap-hdr" class="form-check-input" ${edPage && edPage.showInHeader ? 'checked' : ''} /><label class="form-check-label small" for="ap-hdr">Header Link</label></div>
              <div class="form-check"><input type="checkbox" id="ap-ftr" class="form-check-input" ${!edPage || edPage.showInFooter ? 'checked' : ''} /><label class="form-check-label small" for="ap-ftr">Footer Link</label></div>
              <div class="form-check"><input type="checkbox" id="ap-pub" class="form-check-input" ${!edPage || edPage.published ? 'checked' : ''} /><label class="form-check-label small" for="ap-pub">Published</label></div>
            </div>
            <div class="d-flex gap-2">
              <button type="submit" class="btn btn-primary flex-grow-1 fw-bold">${edPage ? 'Update Page' : 'Create Page'}</button>
              ${edPage ? `<button type="button" id="a-page-cancel" class="btn btn-outline-secondary">Cancel</button>` : ''}
            </div>
          </form>
        </div></div>
        <div class="col-lg-7"><div class="mw-card overflow-hidden"><div class="list-group list-group-flush">
          ${aState.pages.map(function (p) {
            return `<div class="list-group-item p-3 d-flex justify-content-between align-items-center gap-3">
              <div><div class="fw-bold">${MW.esc(p.title)} <span class="font-mono small text-secondary">/${MW.esc(p.slug)}</span></div><div class="small text-secondary">${p.published ? 'Published' : 'Hidden'} · ${p.showInHeader ? 'Header' : ''} ${p.showInFooter ? 'Footer' : ''}</div></div>
              <div class="d-flex gap-2 flex-shrink-0">
                <button type="button" data-pg-edit="${p.id}" class="btn btn-sm btn-outline-primary">Edit</button>
                <button type="button" data-pg-del="${p.id}" class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button>
              </div>
            </div>`;
          }).join('')}
        </div></div></div>
      </div>`;
    } else if (aState.tab === 'settings') {
      bodyHtml = `<div class="mw-card p-4" style="max-width:760px;"><h5 class="fw-bold mb-3">Platform Rules &amp; System Controls</h5>
        <form id="a-set-form" class="row g-3">
          <div class="col-md-3"><label class="form-label small fw-semibold">Currency</label><input id="st-sym" class="form-control" value="${MW.esc(settings.currencySymbol)}" /></div>
          <div class="col-md-3"><label class="form-label small fw-semibold">Platform Fee (%)</label><input id="st-fee" type="number" step="0.5" class="form-control font-mono" value="${settings.platformFeePercent}" /></div>
          <div class="col-md-3"><label class="form-label small fw-semibold">Referral (%)</label><input id="st-ref" type="number" step="0.5" class="form-control font-mono" value="${settings.referralCommissionPercent}" /></div>
          <div class="col-md-3"><label class="form-label small fw-semibold">Min Withdraw</label><input id="st-minwd" type="number" step="0.5" class="form-control font-mono" value="${settings.minWithdrawAmount || 2}" /></div>
          <div class="col-md-4"><label class="form-label small fw-semibold">Min Workers / Job</label><input id="st-minw" type="number" class="form-control font-mono" value="${settings.minJobWorkers}" /></div>
          <div class="col-md-8"><label class="form-label small fw-semibold">Maintenance Message</label><input id="st-mmsg" class="form-control" value="${MW.esc(settings.maintenanceMessage || '')}" /></div>
          <div class="col-12 d-flex flex-wrap gap-4">
            <div class="form-check"><input type="checkbox" id="st-auto" class="form-check-input" ${settings.autoApproveJobs ? 'checked' : ''} /><label class="form-check-label small" for="st-auto">Auto-approve campaigns</label></div>
            <div class="form-check"><input type="checkbox" id="st-reg" class="form-check-input" ${settings.allowRegistration !== false ? 'checked' : ''} /><label class="form-check-label small" for="st-reg">Allow new registrations</label></div>
            <div class="form-check"><input type="checkbox" id="st-maint" class="form-check-input" ${settings.maintenanceMode ? 'checked' : ''} /><label class="form-check-label small text-danger fw-semibold" for="st-maint">Maintenance Mode</label></div>
          </div>
          <div class="col-12"><button type="submit" class="btn btn-primary fw-bold px-4">Save System Controls</button></div>
        </form>
      </div>`;
    }

    mount.innerHTML = `
      <div class="d-flex min-vh-100 bg-slate-100">
        <aside class="d-none d-lg-flex flex-column bg-slate-950 text-white p-3" style="width:265px;">
          <div class="px-3 py-3 border-bottom border-secondary border-opacity-25 mb-3">
            <div class="font-display fw-bolder fs-5">${MW.esc(settings.siteName)} Admin</div>
            <div class="small text-secondary text-truncate">${MW.esc(admin.email)}</div>
          </div>
          <div class="flex-grow-1 overflow-auto">${sidebarHtml}</div>
          <div class="border-top border-secondary border-opacity-25 pt-3 mt-3 d-flex flex-column gap-2">
            <button type="button" id="a-public" class="btn btn-outline-light btn-sm">View Live Site</button>
            <button type="button" id="a-logout" class="btn btn-outline-danger btn-sm">Sign Out</button>
          </div>
        </aside>
        <div class="flex-grow-1 d-flex flex-column min-w-0">
          <header class="bg-white border-bottom px-4 py-3 d-flex justify-content-between align-items-center">
            <div class="fw-bold">${MW.esc(allNavItems.find(function (n) { return n.id === aState.tab; })?.label || 'Overview')}</div>
            <button type="button" id="a-mobile-out" class="btn btn-outline-danger btn-sm d-lg-none">Sign Out</button>
          </header>
          <div class="d-flex d-lg-none overflow-auto gap-2 p-2 bg-dark">${mobileTabsHtml}</div>
          <main class="p-4 container-fluid" style="max-width:1200px;">
            ${alertHtml}
            ${bodyHtml}
          </main>
        </div>
      </div>
    `;

    // Bind navigation
    mount.querySelectorAll('[data-atab]').forEach(function (b) {
      b.onclick = function () { aState.tab = b.getAttribute('data-atab'); aState.msg = null; MW.renderAdmin(); };
    });
    const closeMsg = document.getElementById('a-close-msg');
    if (closeMsg) closeMsg.onclick = function () { aState.msg = null; MW.renderAdmin(); };
    document.getElementById('a-public').onclick = MW.showMarketplace;
    document.getElementById('a-logout').onclick = MW.logout;
    const mobOut = document.getElementById('a-mobile-out');
    if (mobOut) mobOut.onclick = MW.logout;

    // Jobs actions & CRUD
    const newJobBtn = document.getElementById('a-new-job-btn');
    if (newJobBtn) newJobBtn.onclick = function () { aState.editingJobId = null; aState.showJobForm = !aState.showJobForm; MW.renderAdmin(); };
    const cancelJobBtn = document.getElementById('a-job-cancel');
    if (cancelJobBtn) cancelJobBtn.onclick = function () { aState.editingJobId = null; aState.showJobForm = false; MW.renderAdmin(); };
    mount.querySelectorAll('[data-edit-job]').forEach(function (b) {
      b.onclick = function () { aState.editingJobId = Number(b.getAttribute('data-edit-job')); aState.showJobForm = true; MW.renderAdmin(); };
    });
    const jobForm = document.getElementById('a-job-form');
    if (jobForm) {
      jobForm.onsubmit = async function (e) {
        e.preventDefault();
        const payload = {
          title: document.getElementById('aj-title').value,
          categoryId: Number(document.getElementById('aj-cat').value),
          targetRegion: document.getElementById('aj-region').value,
          targetUrl: document.getElementById('aj-url').value,
          rewardPerWorker: Number(document.getElementById('aj-rew').value),
          workersNeeded: Number(document.getElementById('aj-wrk').value),
          estimatedMinutes: Number(document.getElementById('aj-min').value),
          status: document.getElementById('aj-stat').value,
          steps: document.getElementById('aj-steps').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
          proofRequirement: document.getElementById('aj-proof').value,
          requireScreenshot: document.getElementById('aj-shot').checked,
          featured: document.getElementById('aj-feat').checked,
        };
        try {
          if (aState.editingJobId) {
            await MW.api('/admin/jobs/' + aState.editingJobId, { method: 'PUT', body: JSON.stringify(payload) });
            setMsg('ok', 'Campaign updated.');
          } else {
            await MW.api('/admin/jobs', { method: 'POST', body: JSON.stringify(payload) });
            setMsg('ok', 'Official micro-job published.');
          }
          aState.editingJobId = null;
          aState.showJobForm = false;
          await MW.loadAdminData();
          await MW.refreshBootstrap();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    }

    mount.querySelectorAll('[data-ajob]').forEach(function (b) {
      b.onclick = async function () {
        try {
          await MW.api('/admin/jobs/' + b.getAttribute('data-ajob') + '/action', {
            method: 'POST',
            body: JSON.stringify({ action: b.getAttribute('data-act') }),
          });
          setMsg('ok', 'Job updated.');
          await MW.loadAdminData();
          await MW.refreshBootstrap();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    });

    // Categories
    mount.querySelectorAll('[data-cat-edit]').forEach(function (b) {
      b.onclick = function () { aState.editingCatId = Number(b.getAttribute('data-cat-edit')); MW.renderAdmin(); };
    });
    const catCancel = document.getElementById('a-cat-cancel');
    if (catCancel) catCancel.onclick = function () { aState.editingCatId = null; MW.renderAdmin(); };
    const catForm = document.getElementById('a-cat-form');
    if (catForm) {
      catForm.onsubmit = async function (e) {
        e.preventDefault();
        const payload = {
          name: document.getElementById('ac-name').value,
          color: document.getElementById('ac-color').value,
          minCpc: Number(document.getElementById('ac-min').value),
          description: document.getElementById('ac-desc').value,
        };
        try {
          if (aState.editingCatId) {
            await MW.api('/admin/categories/' + aState.editingCatId, { method: 'PUT', body: JSON.stringify(payload) });
            setMsg('ok', 'Category updated.');
          } else {
            await MW.api('/admin/categories', { method: 'POST', body: JSON.stringify(payload) });
            setMsg('ok', 'Category added.');
          }
          aState.editingCatId = null;
          await MW.loadAdminData();
          await MW.refreshBootstrap();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    }
    mount.querySelectorAll('[data-cat-toggle]').forEach(function (b) {
      b.onclick = async function () {
        const id = Number(b.getAttribute('data-cat-toggle'));
        const cat = aState.categories.find(function (c) { return Number(c.id) === id; });
        await MW.api('/admin/categories/' + id, { method: 'PUT', body: JSON.stringify({ active: !cat.active }) });
        await MW.loadAdminData();
        await MW.refreshBootstrap();
        MW.renderAdmin();
      };
    });
    mount.querySelectorAll('[data-cat-del]').forEach(function (b) {
      b.onclick = async function () {
        try {
          await MW.api('/admin/categories/' + b.getAttribute('data-cat-del'), { method: 'DELETE' });
          await MW.loadAdminData();
          await MW.refreshBootstrap();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    });

    // Deposits & Manual Credit
    mount.querySelectorAll('[data-dep-flt]').forEach(function (b) {
      b.onclick = function () { aState.depFilter = b.getAttribute('data-dep-flt'); MW.renderAdmin(); };
    });
    const manDepForm = document.getElementById('a-man-dep-form');
    if (manDepForm) {
      manDepForm.onsubmit = async function (e) {
        e.preventDefault();
        try {
          await MW.api('/admin/deposits/manual', {
            method: 'POST',
            body: JSON.stringify({
              userId: Number(document.getElementById('amd-user').value),
              gatewayId: Number(document.getElementById('amd-gw').value),
              amount: Number(document.getElementById('amd-amt').value),
              trxId: document.getElementById('amd-trx').value,
            }),
          });
          setMsg('ok', 'Manual deposit credited.');
          await MW.loadAdminData();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    }
    mount.querySelectorAll('[data-dep-dec]').forEach(function (b) {
      b.onclick = async function () {
        try {
          await MW.api('/admin/deposits/' + b.getAttribute('data-dep-dec') + '/decision', {
            method: 'POST',
            body: JSON.stringify({ decision: b.getAttribute('data-val') }),
          });
          setMsg('ok', 'Deposit updated.');
          await MW.loadAdminData();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    });

    // Withdrawals & Manual Payout
    mount.querySelectorAll('[data-wd-flt]').forEach(function (b) {
      b.onclick = function () { aState.wdFilter = b.getAttribute('data-wd-flt'); MW.renderAdmin(); };
    });
    const manWdForm = document.getElementById('a-man-wd-form');
    if (manWdForm) {
      manWdForm.onsubmit = async function (e) {
        e.preventDefault();
        try {
          await MW.api('/admin/withdrawals/manual', {
            method: 'POST',
            body: JSON.stringify({
              userId: Number(document.getElementById('amw-user').value),
              gatewayId: Number(document.getElementById('amw-gw').value),
              amount: Number(document.getElementById('amw-amt').value),
              accountNumber: document.getElementById('amw-acc').value,
            }),
          });
          setMsg('ok', 'Manual payout recorded.');
          await MW.loadAdminData();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    }
    mount.querySelectorAll('[data-wd-dec]').forEach(function (b) {
      b.onclick = async function () {
        try {
          await MW.api('/admin/withdrawals/' + b.getAttribute('data-wd-dec') + '/decision', {
            method: 'POST',
            body: JSON.stringify({ decision: b.getAttribute('data-val') }),
          });
          setMsg('ok', 'Withdrawal updated.');
          await MW.loadAdminData();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    });

    // Users CRUD & Ledger
    const uSearch = document.getElementById('a-user-search');
    if (uSearch) {
      uSearch.oninput = function (e) {
        aState.userSearch = e.target.value;
        MW.renderAdmin();
        const el = document.getElementById('a-user-search');
        if (el) { el.focus(); el.setSelectionRange(aState.userSearch.length, aState.userSearch.length); }
      };
    }
    const newUserBtn = document.getElementById('a-new-user-btn');
    if (newUserBtn) newUserBtn.onclick = function () { aState.showUserForm = !aState.showUserForm; MW.renderAdmin(); };
    const createUserForm = document.getElementById('a-create-user-form');
    if (createUserForm) {
      createUserForm.onsubmit = async function (e) {
        e.preventDefault();
        try {
          await MW.api('/admin/users', {
            method: 'POST',
            body: JSON.stringify({
              name: document.getElementById('au-name').value,
              username: document.getElementById('au-user').value,
              email: document.getElementById('au-email').value,
              phone: document.getElementById('au-phone').value,
              password: document.getElementById('au-pass').value,
              country: document.getElementById('au-country').value,
              earningBalance: Number(document.getElementById('au-earn').value),
              depositBalance: Number(document.getElementById('au-dep').value),
            }),
          });
          aState.showUserForm = false;
          setMsg('ok', 'User created.');
          await MW.loadAdminData();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    }
    mount.querySelectorAll('[data-uedit]').forEach(function (b) {
      b.onclick = async function () {
        const uid = Number(b.getAttribute('data-uedit'));
        aState.editingUserId = uid;
        aState.editingUserActivity = null;
        MW.renderAdmin();
        try {
          aState.editingUserActivity = await MW.api('/admin/users/' + uid + '/activity');
          MW.renderAdmin();
        } catch (_e) {}
      };
    });
    const closeEdUser = document.getElementById('a-close-eduser');
    if (closeEdUser) closeEdUser.onclick = function () { aState.editingUserId = null; aState.editingUserActivity = null; MW.renderAdmin(); };
    const edUserForm = document.getElementById('a-edit-user-form');
    if (edUserForm) {
      edUserForm.onsubmit = async function (e) {
        e.preventDefault();
        try {
          const pw = document.getElementById('aeu-pass').value;
          await MW.api('/admin/users/' + aState.editingUserId, {
            method: 'PUT',
            body: JSON.stringify({
              name: document.getElementById('aeu-name').value,
              username: document.getElementById('aeu-user').value,
              email: document.getElementById('aeu-email').value,
              phone: document.getElementById('aeu-phone').value,
              country: document.getElementById('aeu-country').value,
              status: document.getElementById('aeu-status').value,
              kycStatus: document.getElementById('aeu-kyc').value,
              password: pw || undefined,
            }),
          });
          setMsg('ok', 'User profile updated.');
          await MW.loadAdminData();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    }
    mount.querySelectorAll('[data-ukyc]').forEach(function (b) {
      b.onclick = async function () {
        await MW.api('/admin/users/' + b.getAttribute('data-ukyc') + '/kyc', { method: 'POST', body: JSON.stringify({ status: b.getAttribute('data-val') }) });
        await MW.loadAdminData();
        MW.renderAdmin();
      };
    });
    mount.querySelectorAll('[data-uban]').forEach(function (b) {
      b.onclick = async function () {
        await MW.api('/admin/users/' + b.getAttribute('data-uban') + '/status', { method: 'POST', body: JSON.stringify({ status: b.getAttribute('data-val') }) });
        await MW.loadAdminData();
        MW.renderAdmin();
      };
    });
    mount.querySelectorAll('[data-uadj-btn]').forEach(function (b) {
      b.onclick = async function () {
        const uid = b.getAttribute('data-uadj-btn');
        const amt = Number(document.querySelector('[data-uadj-amt="' + uid + '"]').value);
        const wal = document.querySelector('[data-uadj-wal="' + uid + '"]').value;
        try {
          await MW.api('/admin/users/' + uid + '/balance', { method: 'POST', body: JSON.stringify({ wallet: wal, amount: amt }) });
          setMsg('ok', 'Balance adjusted.');
          await MW.loadAdminData();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    });
    mount.querySelectorAll('[data-udel]').forEach(function (b) {
      b.onclick = function () { aState.confirmDeleteUserId = Number(b.getAttribute('data-udel')); MW.renderAdmin(); };
    });
    const delNo = document.getElementById('a-udel-no');
    if (delNo) delNo.onclick = function () { aState.confirmDeleteUserId = null; MW.renderAdmin(); };
    mount.querySelectorAll('[data-udel-yes]').forEach(function (b) {
      b.onclick = async function () {
        try {
          await MW.api('/admin/users/' + b.getAttribute('data-udel-yes'), { method: 'DELETE' });
          aState.confirmDeleteUserId = null;
          setMsg('ok', 'User deleted.');
          await MW.loadAdminData();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    });

    // Gateways CRUD
    mount.querySelectorAll('[data-gw-edit]').forEach(function (b) {
      b.onclick = function () { aState.editingGwId = Number(b.getAttribute('data-gw-edit')); MW.renderAdmin(); };
    });
    const gwCancel = document.getElementById('a-gw-cancel');
    if (gwCancel) gwCancel.onclick = function () { aState.editingGwId = null; MW.renderAdmin(); };
    const gwForm = document.getElementById('a-gw-form');
    if (gwForm) {
      gwForm.onsubmit = async function (e) {
        e.preventDefault();
        const payload = {
          name: document.getElementById('ag-name').value,
          type: document.getElementById('ag-type').value,
          accountDetails: document.getElementById('ag-acc').value,
          instructions: document.getElementById('ag-inst').value,
          minAmount: Number(document.getElementById('ag-min').value),
          maxAmount: Number(document.getElementById('ag-max').value),
          feePercent: Number(document.getElementById('ag-fee').value),
        };
        try {
          if (aState.editingGwId) {
            await MW.api('/admin/gateways/' + aState.editingGwId, { method: 'PUT', body: JSON.stringify(payload) });
            setMsg('ok', 'Payment gateway updated.');
          } else {
            await MW.api('/admin/gateways', { method: 'POST', body: JSON.stringify(payload) });
            setMsg('ok', 'Payment gateway added.');
          }
          aState.editingGwId = null;
          await MW.loadAdminData();
          await MW.refreshBootstrap();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    }
    mount.querySelectorAll('[data-gw-toggle]').forEach(function (b) {
      b.onclick = async function () {
        const id = Number(b.getAttribute('data-gw-toggle'));
        const g = aState.gateways.find(function (x) { return Number(x.id) === id; });
        await MW.api('/admin/gateways/' + id, { method: 'PUT', body: JSON.stringify({ active: !g.active }) });
        await MW.loadAdminData();
        await MW.refreshBootstrap();
        MW.renderAdmin();
      };
    });
    mount.querySelectorAll('[data-gw-del]').forEach(function (b) {
      b.onclick = async function () {
        await MW.api('/admin/gateways/' + b.getAttribute('data-gw-del'), { method: 'DELETE' });
        await MW.loadAdminData();
        await MW.refreshBootstrap();
        MW.renderAdmin();
      };
    });

    // Tickets
    mount.querySelectorAll('[data-atk-status]').forEach(function (s) {
      s.onchange = async function () {
        await MW.api('/admin/tickets/' + s.getAttribute('data-atk-status') + '/reply', { method: 'POST', body: JSON.stringify({ status: s.value }) });
        await MW.loadAdminData();
        MW.renderAdmin();
      };
    });
    mount.querySelectorAll('[data-atk-reply]').forEach(function (b) {
      b.onclick = async function () {
        const tid = b.getAttribute('data-atk-reply');
        const msg = document.querySelector('[data-atk-input="' + tid + '"]').value.trim();
        if (!msg) return;
        await MW.api('/admin/tickets/' + tid + '/reply', { method: 'POST', body: JSON.stringify({ message: msg, status: 'answered' }) });
        await MW.loadAdminData();
        MW.renderAdmin();
      };
    });

    // Branding & Logo upload
    const brLogoFile = document.getElementById('br-logo-file');
    if (brLogoFile) {
      brLogoFile.onchange = async function (e) {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const b64 = await MW.fileToBase64(f);
          const res = await MW.api('/admin/upload', { method: 'POST', body: JSON.stringify({ imageData: b64 }) });
          document.getElementById('br-logo-url').value = res.url;
          setMsg('ok', 'Logo uploaded! Click Save Website & Logo below to apply.');
          MW.renderAdmin();
          document.getElementById('br-logo-url').value = res.url;
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    }
    const brandForm = document.getElementById('a-brand-form');
    if (brandForm) {
      brandForm.onsubmit = async function (e) {
        e.preventDefault();
        try {
          await MW.api('/admin/settings', {
            method: 'PUT',
            body: JSON.stringify(Object.assign({}, settings, {
              siteName: document.getElementById('br-name').value,
              accentTheme: document.getElementById('br-theme').value,
              logoUrl: document.getElementById('br-logo-url').value,
              tagline: document.getElementById('br-tag').value,
              supportEmail: document.getElementById('br-email').value,
              footerText: document.getElementById('br-footer').value,
              noticeBanner: document.getElementById('br-notice').value,
            })),
          });
          setMsg('ok', 'Website identity & logo updated!');
          await MW.loadAdminData();
          await MW.refreshBootstrap();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    }

    // Home Page Builder
    const hpFile = document.getElementById('hp-img-file');
    if (hpFile) {
      hpFile.onchange = async function (e) {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const b64 = await MW.fileToBase64(f);
          const res = await MW.api('/admin/upload', { method: 'POST', body: JSON.stringify({ imageData: b64 }) });
          document.getElementById('hp-img-url').value = res.url;
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    }
    const homeForm = document.getElementById('a-home-form');
    if (homeForm) {
      homeForm.onsubmit = async function (e) {
        e.preventDefault();
        try {
          await MW.api('/admin/settings', {
            method: 'PUT',
            body: JSON.stringify(Object.assign({}, settings, {
              heroKicker: document.getElementById('hp-kicker').value,
              heroTitle: document.getElementById('hp-title').value,
              heroSubtitle: document.getElementById('hp-sub').value,
              heroPrimaryCta: document.getElementById('hp-cta1').value,
              heroSecondaryCta: document.getElementById('hp-cta2').value,
              heroImageUrl: document.getElementById('hp-img-url').value,
              founderName: document.getElementById('hp-fname').value,
              founderRole: document.getElementById('hp-frole').value,
              founderQuote: document.getElementById('hp-fquote').value,
              showStatsStrip: document.getElementById('hp-stats').checked,
              showHowItWorks: document.getElementById('hp-how').checked,
              showBlogSection: document.getElementById('hp-blog').checked,
            })),
          });
          setMsg('ok', 'Home page updated!');
          await MW.loadAdminData();
          await MW.refreshBootstrap();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    }

    // Blog Manager CRUD
    const abCovFile = document.getElementById('ab-cov-file');
    if (abCovFile) {
      abCovFile.onchange = async function (e) {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const b64 = await MW.fileToBase64(f);
          const res = await MW.api('/admin/upload', { method: 'POST', body: JSON.stringify({ imageData: b64 }) });
          document.getElementById('ab-cov-url').value = res.url;
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    }
    mount.querySelectorAll('[data-bl-edit]').forEach(function (b) {
      b.onclick = function () { aState.editingPostId = Number(b.getAttribute('data-bl-edit')); MW.renderAdmin(); };
    });
    const blogCancel = document.getElementById('a-blog-cancel');
    if (blogCancel) blogCancel.onclick = function () { aState.editingPostId = null; MW.renderAdmin(); };
    const blogForm = document.getElementById('a-blog-form');
    if (blogForm) {
      blogForm.onsubmit = async function (e) {
        e.preventDefault();
        const payload = {
          title: document.getElementById('ab-title').value,
          category: document.getElementById('ab-cat').value,
          authorName: document.getElementById('ab-author').value,
          coverImageUrl: document.getElementById('ab-cov-url').value,
          excerpt: document.getElementById('ab-excerpt').value,
          content: document.getElementById('ab-content').value,
          published: document.getElementById('ab-pub').checked,
          featured: document.getElementById('ab-feat').checked,
        };
        try {
          if (aState.editingPostId) {
            await MW.api('/admin/blog/' + aState.editingPostId, { method: 'PUT', body: JSON.stringify(payload) });
            setMsg('ok', 'Blog post updated.');
          } else {
            await MW.api('/admin/blog', { method: 'POST', body: JSON.stringify(payload) });
            setMsg('ok', 'Blog post published.');
          }
          aState.editingPostId = null;
          await MW.loadAdminData();
          await MW.refreshBootstrap();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    }
    mount.querySelectorAll('[data-bl-del]').forEach(function (b) {
      b.onclick = async function () {
        await MW.api('/admin/blog/' + b.getAttribute('data-bl-del'), { method: 'DELETE' });
        await MW.loadAdminData();
        await MW.refreshBootstrap();
        MW.renderAdmin();
      };
    });

    // Pages CMS CRUD
    mount.querySelectorAll('[data-pg-edit]').forEach(function (b) {
      b.onclick = function () { aState.editingPageId = Number(b.getAttribute('data-pg-edit')); MW.renderAdmin(); };
    });
    const pageCancel = document.getElementById('a-page-cancel');
    if (pageCancel) pageCancel.onclick = function () { aState.editingPageId = null; MW.renderAdmin(); };
    const pageForm = document.getElementById('a-page-form');
    if (pageForm) {
      pageForm.onsubmit = async function (e) {
        e.preventDefault();
        const payload = {
          title: document.getElementById('ap-title').value,
          slug: document.getElementById('ap-slug').value,
          summary: document.getElementById('ap-summary').value,
          content: document.getElementById('ap-content').value,
          showInHeader: document.getElementById('ap-hdr').checked,
          showInFooter: document.getElementById('ap-ftr').checked,
          published: document.getElementById('ap-pub').checked,
        };
        try {
          if (aState.editingPageId) {
            await MW.api('/admin/pages/' + aState.editingPageId, { method: 'PUT', body: JSON.stringify(payload) });
            setMsg('ok', 'Page updated.');
          } else {
            await MW.api('/admin/pages', { method: 'POST', body: JSON.stringify(payload) });
            setMsg('ok', 'Page created.');
          }
          aState.editingPageId = null;
          await MW.loadAdminData();
          await MW.refreshBootstrap();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    }
    mount.querySelectorAll('[data-pg-del]').forEach(function (b) {
      b.onclick = async function () {
        await MW.api('/admin/pages/' + b.getAttribute('data-pg-del'), { method: 'DELETE' });
        await MW.loadAdminData();
        await MW.refreshBootstrap();
        MW.renderAdmin();
      };
    });

    // System Controls
    const setForm = document.getElementById('a-set-form');
    if (setForm) {
      setForm.onsubmit = async function (e) {
        e.preventDefault();
        try {
          await MW.api('/admin/settings', {
            method: 'PUT',
            body: JSON.stringify(Object.assign({}, settings, {
              currencySymbol: document.getElementById('st-sym').value,
              platformFeePercent: Number(document.getElementById('st-fee').value),
              referralCommissionPercent: Number(document.getElementById('st-ref').value),
              minWithdrawAmount: Number(document.getElementById('st-minwd').value),
              minJobWorkers: Number(document.getElementById('st-minw').value),
              maintenanceMessage: document.getElementById('st-mmsg').value,
              autoApproveJobs: document.getElementById('st-auto').checked,
              allowRegistration: document.getElementById('st-reg').checked,
              maintenanceMode: document.getElementById('st-maint').checked,
            })),
          });
          setMsg('ok', 'System controls saved.');
          await MW.loadAdminData();
          await MW.refreshBootstrap();
          MW.renderAdmin();
        } catch (err) { setMsg('err', err.message); MW.renderAdmin(); }
      };
    }
  };
})(window.MW);

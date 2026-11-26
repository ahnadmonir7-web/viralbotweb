/**
 * Viral Bolt Admin Panel (Vanilla JS + Bootstrap 5 + Tailwind + PHP/MySQL API)
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
    settings: null,
    userSearch: '',
  };

  MW.loadAdminData = async function () {
    const [ov, jb, ct, dp, wd, us, gw, tk, st] = await Promise.all([
      MW.api('/admin/overview'),
      MW.api('/admin/jobs'),
      MW.api('/admin/categories'),
      MW.api('/admin/deposits'),
      MW.api('/admin/withdrawals'),
      MW.api('/admin/users'),
      MW.api('/admin/gateways'),
      MW.api('/admin/tickets'),
      MW.api('/admin/settings'),
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
  };

  MW.renderAdmin = function () {
    const mount = document.getElementById('view-admin');
    const admin = MW.getCurrentUser();
    const bootstrap = MW.getBootstrap();
    if (!mount || !admin || !bootstrap) return;
    const settings = aState.settings || bootstrap.settings;
    const sym = settings.currencySymbol || '$';

    const navItems = [
      { id: 'overview', label: 'Overview', icon: 'bi-speedometer2' },
      { id: 'jobs', label: 'Manage Jobs', icon: 'bi-briefcase', badge: aState.overview?.pendingJobs },
      { id: 'categories', label: 'Categories', icon: 'bi-layers' },
      { id: 'deposits', label: 'Deposits', icon: 'bi-wallet2', badge: aState.overview?.pendingDeposits },
      { id: 'withdrawals', label: 'Withdrawals', icon: 'bi-credit-card', badge: aState.overview?.pendingWithdrawals },
      { id: 'users', label: 'Users & KYC', icon: 'bi-people' },
      { id: 'gateways', label: 'Gateways', icon: 'bi-bank' },
      { id: 'tickets', label: 'Tickets', icon: 'bi-life-preserver', badge: aState.overview?.openTickets },
      { id: 'settings', label: 'Settings', icon: 'bi-gear' },
    ];

    const sidebarHtml = navItems.map(function (it) {
      const act = aState.tab === it.id;
      return `<button type="button" data-atab="${it.id}" class="mw-sidebar-btn ${act ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}">
        <span><i class="bi ${it.icon} me-2"></i>${it.label}</span>
        ${it.badge ? `<span class="badge bg-danger font-mono">${it.badge}</span>` : ''}
      </button>`;
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
          <div class="col-sm-6 col-lg-3"><div class="mw-card p-4"><div class="small text-secondary fw-semibold">Registered Users</div><div class="font-mono fs-2 fw-bold text-primary mt-1">${ov.totalUsers}</div></div></div>
          <div class="col-sm-6 col-lg-3"><div class="mw-card p-4"><div class="small text-secondary fw-semibold">Pending Jobs</div><div class="font-mono fs-2 fw-bold text-warning mt-1">${ov.pendingJobs}</div></div></div>
          <div class="col-sm-6 col-lg-3"><div class="mw-card p-4"><div class="small text-secondary fw-semibold">Pending Deposits</div><div class="font-mono fs-3 fw-bold text-info mt-1">${ov.pendingDeposits} <span class="fs-6 text-secondary">(${MW.money(ov.pendingDepositsAmount, sym)})</span></div></div></div>
          <div class="col-sm-6 col-lg-3"><div class="mw-card p-4"><div class="small text-secondary fw-semibold">Platform Fee Revenue</div><div class="font-mono fs-2 fw-bold text-success mt-1">${MW.money(ov.platformRevenue, sym)}</div></div></div>
        </div>
        <div class="row g-3">
          <div class="col-md-4"><button type="button" data-atab="jobs" class="mw-card w-100 p-4 text-start"><div class="fw-bold">Review Job Queue</div><div class="small text-secondary mt-1">${ov.pendingJobs} campaigns waiting</div></button></div>
          <div class="col-md-4"><button type="button" data-atab="deposits" class="mw-card w-100 p-4 text-start"><div class="fw-bold">Verify Deposits</div><div class="small text-secondary mt-1">${ov.pendingDeposits} TrxIDs pending</div></button></div>
          <div class="col-md-4"><button type="button" data-atab="withdrawals" class="mw-card w-100 p-4 text-start"><div class="fw-bold">Process Payouts</div><div class="small text-secondary mt-1">${ov.pendingWithdrawals} worker payouts</div></button></div>
        </div>
      `;
    } else if (aState.tab === 'jobs') {
      bodyHtml = `<div class="mw-card overflow-hidden">
        <div class="p-4 border-bottom fw-bold">All Campaigns (${aState.jobs.length})</div>
        <div class="list-group list-group-flush">
          ${aState.jobs.map(function (j) {
            return `<div class="list-group-item p-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div>
                <div class="small text-secondary">#${j.id} · ${MW.esc(j.categoryName)} · By ${MW.esc(j.employerName)} · <strong class="text-uppercase text-primary">${MW.esc(j.status)}</strong></div>
                <div class="fw-bold">${MW.esc(j.title)}</div>
                <div class="font-mono small text-secondary">${j.workersCompleted}/${j.workersNeeded} slots · Budget ${MW.money(j.totalBudget, sym)}</div>
              </div>
              <div class="d-flex flex-wrap gap-2">
                ${j.status === 'pending' ? `<button type="button" data-ajob="${j.id}" data-act="approve" class="btn btn-success btn-sm fw-bold">Approve</button>
                  <button type="button" data-ajob="${j.id}" data-act="reject" class="btn btn-danger btn-sm fw-bold">Reject</button>` : ''}
                <button type="button" data-ajob="${j.id}" data-act="toggle_feature" class="btn btn-sm ${j.featured ? 'btn-warning text-white' : 'btn-outline-secondary'}">${j.featured ? 'Featured' : 'Feature'}</button>
                <button type="button" data-ajob="${j.id}" data-act="delete" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash"></i></button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    } else if (aState.tab === 'categories') {
      bodyHtml = `<div class="row g-4">
        <div class="col-lg-4"><div class="mw-card p-4"><h6 class="fw-bold mb-3">Add Job Category</h6>
          <form id="a-cat-form">
            <input id="ac-name" required placeholder="Category Name" class="form-control mb-2" />
            <div class="row g-2 mb-2">
              <div class="col-6"><select id="ac-color" class="form-select form-select-sm"><option value="indigo">Indigo</option><option value="rose">Rose</option><option value="emerald">Emerald</option><option value="sky">Sky</option><option value="amber">Amber</option><option value="violet">Violet</option></select></div>
              <div class="col-6"><input id="ac-min" type="number" step="0.01" value="0.05" class="form-control form-control-sm font-mono" /></div>
            </div>
            <input id="ac-desc" placeholder="Description" class="form-control mb-3" />
            <button type="submit" class="btn btn-primary w-100 fw-bold">Save Category</button>
          </form>
        </div></div>
        <div class="col-lg-8"><div class="mw-card overflow-hidden"><div class="list-group list-group-flush">
          ${aState.categories.map(function (c) {
            return `<div class="list-group-item p-3 d-flex justify-content-between align-items-center">
              <div><div class="fw-bold">${MW.esc(c.name)}</div><div class="small text-secondary">Min ${MW.reward(c.minCpc, sym)} · ${MW.esc(c.description)}</div></div>
              <div class="d-flex gap-2">
                <button type="button" data-cat-toggle="${c.id}" class="btn btn-sm ${c.active ? 'btn-outline-success' : 'btn-outline-secondary'}">${c.active ? 'Active' : 'Disabled'}</button>
                <button type="button" data-cat-del="${c.id}" class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button>
              </div>
            </div>`;
          }).join('')}
        </div></div></div>
      </div>`;
    } else if (aState.tab === 'deposits') {
      bodyHtml = `<div class="mw-card overflow-hidden"><div class="table-responsive"><table class="table table-hover mb-0 align-middle small">
        <thead class="table-light"><tr><th>User</th><th>Gateway &amp; TrxID</th><th class="text-end">Amount</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
        <tbody>
          ${aState.deposits.map(function (d) {
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
      </table></div></div>`;
    } else if (aState.tab === 'withdrawals') {
      bodyHtml = `<div class="mw-card overflow-hidden"><div class="table-responsive"><table class="table table-hover mb-0 align-middle small">
        <thead class="table-light"><tr><th>Worker</th><th>Gateway &amp; Account</th><th class="text-end">Net Payout</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
        <tbody>
          ${aState.withdrawals.map(function (w) {
            return `<tr>
              <td><div class="fw-bold">${MW.esc(w.userName)}</div><div class="text-secondary">${MW.esc(w.userEmail)}</div></td>
              <td><div>${MW.esc(w.gatewayName)}</div><div class="font-mono text-secondary">${MW.esc(w.accountNumber)}</div></td>
              <td class="text-end font-mono fw-bold">${MW.money(w.netAmount, sym)}<div class="text-secondary fw-normal">Gross ${MW.money(w.amount, sym)}</div></td>
              <td class="fw-bold text-capitalize">${MW.esc(w.status)}</td>
              <td class="text-end">${w.status === 'pending' ? `<button type="button" data-wd-dec="${w.id}" data-val="approved" class="btn btn-success btn-sm me-1">Mark Paid</button><button type="button" data-wd-dec="${w.id}" data-val="rejected" class="btn btn-danger btn-sm">Reject &amp; Refund</button>` : ''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div></div>`;
    } else if (aState.tab === 'users') {
      const q = aState.userSearch.trim().toLowerCase();
      const list = aState.users.filter(function (u) {
        return !q || u.name.toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q) || (u.phone || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      });
      bodyHtml = `
        <div class="mw-card p-3 mb-3"><input id="a-user-search" class="form-control form-control-sm" value="${MW.esc(aState.userSearch)}" placeholder="Search users by name, username, phone, or email..." /></div>
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
              <input type="number" step="0.5" placeholder="+/- $" data-uadj-amt="${u.id}" class="form-control form-control-sm font-mono" style="width:90px;" />
              <select data-uadj-wal="${u.id}" class="form-select form-select-sm" style="width:105px;"><option value="deposit">Deposit</option><option value="earning">Earning</option></select>
              <button type="button" data-uadj-btn="${u.id}" class="btn btn-primary btn-sm">Adjust</button>
              <button type="button" data-uban="${u.id}" data-val="${u.status === 'active' ? 'banned' : 'active'}" class="btn btn-sm ${u.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'}">${u.status === 'active' ? 'Ban' : 'Unban'}</button>
            </div>` : ''}
          </div>`;
        }).join('')}
      `;
    } else if (aState.tab === 'gateways') {
      bodyHtml = `<div class="row g-4">
        <div class="col-lg-4"><div class="mw-card p-4"><h6 class="fw-bold mb-3">Add Payment Gateway</h6>
          <form id="a-gw-form">
            <input id="ag-name" required placeholder="Gateway Name (e.g. Rocket)" class="form-control mb-2" />
            <select id="ag-type" class="form-select mb-2"><option value="both">Deposit &amp; Withdraw</option><option value="deposit">Deposit Only</option><option value="withdraw">Withdraw Only</option></select>
            <input id="ag-acc" required placeholder="Account / Pay ID" class="form-control mb-2" />
            <textarea id="ag-inst" rows="2" placeholder="Instructions" class="form-control mb-2"></textarea>
            <div class="row g-2 mb-3">
              <div class="col-4"><input id="ag-min" type="number" value="2" class="form-control form-control-sm font-mono" placeholder="Min" /></div>
              <div class="col-4"><input id="ag-max" type="number" value="1000" class="form-control form-control-sm font-mono" placeholder="Max" /></div>
              <div class="col-4"><input id="ag-fee" type="number" step="0.5" value="2" class="form-control form-control-sm font-mono" placeholder="Fee %" /></div>
            </div>
            <button type="submit" class="btn btn-primary w-100 fw-bold">Create Gateway</button>
          </form>
        </div></div>
        <div class="col-lg-8"><div class="mw-card overflow-hidden"><div class="list-group list-group-flush">
          ${aState.gateways.map(function (g) {
            return `<div class="list-group-item p-3 d-flex justify-content-between align-items-center">
              <div><div class="fw-bold">${MW.esc(g.name)} (${MW.esc(g.type)})</div><div class="font-mono small text-secondary">${MW.esc(g.accountDetails)}</div><div class="small text-secondary">Min ${MW.money(g.minAmount, sym)} · Max ${MW.money(g.maxAmount, sym)} · Fee ${g.feePercent}%</div></div>
              <div class="d-flex gap-2">
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
          ${(t.replies || []).map(function (r) { return `<div class="rounded p-2 mb-2 small ${r.senderRole === 'admin' ? 'bg-indigo-50' : 'bg-light'}"><strong>${MW.esc(r.senderName)}:</strong> ${MW.esc(r.message)}</div>`; }).join('')}
          <div class="input-group input-group-sm mt-2">
            <input type="text" data-atk-input="${t.id}" class="form-control" placeholder="Reply to user..." />
            <button type="button" data-atk-reply="${t.id}" class="btn btn-primary fw-semibold">Send Reply</button>
          </div>
        </div>`;
      }).join('') || '<div class="mw-card p-4 text-center small text-secondary">No tickets yet.</div>';
    } else if (aState.tab === 'settings') {
      bodyHtml = `<div class="mw-card p-4" style="max-width:720px;"><h5 class="fw-bold mb-3">Marketplace Settings</h5>
        <form id="a-set-form" class="row g-3">
          <div class="col-md-6"><label class="form-label small fw-semibold">Site Name</label><input id="st-name" class="form-control" value="${MW.esc(settings.siteName)}" /></div>
          <div class="col-md-6"><label class="form-label small fw-semibold">Currency Symbol</label><input id="st-sym" class="form-control" value="${MW.esc(settings.currencySymbol)}" /></div>
          <div class="col-md-4"><label class="form-label small fw-semibold">Platform Fee (%)</label><input id="st-fee" type="number" step="0.5" class="form-control font-mono" value="${settings.platformFeePercent}" /></div>
          <div class="col-md-4"><label class="form-label small fw-semibold">Referral (%)</label><input id="st-ref" type="number" step="0.5" class="form-control font-mono" value="${settings.referralCommissionPercent}" /></div>
          <div class="col-md-4"><label class="form-label small fw-semibold">Min Workers</label><input id="st-minw" type="number" class="form-control font-mono" value="${settings.minJobWorkers}" /></div>
          <div class="col-12"><label class="form-label small fw-semibold">Support Email</label><input id="st-email" type="email" class="form-control" value="${MW.esc(settings.supportEmail)}" /></div>
          <div class="col-12"><label class="form-label small fw-semibold">Notice Banner</label><textarea id="st-notice" rows="2" class="form-control">${MW.esc(settings.noticeBanner)}</textarea></div>
          <div class="col-12"><div class="form-check"><input type="checkbox" id="st-auto" class="form-check-input" ${settings.autoApproveJobs ? 'checked' : ''} /><label class="form-check-label small" for="st-auto">Auto-approve employer campaigns immediately</label></div></div>
          <div class="col-12"><button type="submit" class="btn btn-primary fw-bold px-4">Save Settings</button></div>
        </form>
      </div>`;
    }

    mount.innerHTML = `
      <div class="d-flex min-vh-100 bg-slate-100">
        <aside class="d-none d-lg-flex flex-column bg-slate-950 text-white p-3" style="width:260px;">
          <div class="px-3 py-3 border-bottom border-secondary border-opacity-25 mb-3">
            <div class="font-display fw-bolder fs-5">${MW.esc(settings.siteName)} Admin</div>
            <div class="small text-secondary text-truncate">${MW.esc(admin.email)}</div>
          </div>
          <div class="flex-grow-1 d-flex flex-column gap-1">${sidebarHtml}</div>
          <div class="border-top border-secondary border-opacity-25 pt-3 mt-3 d-flex flex-column gap-2">
            <button type="button" id="a-public" class="btn btn-outline-light btn-sm">View Live Site</button>
            <button type="button" id="a-logout" class="btn btn-outline-danger btn-sm">Sign Out</button>
          </div>
        </aside>
        <div class="flex-grow-1 d-flex flex-column min-w-0">
          <header class="bg-white border-bottom px-4 py-3 d-flex justify-content-between align-items-center">
            <div class="fw-bold">${MW.esc(navItems.find(function (n) { return n.id === aState.tab; })?.label || 'Overview')}</div>
            <button type="button" id="a-mobile-out" class="btn btn-outline-danger btn-sm d-lg-none">Sign Out</button>
          </header>
          <div class="d-flex d-lg-none overflow-auto gap-2 p-2 bg-dark">${sidebarHtml}</div>
          <main class="p-4 container-fluid" style="max-width:1180px;">
            ${alertHtml}
            ${bodyHtml}
          </main>
        </div>
      </div>
    `;

    // Bind events
    mount.querySelectorAll('[data-atab]').forEach(function (b) {
      b.onclick = function () { aState.tab = b.getAttribute('data-atab'); aState.msg = null; MW.renderAdmin(); };
    });
    const closeMsg = document.getElementById('a-close-msg');
    if (closeMsg) closeMsg.onclick = function () { aState.msg = null; MW.renderAdmin(); };
    document.getElementById('a-public').onclick = MW.showMarketplace;
    document.getElementById('a-logout').onclick = MW.logout;
    const mobOut = document.getElementById('a-mobile-out');
    if (mobOut) mobOut.onclick = MW.logout;

    mount.querySelectorAll('[data-ajob]').forEach(function (b) {
      b.onclick = async function () {
        await MW.api('/admin/jobs/' + b.getAttribute('data-ajob') + '/decision', {
          method: 'POST',
          body: JSON.stringify({ action: b.getAttribute('data-act'), reason: 'Did not meet guidelines' }),
        });
        await Promise.all([MW.loadAdminData(), MW.refreshBootstrap()]);
        aState.msg = { type: 'ok', text: 'Job updated.' };
        MW.renderAdmin();
      };
    });

    const catForm = document.getElementById('a-cat-form');
    if (catForm) {
      catForm.onsubmit = async function (e) {
        e.preventDefault();
        await MW.api('/admin/categories', {
          method: 'POST',
          body: JSON.stringify({
            name: document.getElementById('ac-name').value,
            color: document.getElementById('ac-color').value,
            minCpc: Number(document.getElementById('ac-min').value),
            description: document.getElementById('ac-desc').value,
          }),
        });
        await Promise.all([MW.loadAdminData(), MW.refreshBootstrap()]);
        aState.msg = { type: 'ok', text: 'Category added.' };
        MW.renderAdmin();
      };
    }

    mount.querySelectorAll('[data-cat-toggle]').forEach(function (b) {
      b.onclick = async function () {
        const c = aState.categories.find(function (x) { return Number(x.id) === Number(b.getAttribute('data-cat-toggle')); });
        await MW.api('/admin/categories/' + c.id, { method: 'PUT', body: JSON.stringify(Object.assign({}, c, { active: !c.active })) });
        await Promise.all([MW.loadAdminData(), MW.refreshBootstrap()]);
        MW.renderAdmin();
      };
    });

    mount.querySelectorAll('[data-cat-del]').forEach(function (b) {
      b.onclick = async function () {
        await MW.api('/admin/categories/' + b.getAttribute('data-cat-del'), { method: 'DELETE' });
        await Promise.all([MW.loadAdminData(), MW.refreshBootstrap()]);
        MW.renderAdmin();
      };
    });

    mount.querySelectorAll('[data-dep-dec]').forEach(function (b) {
      b.onclick = async function () {
        await MW.api('/admin/deposits/' + b.getAttribute('data-dep-dec') + '/decision', { method: 'POST', body: JSON.stringify({ decision: b.getAttribute('data-val') }) });
        await MW.loadAdminData();
        aState.msg = { type: 'ok', text: 'Deposit updated.' };
        MW.renderAdmin();
      };
    });

    mount.querySelectorAll('[data-wd-dec]').forEach(function (b) {
      b.onclick = async function () {
        await MW.api('/admin/withdrawals/' + b.getAttribute('data-wd-dec') + '/decision', { method: 'POST', body: JSON.stringify({ decision: b.getAttribute('data-val') }) });
        await Promise.all([MW.loadAdminData(), MW.refreshBootstrap()]);
        aState.msg = { type: 'ok', text: 'Withdrawal updated.' };
        MW.renderAdmin();
      };
    });

    const uSearch = document.getElementById('a-user-search');
    if (uSearch) {
      uSearch.oninput = function (e) {
        aState.userSearch = e.target.value;
        MW.renderAdmin();
        const f = document.getElementById('a-user-search');
        if (f) { f.focus(); f.setSelectionRange(aState.userSearch.length, aState.userSearch.length); }
      };
    }

    mount.querySelectorAll('[data-ukyc]').forEach(function (b) {
      b.onclick = async function () {
        await MW.api('/admin/users/' + b.getAttribute('data-ukyc') + '/update', { method: 'POST', body: JSON.stringify({ kycStatus: b.getAttribute('data-val') }) });
        await MW.loadAdminData();
        MW.renderAdmin();
      };
    });

    mount.querySelectorAll('[data-uadj-btn]').forEach(function (b) {
      b.onclick = async function () {
        const uid = b.getAttribute('data-uadj-btn');
        const amt = Number(mount.querySelector('[data-uadj-amt="' + uid + '"]').value || 0);
        const wal = mount.querySelector('[data-uadj-wal="' + uid + '"]').value;
        await MW.api('/admin/users/' + uid + '/update', { method: 'POST', body: JSON.stringify({ adjustAmount: amt, adjustWallet: wal }) });
        await MW.loadAdminData();
        aState.msg = { type: 'ok', text: 'Balance adjusted.' };
        MW.renderAdmin();
      };
    });

    mount.querySelectorAll('[data-uban]').forEach(function (b) {
      b.onclick = async function () {
        await MW.api('/admin/users/' + b.getAttribute('data-uban') + '/update', { method: 'POST', body: JSON.stringify({ status: b.getAttribute('data-val') }) });
        await MW.loadAdminData();
        MW.renderAdmin();
      };
    });

    const gwForm = document.getElementById('a-gw-form');
    if (gwForm) {
      gwForm.onsubmit = async function (e) {
        e.preventDefault();
        await MW.api('/admin/gateways', {
          method: 'POST',
          body: JSON.stringify({
            name: document.getElementById('ag-name').value,
            type: document.getElementById('ag-type').value,
            accountDetails: document.getElementById('ag-acc').value,
            instructions: document.getElementById('ag-inst').value,
            minAmount: Number(document.getElementById('ag-min').value),
            maxAmount: Number(document.getElementById('ag-max').value),
            feePercent: Number(document.getElementById('ag-fee').value),
          }),
        });
        await Promise.all([MW.loadAdminData(), MW.refreshBootstrap()]);
        aState.msg = { type: 'ok', text: 'Gateway created.' };
        MW.renderAdmin();
      };
    }

    mount.querySelectorAll('[data-gw-toggle]').forEach(function (b) {
      b.onclick = async function () {
        const g = aState.gateways.find(function (x) { return Number(x.id) === Number(b.getAttribute('data-gw-toggle')); });
        await MW.api('/admin/gateways/' + g.id, { method: 'PUT', body: JSON.stringify(Object.assign({}, g, { active: !g.active })) });
        await Promise.all([MW.loadAdminData(), MW.refreshBootstrap()]);
        MW.renderAdmin();
      };
    });

    mount.querySelectorAll('[data-gw-del]').forEach(function (b) {
      b.onclick = async function () {
        await MW.api('/admin/gateways/' + b.getAttribute('data-gw-del'), { method: 'DELETE' });
        await Promise.all([MW.loadAdminData(), MW.refreshBootstrap()]);
        MW.renderAdmin();
      };
    });

    mount.querySelectorAll('[data-atk-status]').forEach(function (s) {
      s.onchange = async function () {
        await MW.api('/admin/tickets/' + s.getAttribute('data-atk-status') + '/status', { method: 'POST', body: JSON.stringify({ status: s.value }) });
        await MW.loadAdminData();
      };
    });

    mount.querySelectorAll('[data-atk-reply]').forEach(function (b) {
      b.onclick = async function () {
        const tid = b.getAttribute('data-atk-reply');
        const msg = mount.querySelector('[data-atk-input="' + tid + '"]').value.trim();
        if (!msg) return;
        await MW.api('/tickets/' + tid + '/reply', { method: 'POST', body: JSON.stringify({ message: msg }) });
        await MW.loadAdminData();
        MW.renderAdmin();
      };
    });

    const setForm = document.getElementById('a-set-form');
    if (setForm) {
      setForm.onsubmit = async function (e) {
        e.preventDefault();
        await MW.api('/admin/settings', {
          method: 'PUT',
          body: JSON.stringify({
            siteName: document.getElementById('st-name').value,
            currencySymbol: document.getElementById('st-sym').value,
            platformFeePercent: Number(document.getElementById('st-fee').value),
            referralCommissionPercent: Number(document.getElementById('st-ref').value),
            minJobWorkers: Number(document.getElementById('st-minw').value),
            supportEmail: document.getElementById('st-email').value,
            noticeBanner: document.getElementById('st-notice').value,
            autoApproveJobs: document.getElementById('st-auto').checked,
          }),
        });
        await Promise.all([MW.loadAdminData(), MW.refreshBootstrap()]);
        aState.msg = { type: 'ok', text: 'Settings saved.' };
        MW.renderAdmin();
      };
    }
  };
})(window.MW);

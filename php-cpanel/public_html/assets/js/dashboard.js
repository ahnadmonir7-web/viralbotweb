/**
 * Viral Bolt Worker & Employer Unified Dashboard (Vanilla JS + Bootstrap 5 + Tailwind)
 */
window.MW = window.MW || {};

(function (MW) {
  let dState = {
    tab: 'overview',
    walletMode: 'deposit',
    feedback: null,
    myProofs: [],
    myJobs: [],
    deposits: [],
    withdrawals: [],
    transactions: [],
    referredUsers: [],
    tickets: [],
    reviewJob: null,
    reviewProofs: [],
    depShot: '',
    kycDoc: '',
  };

  MW.setDashboardTab = function (tab) {
    dState.tab = tab || 'overview';
  };

  MW.loadDashboardData = async function () {
    const [me, pr, jb, wl, rf, tk] = await Promise.all([
      MW.api('/auth/me'),
      MW.api('/my-proofs'),
      MW.api('/my-jobs'),
      MW.api('/wallet/overview'),
      MW.api('/referrals'),
      MW.api('/tickets'),
    ]);
    MW.setCurrentUser(me.user);
    dState.myProofs = pr.proofs || [];
    dState.myJobs = jb.jobs || [];
    dState.deposits = wl.deposits || [];
    dState.withdrawals = wl.withdrawals || [];
    dState.transactions = wl.transactions || [];
    dState.referredUsers = rf.referredUsers || [];
    dState.tickets = tk.tickets || [];
  };

  MW.renderDashboard = function () {
    const mount = document.getElementById('view-dashboard');
    const user = MW.getCurrentUser();
    const bootstrap = MW.getBootstrap();
    if (!mount || !user || !bootstrap) return;
    const sym = bootstrap.settings.currencySymbol || '$';

    const navItems = [
      { id: 'overview', label: 'Overview', icon: 'bi-speedometer2' },
      { id: 'find-jobs', label: 'Find Jobs', icon: 'bi-search' },
      { id: 'my-work', label: 'My Worked Tasks', icon: 'bi-list-check' },
      { id: 'post-job', label: 'Post a Job', icon: 'bi-plus-circle' },
      { id: 'my-jobs', label: 'My Posted Jobs', icon: 'bi-briefcase' },
      { id: 'wallet', label: 'Wallet & Payouts', icon: 'bi-wallet2' },
      { id: 'referrals', label: 'Referrals', icon: 'bi-people' },
      { id: 'tickets', label: 'Support Tickets', icon: 'bi-life-preserver' },
      { id: 'account', label: 'Account & KYC', icon: 'bi-shield-check' },
    ];

    const sidebarHtml = navItems.map(function (it) {
      const act = dState.tab === it.id;
      return `<button type="button" data-dtab="${it.id}" class="mw-sidebar-btn ${act ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}">
        <span><i class="bi ${it.icon} me-2"></i>${it.label}</span>
      </button>`;
    }).join('');

    const alertHtml = dState.feedback
      ? `<div class="alert alert-${dState.feedback.type === 'ok' ? 'success' : 'danger'} d-flex justify-content-between align-items-center small">
          <span>${MW.esc(dState.feedback.text)}</span>
          <button type="button" id="d-close-fb" class="btn-close btn-sm"></button>
        </div>`
      : '';

    let bodyHtml = '';

    if (dState.tab === 'overview') {
      bodyHtml = `
        ${bootstrap.settings.noticeBanner ? `<div class="rounded-4 p-4 text-white mb-4 shadow-sm" style="background: linear-gradient(90deg,#4f46e5,#7c3aed);"><div class="small opacity-75 fw-semibold">Platform Notice</div><div class="fw-medium mt-1">${MW.esc(bootstrap.settings.noticeBanner)}</div></div>` : ''}
        <div class="row g-3 mb-4">
          <div class="col-sm-6 col-lg-3"><div class="mw-card p-4 bg-emerald-50 border-emerald-200"><div class="small fw-semibold text-success">Earning Balance</div><div class="font-mono fs-3 fw-bold text-dark mt-1">${MW.money(user.earningBalance, sym)}</div><div class="small text-secondary">Withdrawable</div></div></div>
          <div class="col-sm-6 col-lg-3"><div class="mw-card p-4 bg-indigo-50 border-indigo-200"><div class="small fw-semibold text-primary">Deposit Balance</div><div class="font-mono fs-3 fw-bold text-dark mt-1">${MW.money(user.depositBalance, sym)}</div><div class="small text-secondary">Campaign budget</div></div></div>
          <div class="col-sm-6 col-lg-3"><div class="mw-card p-4 bg-sky-50 border-sky-200"><div class="small fw-semibold text-info">Tasks Completed</div><div class="font-mono fs-3 fw-bold text-dark mt-1">${user.tasksCompleted}</div><div class="small text-secondary">Approved proofs</div></div></div>
          <div class="col-sm-6 col-lg-3"><div class="mw-card p-4 bg-amber-50 border-amber-200"><div class="small fw-semibold text-warning">Referral Earnings</div><div class="font-mono fs-3 fw-bold text-dark mt-1">${MW.money(user.referralEarned, sym)}</div><div class="small text-secondary">${dState.referredUsers.length} invited</div></div></div>
        </div>
        <div class="mw-card p-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="fw-bold mb-0">Recent Wallet Transactions</h5>
            <button type="button" data-dtab="wallet" class="btn btn-sm btn-outline-primary">Open Wallet</button>
          </div>
          ${dState.transactions.length === 0 ? '<p class="text-secondary small mb-0">No wallet transactions yet.</p>' : `<div class="list-group list-group-flush">` + dState.transactions.slice(0, 6).map(function (tx) {
            return `<div class="list-group-item px-0 d-flex justify-content-between align-items-center">
              <div><div class="small fw-semibold">${MW.esc(tx.description)}</div><div class="small text-secondary">${tx.wallet} wallet</div></div>
              <span class="font-mono fw-bold ${tx.amount >= 0 ? 'text-success' : 'text-danger'}">${tx.amount >= 0 ? '+' : ''}${MW.money(tx.amount, sym)}</span>
            </div>`;
          }).join('') + `</div>`}
        </div>
      `;
    } else if (dState.tab === 'find-jobs') {
      const avail = (bootstrap.jobs || []).filter(function (j) { return Number(j.employerId) !== Number(user.id); });
      bodyHtml = `<div class="row g-3">` + avail.map(function (job) {
        return `<div class="col-md-6"><div class="mw-card p-4 h-100 d-flex flex-column justify-content-between">
          <div>
            <div class="d-flex justify-content-between small"><span class="fw-bold mw-text-${MW.esc(job.categoryColor)}">${MW.esc(job.categoryName)} · ${MW.esc(job.targetRegion)}</span><span class="font-mono fw-bold text-success">${MW.reward(job.rewardPerWorker, sym)}</span></div>
            <h6 class="fw-bold mt-2">${MW.esc(job.title)}</h6>
          </div>
          <div class="d-flex justify-content-between align-items-center pt-3 border-top mt-3">
            <span class="font-mono small text-secondary">${job.workersCompleted}/${job.workersNeeded} slots</span>
            <button type="button" data-d-open-job="${job.id}" class="btn btn-primary btn-sm fw-bold">Start Task</button>
          </div>
        </div></div>`;
      }).join('') + `</div>`;
    } else if (dState.tab === 'my-work') {
      bodyHtml = `<div class="mw-card overflow-hidden">
        <div class="p-4 border-bottom fw-bold">Submitted Task Proofs</div>
        <div class="table-responsive"><table class="table table-hover mb-0 align-middle small">
          <thead class="table-light"><tr><th>Task</th><th>Proof</th><th class="text-end">Reward</th><th>Status</th></tr></thead>
          <tbody>
            ${dState.myProofs.length === 0 ? '<tr><td colspan="4" class="text-center py-4 text-secondary">No submitted tasks yet.</td></tr>' : dState.myProofs.map(function (p) {
              const cls = p.status === 'approved' ? 'text-success' : p.status === 'rejected' ? 'text-danger' : 'text-warning';
              return `<tr><td class="fw-semibold">${MW.esc(p.jobTitle)}</td><td>${MW.esc(p.proofText)}</td><td class="text-end font-mono fw-bold">${MW.reward(p.rewardAmount, sym)}</td><td class="fw-bold text-capitalize ${cls}">${MW.esc(p.status)}</td></tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>`;
    } else if (dState.tab === 'post-job') {
      const catOpts = (bootstrap.categories || []).map(function (c) {
        return `<option value="${c.id}">${MW.esc(c.name)} (Min ${MW.reward(c.minCpc, sym)})</option>`;
      }).join('');
      bodyHtml = `<div class="mw-card p-4" style="max-width:760px;">
        <h5 class="fw-bold mb-3">Launch a Micro-Job Campaign</h5>
        <form id="d-post-job-form" class="row g-3">
          <div class="col-md-6"><label class="form-label small fw-semibold">Category</label><select id="pj-cat" class="form-select">${catOpts}</select></div>
          <div class="col-md-6"><label class="form-label small fw-semibold">Target Region</label><input id="pj-region" class="form-control" value="Worldwide" /></div>
          <div class="col-12"><label class="form-label small fw-semibold">Campaign Title</label><input id="pj-title" class="form-control" required placeholder="e.g. Watch 2-Min Product Demo & Leave Feedback" /></div>
          <div class="col-12"><label class="form-label small fw-semibold">Target URL (Optional)</label><input id="pj-url" type="url" class="form-control" placeholder="https://..." /></div>
          <div class="col-12"><label class="form-label small fw-semibold">Steps (one per line)</label><textarea id="pj-steps" rows="3" class="form-control" required>Open the target link.&#10;Complete the required step carefully.&#10;Take a screenshot confirming completion.</textarea></div>
          <div class="col-12"><label class="form-label small fw-semibold">Required Proof</label><input id="pj-proof" class="form-control" required value="Submit your username and upload screenshot proof." /></div>
          <div class="col-md-4"><label class="form-label small fw-semibold">Workers Needed (Min ${bootstrap.settings.minJobWorkers})</label><input id="pj-workers" type="number" min="${bootstrap.settings.minJobWorkers}" value="${bootstrap.settings.minJobWorkers}" class="form-control font-mono" /></div>
          <div class="col-md-4"><label class="form-label small fw-semibold">Reward Each (${sym})</label><input id="pj-reward" type="number" step="0.01" min="0.01" value="0.08" class="form-control font-mono" /></div>
          <div class="col-md-4"><label class="form-label small fw-semibold">Est. Minutes</label><input id="pj-mins" type="number" min="1" value="3" class="form-control font-mono" /></div>
          <div class="col-12"><div class="form-check"><input type="checkbox" id="pj-shot" class="form-check-input" checked /><label class="form-check-label small" for="pj-shot">Require screenshot proof</label></div></div>
          <div class="col-12 d-flex justify-content-between align-items-center pt-2 border-top">
            <div class="small text-secondary">Includes ${bootstrap.settings.platformFeePercent}% platform fee · Deposit Balance: <strong class="font-mono text-dark">${MW.money(user.depositBalance, sym)}</strong></div>
            <button type="submit" class="btn btn-primary fw-bold px-4">Launch Campaign</button>
          </div>
        </form>
      </div>`;
    } else if (dState.tab === 'my-jobs') {
      bodyHtml = `<div class="mw-card overflow-hidden mb-4">
        <div class="p-4 border-bottom d-flex justify-content-between align-items-center">
          <span class="fw-bold">My Posted Campaigns</span>
          <button type="button" data-dtab="post-job" class="btn btn-primary btn-sm fw-bold">+ New Job</button>
        </div>
        <div class="list-group list-group-flush">
          ${dState.myJobs.length === 0 ? '<div class="p-4 text-center small text-secondary">No posted jobs yet.</div>' : dState.myJobs.map(function (j) {
            return `<div class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-3 p-4">
              <div>
                <div class="small text-secondary">#${j.id} · ${MW.esc(j.categoryName)} · <strong class="text-uppercase text-primary">${MW.esc(j.status)}</strong></div>
                <div class="fw-bold">${MW.esc(j.title)}</div>
                <div class="font-mono small text-secondary">${j.workersCompleted}/${j.workersNeeded} completed · ${MW.reward(j.rewardPerWorker, sym)}/task</div>
              </div>
              <div class="d-flex gap-2">
                ${(j.status === 'active' || j.status === 'paused') ? `<button type="button" data-toggle-job="${j.id}" data-next="${j.status === 'active' ? 'paused' : 'active'}" class="btn btn-outline-secondary btn-sm">${j.status === 'active' ? 'Pause' : 'Resume'}</button>` : ''}
                <button type="button" data-review-job="${j.id}" class="btn btn-primary btn-sm fw-semibold">Review Proofs</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;

      if (dState.reviewJob) {
        bodyHtml += `<div class="mw-card p-4 border-primary">
          <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
            <h6 class="fw-bold mb-0">Proofs for #${dState.reviewJob.id}: ${MW.esc(dState.reviewJob.title)}</h6>
            <button type="button" id="d-close-review" class="btn-close btn-sm"></button>
          </div>
          ${dState.reviewProofs.length === 0 ? '<p class="small text-secondary mb-0">No worker submissions yet.</p>' : dState.reviewProofs.map(function (p) {
            const shot = MW.safeUrl(p.screenshotUrl);
            return `<div class="border rounded-3 p-3 mb-3 bg-light">
              <div class="d-flex flex-wrap justify-content-between gap-3">
                <div>
                  <div class="small fw-bold">${MW.esc(p.workerName)} · <span class="text-uppercase">${MW.esc(p.status)}</span></div>
                  <p class="small mt-1 mb-2">${MW.esc(p.proofText)}</p>
                  ${shot ? `<a href="${shot}" target="_blank" rel="noopener noreferrer"><img src="${shot}" alt="Proof" class="rounded border" style="max-height:110px;" /></a>` : ''}
                </div>
                ${p.status === 'pending' ? `<div class="d-flex gap-2 align-items-start">
                  <button type="button" data-proof-dec="${p.id}" data-val="approved" class="btn btn-success btn-sm fw-bold">Satisfy</button>
                  <button type="button" data-proof-dec="${p.id}" data-val="rejected" class="btn btn-danger btn-sm fw-bold">Reject</button>
                </div>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>`;
      }
    } else if (dState.tab === 'wallet') {
      const depGws = (bootstrap.gateways || []).filter(function (g) { return g.type !== 'withdraw'; });
      const wdGws = (bootstrap.gateways || []).filter(function (g) { return g.type !== 'deposit'; });
      bodyHtml = `
        <div class="row g-3 mb-4">
          <div class="col-md-6"><div class="mw-card p-4 bg-emerald-50 border-emerald-200"><div class="small fw-semibold text-success">Earning Balance</div><div class="font-mono fs-2 fw-bold">${MW.money(user.earningBalance, sym)}</div></div></div>
          <div class="col-md-6"><div class="mw-card p-4 bg-indigo-50 border-indigo-200"><div class="small fw-semibold text-primary">Deposit Balance</div><div class="font-mono fs-2 fw-bold">${MW.money(user.depositBalance, sym)}</div></div></div>
        </div>
        <div class="mw-card p-4 mb-4">
          <div class="btn-group bg-light p-1 rounded-3 mb-4">
            <button type="button" data-wmode="deposit" class="btn btn-sm fw-bold ${dState.walletMode === 'deposit' ? 'btn-primary' : 'btn-light'}">Deposit</button>
            <button type="button" data-wmode="withdraw" class="btn btn-sm fw-bold ${dState.walletMode === 'withdraw' ? 'btn-primary' : 'btn-light'}">Withdraw</button>
            <button type="button" data-wmode="transfer" class="btn btn-sm fw-bold ${dState.walletMode === 'transfer' ? 'btn-primary' : 'btn-light'}">Earning → Deposit</button>
          </div>
          ${dState.walletMode === 'deposit' ? `<form id="d-dep-form" class="row g-3">
            <div class="col-md-6">
              <label class="form-label small fw-semibold">Gateway</label>
              <select id="dep-gw" class="form-select mb-3">${depGws.map(function (g) { return `<option value="${g.id}">${MW.esc(g.name)} (Min ${MW.money(g.minAmount, sym)})</option>`; }).join('')}</select>
              <label class="form-label small fw-semibold">Amount (${sym})</label>
              <input id="dep-amt" type="number" step="0.01" required value="10" class="form-control font-mono mb-3" />
              <label class="form-label small fw-semibold">Transaction ID (TrxID)</label>
              <input id="dep-trx" required placeholder="e.g. BKH9928172" class="form-control font-mono mb-3" />
              <label class="form-label small fw-semibold">Receipt Screenshot (Optional)</label>
              <input id="dep-shot" type="file" accept="image/png,image/jpeg,image/webp" class="form-control mb-3" />
              <button type="submit" class="btn btn-primary fw-bold">Submit Deposit Request</button>
            </div>
            <div class="col-md-6"><div class="rounded-3 bg-indigo-50 p-4 border border-indigo-200 small">
              <div class="fw-bold mb-2">Gateway Payment Details</div>
              ${depGws.map(function (g) { return `<div class="mb-2"><strong>${MW.esc(g.name)}:</strong><br/><code>${MW.esc(g.accountDetails)}</code><div class="text-secondary">${MW.esc(g.instructions)}</div></div>`; }).join('')}
            </div></div>
          </form>` : dState.walletMode === 'withdraw' ? `<form id="d-wd-form" style="max-width:460px;">
            <div class="mb-3"><label class="form-label small fw-semibold">Payout Gateway</label><select id="wd-gw" class="form-select">${wdGws.map(function (g) { return `<option value="${g.id}">${MW.esc(g.name)} (Fee ${g.feePercent}%)</option>`; }).join('')}</select></div>
            <div class="mb-3"><label class="form-label small fw-semibold">Receiving Account / Wallet</label><input id="wd-acc" required class="form-control" placeholder="017XXXXXXXX / PayPal / TRC20" /></div>
            <div class="mb-3"><label class="form-label small fw-semibold">Amount (${sym})</label><input id="wd-amt" type="number" step="0.01" required value="5" class="form-control font-mono" /></div>
            <button type="submit" class="btn btn-success fw-bold">Request Payout</button>
          </form>` : `<form id="d-tr-form" style="max-width:420px;">
            <p class="small text-secondary">Move Earning Balance to Deposit Balance with 0% fee.</p>
            <div class="mb-3"><label class="form-label small fw-semibold">Amount (${sym})</label><input id="tr-amt" type="number" step="0.1" min="0.5" required value="2" class="form-control font-mono" /></div>
            <button type="submit" class="btn btn-primary fw-bold">Transfer to Deposit Balance</button>
          </form>`}
        </div>
        <div class="row g-3">
          <div class="col-md-6"><div class="mw-card p-4"><h6 class="fw-bold mb-3">Deposits</h6>${dState.deposits.map(function (d) { return `<div class="d-flex justify-content-between small py-2 border-bottom"><span>${MW.esc(d.gatewayName)} (${MW.esc(d.trxId)})</span><strong class="font-mono">${MW.money(d.amount, sym)} · ${MW.esc(d.status)}</strong></div>`; }).join('') || '<p class="small text-secondary mb-0">No deposits.</p>'}</div></div>
          <div class="col-md-6"><div class="mw-card p-4"><h6 class="fw-bold mb-3">Withdrawals</h6>${dState.withdrawals.map(function (w) { return `<div class="d-flex justify-content-between small py-2 border-bottom"><span>${MW.esc(w.gatewayName)} (${MW.esc(w.accountNumber)})</span><strong class="font-mono">${MW.money(w.netAmount, sym)} · ${MW.esc(w.status)}</strong></div>`; }).join('') || '<p class="small text-secondary mb-0">No withdrawals.</p>'}</div></div>
        </div>
      `;
    } else if (dState.tab === 'referrals') {
      const refUrl = window.location.origin + '/?ref=' + user.referralCode;
      bodyHtml = `
        <div class="mw-card p-4 mb-4 bg-amber-50 border-amber-200">
          <h5 class="fw-bold">Earn ${bootstrap.settings.referralCommissionPercent}% Lifetime Referral Commission</h5>
          <p class="small text-secondary">Share your unique link below:</p>
          <div class="d-flex flex-wrap gap-2">
            <code class="bg-white px-3 py-2 rounded border font-mono small">${MW.esc(refUrl)}</code>
            <button type="button" id="d-copy-ref" class="btn btn-warning text-white fw-bold btn-sm">Copy Link</button>
          </div>
        </div>
        <div class="mw-card p-4">
          <h6 class="fw-bold mb-3">Referred Members (${dState.referredUsers.length})</h6>
          ${dState.referredUsers.map(function (r) { return `<div class="d-flex justify-content-between py-2 border-bottom small"><span>${MW.esc(r.name)} (${MW.esc(r.country)})</span><span class="font-mono">${r.tasksCompleted} tasks</span></div>`; }).join('') || '<p class="small text-secondary mb-0">No referred users yet.</p>'}
        </div>
      `;
    } else if (dState.tab === 'tickets') {
      bodyHtml = `<div class="row g-4">
        <div class="col-lg-5"><div class="mw-card p-4"><h6 class="fw-bold mb-3">Open Support Ticket</h6>
          <form id="d-tk-form">
            <input id="tk-sub" required placeholder="Subject" class="form-control mb-2" />
            <div class="row g-2 mb-2">
              <div class="col-6"><select id="tk-cat" class="form-select form-select-sm"><option>Task Dispute</option><option>Deposit / Withdraw</option><option>Account &amp; KYC</option></select></div>
              <div class="col-6"><select id="tk-pri" class="form-select form-select-sm"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select></div>
            </div>
            <textarea id="tk-msg" rows="3" required placeholder="Describe your issue..." class="form-control mb-3"></textarea>
            <button type="submit" class="btn btn-primary w-100 fw-bold">Submit Ticket</button>
          </form>
        </div></div>
        <div class="col-lg-7">
          ${dState.tickets.map(function (t) {
            return `<div class="mw-card p-4 mb-3">
              <div class="d-flex justify-content-between mb-2"><strong>#${t.id} ${MW.esc(t.subject)}</strong><span class="small fw-bold text-primary text-uppercase">${MW.esc(t.status)}</span></div>
              ${(t.replies || []).map(function (r) { return `<div class="rounded p-2 mb-2 small ${r.senderRole === 'admin' ? 'bg-indigo-50' : 'bg-light'}"><strong>${MW.esc(r.senderName)}:</strong> ${MW.esc(r.message)}</div>`; }).join('')}
              <div class="input-group input-group-sm mt-2">
                <input type="text" data-tk-input="${t.id}" class="form-control" placeholder="Write a reply..." />
                <button type="button" data-tk-reply="${t.id}" class="btn btn-primary fw-semibold">Reply</button>
              </div>
            </div>`;
          }).join('') || '<div class="mw-card p-4 text-center small text-secondary">No tickets yet.</div>'}
        </div>
      </div>`;
    } else if (dState.tab === 'account') {
      bodyHtml = `<div class="row g-4">
        <div class="col-md-6"><div class="mw-card p-4"><h6 class="fw-bold mb-3">Profile</h6><form id="d-prof-form">
          <label class="form-label small fw-semibold">User Name</label><input readonly class="form-control mb-2 bg-light" value="@${MW.esc(user.username || user.name)}" />
          <label class="form-label small fw-semibold">Full Name</label><input id="pf-name" class="form-control mb-2" value="${MW.esc(user.name)}" />
          <label class="form-label small fw-semibold">Phone Number</label><input id="pf-phone" type="tel" class="form-control mb-2" value="${MW.esc(user.phone || '')}" />
          <label class="form-label small fw-semibold">Country</label><input id="pf-country" class="form-control mb-3" value="${MW.esc(user.country)}" />
          <button type="submit" class="btn btn-primary btn-sm fw-bold">Save Profile</button>
        </form></div></div>
        <div class="col-md-6"><div class="mw-card p-4"><h6 class="fw-bold mb-3">Change Password</h6><form id="d-pass-form">
          <input id="pw-cur" type="password" required placeholder="Current Password" class="form-control mb-2" />
          <input id="pw-new" type="password" required minlength="6" placeholder="New Password" class="form-control mb-3" />
          <button type="submit" class="btn btn-dark btn-sm fw-bold">Update Password</button>
        </form></div></div>
        <div class="col-12"><div class="mw-card p-4"><h6 class="fw-bold mb-1">Identity Verification (KYC) — <span class="text-uppercase text-primary">${MW.esc(user.kycStatus)}</span></h6>
          ${user.kycStatus !== 'verified' ? `<form id="d-kyc-form" class="row g-2 mt-2">
            <div class="col-md-5"><input id="kyc-file" type="file" accept="image/png,image/jpeg,image/webp" required class="form-control form-control-sm" /></div>
            <div class="col-md-5"><input id="kyc-note" placeholder="ID number / note" class="form-control form-control-sm" /></div>
            <div class="col-md-2"><button type="submit" class="btn btn-success btn-sm w-100 fw-bold">Upload KYC</button></div>
          </form>` : '<p class="small text-success mb-0 mt-2">Your identity is verified.</p>'}
        </div></div>
      </div>`;
    }

    mount.innerHTML = `
      <div class="d-flex min-vh-100">
        <aside class="d-none d-lg-flex flex-column bg-white border-end p-3" style="width:260px;">
          <div class="px-3 py-3 border-bottom mb-3">
            <button type="button" id="d-brand" class="btn btn-link p-0 font-display fw-bolder text-indigo-700 fs-4 text-decoration-none">${MW.esc(bootstrap.settings.siteName)}</button>
          </div>
          <div class="flex-grow-1 d-flex flex-column gap-1">${sidebarHtml}</div>
          <div class="border-top pt-3 mt-3 d-flex flex-column gap-2">
            <button type="button" id="d-public" class="btn btn-outline-secondary btn-sm fw-semibold">Public Marketplace</button>
            <button type="button" id="d-logout" class="btn btn-outline-danger btn-sm fw-semibold">Sign Out</button>
          </div>
        </aside>
        <div class="flex-grow-1 d-flex flex-column min-w-0">
          <header class="bg-white border-bottom px-4 py-3 d-flex justify-content-between align-items-center">
            <div class="small fw-semibold text-secondary">Workspace / <span class="text-dark">${MW.esc(navItems.find(function (n) { return n.id === dState.tab; })?.label || 'Overview')}</span></div>
            <div class="d-flex align-items-center gap-3 small">
              <span class="d-none d-sm-inline">Earning: <strong class="font-mono text-success">${MW.money(user.earningBalance, sym)}</strong> · Deposit: <strong class="font-mono text-primary">${MW.money(user.depositBalance, sym)}</strong></span>
              <button type="button" data-dtab="post-job" class="btn btn-primary btn-sm fw-bold">+ Post Job</button>
              <button type="button" id="d-mobile-logout" class="btn btn-outline-danger btn-sm d-lg-none">Sign Out</button>
            </div>
          </header>
          <div class="d-flex d-lg-none overflow-auto gap-2 p-2 bg-white border-bottom">${sidebarHtml}</div>
          <main class="p-4 container-fluid" style="max-width:1180px;">
            ${alertHtml}
            ${bodyHtml}
          </main>
        </div>
      </div>
    `;

    // Bind events
    mount.querySelectorAll('[data-dtab]').forEach(function (b) {
      b.onclick = function () { dState.tab = b.getAttribute('data-dtab'); dState.feedback = null; MW.renderDashboard(); };
    });
    const closeFb = document.getElementById('d-close-fb');
    if (closeFb) closeFb.onclick = function () { dState.feedback = null; MW.renderDashboard(); };
    document.getElementById('d-brand').onclick = MW.showMarketplace;
    document.getElementById('d-public').onclick = MW.showMarketplace;
    document.getElementById('d-logout').onclick = MW.logout;
    const mobOut = document.getElementById('d-mobile-logout');
    if (mobOut) mobOut.onclick = MW.logout;

    mount.querySelectorAll('[data-d-open-job]').forEach(function (b) {
      b.onclick = function () {
        const j = (bootstrap.jobs || []).find(function (x) { return Number(x.id) === Number(b.getAttribute('data-d-open-job')); });
        if (j) MW.openTaskModal(j);
      };
    });

    const pjForm = document.getElementById('d-post-job-form');
    if (pjForm) {
      pjForm.onsubmit = async function (e) {
        e.preventDefault();
        try {
          const res = await MW.api('/jobs', {
            method: 'POST',
            body: JSON.stringify({
              categoryId: Number(document.getElementById('pj-cat').value),
              targetRegion: document.getElementById('pj-region').value,
              title: document.getElementById('pj-title').value,
              targetUrl: document.getElementById('pj-url').value,
              steps: document.getElementById('pj-steps').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
              proofRequirement: document.getElementById('pj-proof').value,
              workersNeeded: Number(document.getElementById('pj-workers').value),
              rewardPerWorker: Number(document.getElementById('pj-reward').value),
              estimatedMinutes: Number(document.getElementById('pj-mins').value),
              requireScreenshot: document.getElementById('pj-shot').checked,
            }),
          });
          MW.setCurrentUser(res.user);
          await Promise.all([MW.loadDashboardData(), MW.refreshBootstrap()]);
          dState.tab = 'my-jobs';
          dState.feedback = { type: 'ok', text: 'Campaign submitted successfully!' };
          MW.renderDashboard();
        } catch (err) {
          dState.feedback = { type: 'err', text: err.message };
          MW.renderDashboard();
        }
      };
    }

    mount.querySelectorAll('[data-toggle-job]').forEach(function (b) {
      b.onclick = async function () {
        await MW.api('/jobs/' + b.getAttribute('data-toggle-job') + '/status', { method: 'PATCH', body: JSON.stringify({ status: b.getAttribute('data-next') }) });
        await Promise.all([MW.loadDashboardData(), MW.refreshBootstrap()]);
        MW.renderDashboard();
      };
    });

    mount.querySelectorAll('[data-review-job]').forEach(function (b) {
      b.onclick = async function () {
        const jid = Number(b.getAttribute('data-review-job'));
        dState.reviewJob = dState.myJobs.find(function (j) { return Number(j.id) === jid; });
        const pr = await MW.api('/jobs/' + jid + '/proofs');
        dState.reviewProofs = pr.proofs || [];
        MW.renderDashboard();
      };
    });

    const closeRev = document.getElementById('d-close-review');
    if (closeRev) closeRev.onclick = function () { dState.reviewJob = null; MW.renderDashboard(); };

    mount.querySelectorAll('[data-proof-dec]').forEach(function (b) {
      b.onclick = async function () {
        await MW.api('/proofs/' + b.getAttribute('data-proof-dec') + '/review', {
          method: 'POST',
          body: JSON.stringify({ decision: b.getAttribute('data-val') }),
        });
        const pr = await MW.api('/jobs/' + dState.reviewJob.id + '/proofs');
        dState.reviewProofs = pr.proofs || [];
        await Promise.all([MW.loadDashboardData(), MW.refreshBootstrap()]);
        MW.renderDashboard();
      };
    });

    mount.querySelectorAll('[data-wmode]').forEach(function (b) {
      b.onclick = function () { dState.walletMode = b.getAttribute('data-wmode'); MW.renderDashboard(); };
    });

    const depShotInput = document.getElementById('dep-shot');
    if (depShotInput) {
      depShotInput.onchange = async function (e) { dState.depShot = await MW.fileToBase64(e.target.files[0]); };
    }
    const depForm = document.getElementById('d-dep-form');
    if (depForm) {
      depForm.onsubmit = async function (e) {
        e.preventDefault();
        try {
          await MW.api('/wallet/deposit', {
            method: 'POST',
            body: JSON.stringify({
              gatewayId: Number(document.getElementById('dep-gw').value),
              amount: Number(document.getElementById('dep-amt').value),
              trxId: document.getElementById('dep-trx').value,
              screenshotData: dState.depShot,
            }),
          });
          dState.depShot = '';
          dState.feedback = { type: 'ok', text: 'Deposit submitted for Admin approval.' };
          await MW.loadDashboardData();
          MW.renderDashboard();
        } catch (err) { dState.feedback = { type: 'err', text: err.message }; MW.renderDashboard(); }
      };
    }

    const wdForm = document.getElementById('d-wd-form');
    if (wdForm) {
      wdForm.onsubmit = async function (e) {
        e.preventDefault();
        try {
          const res = await MW.api('/wallet/withdraw', {
            method: 'POST',
            body: JSON.stringify({
              gatewayId: Number(document.getElementById('wd-gw').value),
              accountNumber: document.getElementById('wd-acc').value,
              amount: Number(document.getElementById('wd-amt').value),
            }),
          });
          MW.setCurrentUser(res.user);
          dState.feedback = { type: 'ok', text: 'Withdrawal request placed in payout queue.' };
          await MW.loadDashboardData();
          MW.renderDashboard();
        } catch (err) { dState.feedback = { type: 'err', text: err.message }; MW.renderDashboard(); }
      };
    }

    const trForm = document.getElementById('d-tr-form');
    if (trForm) {
      trForm.onsubmit = async function (e) {
        e.preventDefault();
        try {
          const res = await MW.api('/wallet/transfer', { method: 'POST', body: JSON.stringify({ amount: Number(document.getElementById('tr-amt').value) }) });
          MW.setCurrentUser(res.user);
          dState.feedback = { type: 'ok', text: 'Transferred Earning Balance to Deposit Balance.' };
          await MW.loadDashboardData();
          MW.renderDashboard();
        } catch (err) { dState.feedback = { type: 'err', text: err.message }; MW.renderDashboard(); }
      };
    }

    const copyRef = document.getElementById('d-copy-ref');
    if (copyRef) {
      copyRef.onclick = function () {
        navigator.clipboard?.writeText(window.location.origin + '/?ref=' + user.referralCode);
        dState.feedback = { type: 'ok', text: 'Referral link copied!' };
        MW.renderDashboard();
      };
    }

    const tkForm = document.getElementById('d-tk-form');
    if (tkForm) {
      tkForm.onsubmit = async function (e) {
        e.preventDefault();
        try {
          await MW.api('/tickets', {
            method: 'POST',
            body: JSON.stringify({
              subject: document.getElementById('tk-sub').value,
              category: document.getElementById('tk-cat').value,
              priority: document.getElementById('tk-pri').value,
              message: document.getElementById('tk-msg').value,
            }),
          });
          dState.feedback = { type: 'ok', text: 'Support ticket created.' };
          await MW.loadDashboardData();
          MW.renderDashboard();
        } catch (err) { dState.feedback = { type: 'err', text: err.message }; MW.renderDashboard(); }
      };
    }

    mount.querySelectorAll('[data-tk-reply]').forEach(function (b) {
      b.onclick = async function () {
        const tid = b.getAttribute('data-tk-reply');
        const msg = mount.querySelector('[data-tk-input="' + tid + '"]').value.trim();
        if (!msg) return;
        await MW.api('/tickets/' + tid + '/reply', { method: 'POST', body: JSON.stringify({ message: msg }) });
        await MW.loadDashboardData();
        MW.renderDashboard();
      };
    });

    const profForm = document.getElementById('d-prof-form');
    if (profForm) {
      profForm.onsubmit = async function (e) {
        e.preventDefault();
        try {
          const res = await MW.api('/auth/profile', {
            method: 'POST',
            body: JSON.stringify({
              name: document.getElementById('pf-name').value,
              phone: document.getElementById('pf-phone').value,
              country: document.getElementById('pf-country').value,
            }),
          });
          MW.setCurrentUser(res.user);
          dState.feedback = { type: 'ok', text: 'Profile updated.' };
          MW.renderDashboard();
        } catch (err) { dState.feedback = { type: 'err', text: err.message }; MW.renderDashboard(); }
      };
    }

    const passForm = document.getElementById('d-pass-form');
    if (passForm) {
      passForm.onsubmit = async function (e) {
        e.preventDefault();
        try {
          await MW.api('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: document.getElementById('pw-cur').value, newPassword: document.getElementById('pw-new').value }) });
          dState.feedback = { type: 'ok', text: 'Password updated.' };
          MW.renderDashboard();
        } catch (err) { dState.feedback = { type: 'err', text: err.message }; MW.renderDashboard(); }
      };
    }

    const kycFile = document.getElementById('kyc-file');
    if (kycFile) {
      kycFile.onchange = async function (e) { dState.kycDoc = await MW.fileToBase64(e.target.files[0]); };
    }
    const kycForm = document.getElementById('d-kyc-form');
    if (kycForm) {
      kycForm.onsubmit = async function (e) {
        e.preventDefault();
        try {
          const res = await MW.api('/kyc', { method: 'POST', body: JSON.stringify({ documentData: dState.kycDoc, note: document.getElementById('kyc-note').value }) });
          MW.setCurrentUser(res.user);
          dState.feedback = { type: 'ok', text: 'KYC uploaded for Admin verification.' };
          MW.renderDashboard();
        } catch (err) { dState.feedback = { type: 'err', text: err.message }; MW.renderDashboard(); }
      };
    }
  };
})(window.MW);

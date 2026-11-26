/**
 * Viral Bolt Application Controller (Bootstrap + Tailwind + PHP/MySQL)
 */
window.MW = window.MW || {};

(function (MW) {
  let bootstrapData = null;
  let currentUser = null;

  MW.getBootstrap = function () { return bootstrapData; };
  MW.getCurrentUser = function () { return currentUser; };
  MW.setCurrentUser = function (u) { currentUser = u; };

  MW.refreshBootstrap = async function () {
    bootstrapData = await MW.api('/bootstrap');
    MW.renderMarketplace(bootstrapData, currentUser);
  };

  MW.showMarketplace = function () {
    document.getElementById('view-marketplace').classList.remove('d-none');
    document.getElementById('view-dashboard').classList.add('d-none');
    document.getElementById('view-admin').classList.add('d-none');
    MW.renderMarketplace(bootstrapData, currentUser);
  };

  MW.openWorkspace = async function (tab) {
    if (!currentUser) {
      MW.openAuthModal('login');
      return;
    }
    if (currentUser.role === 'admin') {
      document.getElementById('view-marketplace').classList.add('d-none');
      document.getElementById('view-dashboard').classList.add('d-none');
      document.getElementById('view-admin').classList.remove('d-none');
      await MW.loadAdminData();
      MW.renderAdmin();
    } else {
      if (tab) MW.setDashboardTab(tab);
      document.getElementById('view-marketplace').classList.add('d-none');
      document.getElementById('view-admin').classList.add('d-none');
      document.getElementById('view-dashboard').classList.remove('d-none');
      await MW.loadDashboardData();
      MW.renderDashboard();
    }
  };

  MW.onAuthSuccess = function (user) {
    currentUser = user;
    MW.openWorkspace();
  };

  MW.logout = function () {
    MW.setToken(null);
    currentUser = null;
    MW.showMarketplace();
  };

  document.addEventListener('DOMContentLoaded', async function () {
    MW.initModals();
    try {
      await MW.refreshBootstrap();
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref) {
        document.getElementById('auth-ref').value = ref.toUpperCase();
        MW.openAuthModal('register');
      }
    } catch (err) {
      document.getElementById('view-marketplace').innerHTML =
        '<div class="container py-5 text-center"><div class="alert alert-danger d-inline-block">Unable to connect to PHP/MySQL API: ' +
        MW.esc(err.message) + '</div></div>';
    }
  });
})(window.MW);

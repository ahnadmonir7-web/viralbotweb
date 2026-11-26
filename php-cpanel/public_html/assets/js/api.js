/**
 * Viral Bolt Shared API & Security Utilities (Vanilla JavaScript ES6)
 * Keeps Bearer auth token strictly in JS memory.
 */
window.MW = window.MW || {};

(function (MW) {
  let authToken = null;

  MW.setToken = function (token) {
    authToken = token || null;
  };

  MW.getToken = function () {
    return authToken;
  };

  MW.esc = function (str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  };

  MW.safeUrl = function (url) {
    const raw = String(url || '').trim();
    if (raw.startsWith('https://') || raw.startsWith('http://') || raw.startsWith('/uploads/')) {
      return raw;
    }
    return '';
  };

  MW.money = function (val, sym) {
    return (sym || '$') + Number(val || 0).toFixed(2);
  };

  MW.reward = function (val, sym) {
    return (sym || '$') + Number(val || 0).toFixed(3).replace(/0$/, '');
  };

  MW.api = async function (path, options) {
    const opts = options || {};
    const headers = new Headers(opts.headers || {});
    if (!headers.has('Content-Type') && opts.body) {
      headers.set('Content-Type', 'application/json');
    }
    if (authToken) {
      headers.set('Authorization', 'Bearer ' + authToken);
    }

    const res = await fetch('/api' + path, Object.assign({}, opts, { headers: headers }));
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_e) {
      data = { error: text || 'Invalid server response' };
    }

    if (!res.ok) {
      throw new Error(data.error || 'Request failed (' + res.status + ')');
    }
    return data;
  };

  MW.fileToBase64 = function (file) {
    return new Promise(function (resolve, reject) {
      if (!file) return resolve('');
      if (file.size > 1.8 * 1024 * 1024) {
        return reject(new Error('Image must be smaller than 1.8 MB.'));
      }
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('Failed to read image file.')); };
      reader.readAsDataURL(file);
    });
  };
})(window.MW);

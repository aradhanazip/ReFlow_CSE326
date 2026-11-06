/* ReFlow shared data layer: one LocalStorage store used by both portals. Demo only, not secure auth. */
const RF = (() => {
  const KEY = 'reflow_v1';
  const SES = 'reflow_session';
  const DAY = 864e5;
  const DEFAULT_CUSTOMER = {
    id: 'C1',
    name: 'Nobita',
    email: 'nobita@gmail.com',
    pass: 'Nobita@123',
  };
  const DEFAULT_ADMIN = { name: 'Admin', email: 'admin@reflow.com', pass: 'Admin@123' };

  // Allowed state transitions: admins cannot skip stages.
  const T = {
    SUBMITTED: ['APPROVED', 'REJECTED'],
    APPROVED: ['SHIPPED'],
    SHIPPED: ['RECEIVED'],
    RECEIVED: ['INSPECTION_PASSED', 'INSPECTION_FAILED'],
    INSPECTION_PASSED: ['REFUND_INITIATED'],
    REFUND_INITIATED: ['REFUND_COMPLETED'],
  };
  const MSG = {
    APPROVED: 'Your return was approved. Please ship the product.',
    REJECTED: 'Your return request was rejected.',
    SHIPPED: 'Your product is marked as shipped.',
    RECEIVED: 'We received your product.',
    INSPECTION_PASSED: 'Inspection completed: passed.',
    INSPECTION_FAILED: 'Inspection completed: failed.',
    REFUND_INITIATED: 'Your (simulated) refund has been initiated.',
    REFUND_COMPLETED: 'Your (simulated) refund is completed.',
  };

  const seed = () => {
    const n = Date.now();
    const ago = (days) => n - days * DAY;
    const P = [
      ['Wireless Earbuds', 'Electronics', 2499],
      ['Running Shoes', 'Footwear', 3999],
      ['Cotton Kurta', 'Apparel', 1299],
      ['Smart Watch', 'Electronics', 5999],
      ['Steel Water Bottle', 'Home', 699],
      ['Backpack', 'Accessories', 1899],
    ];
    const orders = P.map((product, i) => ({
      id: 'ORD-' + (1001 + i),
      cid: 'C1',
      name: product[0],
      cat: product[1],
      price: product[2],
      qty: i == 4 ? 2 : 1,
      pay: 'UPI',
      deliveredAt: ago([2, 4, 12, 6, 1, 9][i]),
      returnId: null,
    }));

    return {
      customers: [
        { ...DEFAULT_CUSTOMER },
      ],
      admin: { ...DEFAULT_ADMIN },
      policy: { windowDays: 10 },
      orders,
      returns: [],
      refunds: [],
      notes: [],
      seq: 123,
    };
  };

  const load = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      if (v && Array.isArray(v.orders) && Array.isArray(v.returns)) {
        const customers = Array.isArray(v.customers) ? v.customers : [];
        const customer = customers.find((item) => item.id === DEFAULT_CUSTOMER.id);
        if (customer) Object.assign(customer, DEFAULT_CUSTOMER);
        else customers.push({ ...DEFAULT_CUSTOMER });
        v.customers = customers;
        v.admin = { ...v.admin, ...DEFAULT_ADMIN };
        localStorage.setItem(KEY, JSON.stringify(v));
        return v;
      }
    } catch (e) {}

    const s = seed();
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  };

  let db = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));

  addEventListener('storage', (event) => {
    if (event.key === KEY) {
      db = load();
      window.onRFSync && window.onRFSync();
    }
  });

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const money = (n) => '₹' + Number(n).toLocaleString('en-IN');
  const date = (t) => new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const badge = (s) =>
    `<span class="b ${esc(s)}">${esc(String(s).replace(/_/g, ' '))}</span>`;
  const notify = (to, msg) =>
    db.notes.unshift({
      id: 'N' + Date.now() + Math.random().toString(36).slice(2, 5),
      to,
      msg,
      t: Date.now(),
      read: false,
    });

  const why = (o) => {
    if (o.returnId) return 'Return ' + o.returnId + ' already exists';
    if (!o.deliveredAt) return 'Not delivered yet';
    if ((Date.now() - o.deliveredAt) / DAY > db.policy.windowDays) {
      return 'Return window (' + db.policy.windowDays + ' days) expired';
    }
    return '';
  };

  const submit = (oid, reason, desc, res, ev = 0) => {
    const o = db.orders.find((order) => order.id === oid);
    if (!o || why(o)) throw Error(o ? why(o) : 'Order not found');

    const id = 'RET-2026-' + String(++db.seq).padStart(5, '0');
    db.returns.unshift({
      id,
      oid,
      cid: o.cid,
      name: o.name,
      price: o.price * o.qty,
      reason,
      desc,
      res,
      ev,
      status: 'SUBMITTED',
      windowDays: db.policy.windowDays,
      hist: [{ s: 'SUBMITTED', t: Date.now(), note: 'Request submitted' }],
    });
    o.returnId = id;
    notify(o.cid, 'Return ' + id + ' submitted.');
    notify('admin', 'New return request ' + id + ' for ' + o.name);
    save();
    return id;
  };

  const move = (id, to, note, deduction) => {
    const r = db.returns.find((item) => item.id === id);
    if (!r) throw Error('Return not found');
    if (!(T[r.status] || []).includes(to)) {
      throw Error('Cannot move from ' + r.status + ' to ' + to);
    }
    if (to === 'REJECTED' && !String(note || '').trim()) {
      throw Error('A rejection reason is required');
    }

    r.status = to;
    r.hist.push({ s: to, t: Date.now(), note: note || '' });
    if (to === 'REFUND_INITIATED') {
      const d = Math.max(0, Math.min(+deduction || 0, r.price));
      db.refunds.unshift({
        id: 'RFD-' + r.id.slice(-5),
        rid: r.id,
        cid: r.cid,
        name: r.name,
        price: r.price,
        ded: d,
        amount: r.price - d,
        method: 'Original payment method (simulated)',
        status: 'Processing',
        startedAt: Date.now(),
        doneAt: null,
      });
    }
    if (to === 'REFUND_COMPLETED') {
      const f = db.refunds.find((refund) => refund.rid === r.id);
      f.status = 'Completed';
      f.doneAt = Date.now();
    }

    notify(r.cid, r.id + ': ' + MSG[to] + (to === 'REJECTED' ? ' Reason: ' + note : ''));
    save();
  };

  const login = (role, email, pass) => {
    let u =
      role === 'admin'
        ? db.admin.email === email && db.admin.pass === pass && { id: 'admin' }
        : db.customers.find((customer) => customer.email === email && customer.pass === pass);
    if (!u) return false;

    sessionStorage.setItem(SES, JSON.stringify({ role, id: u.id, name: u.name || 'Admin' }));
    return true;
  };

  const session = () => {
    try {
      return JSON.parse(sessionStorage.getItem(SES));
    } catch (e) {
      return null;
    }
  };

  const guard = (role) => {
    const s = session();
    if (!s || s.role !== role) location.replace('index.html');
    return s;
  };
  const logout = () => {
    sessionStorage.removeItem(SES);
    location.href = 'index.html';
  };
  const toast = (m) => {
    const t = document.getElementById('toast');
    t.textContent = m;
    t.style.display = 'block';
    clearTimeout(toast.h);
    toast.h = setTimeout(() => (t.style.display = 'none'), 2800);
  };

  // Evidence files live in IndexedDB (too big for LocalStorage), linked to a return by its ID.
  const idb = () =>
    new Promise((ok, no) => {
      const r = indexedDB.open('reflow_evidence', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'id' });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });

  const putEv = async (rid, files) => {
    const d = await idb();
    return new Promise((ok, no) => {
      const tx = d.transaction('files', 'readwrite');
      files.forEach((file, i) =>
        tx.objectStore('files').put({
          id: rid + '#' + i,
          rid,
          name: file.name,
          type: file.type,
          blob: file,
        }),
      );
      tx.oncomplete = ok;
      tx.onerror = () => no(tx.error);
    });
  };

  const getEv = async (rid) => {
    const d = await idb();
    return new Promise((ok, no) => {
      const q = d.transaction('files').objectStore('files').getAll();
      q.onsuccess = () => ok(q.result.filter((item) => item.rid === rid));
      q.onerror = () => no(q.error);
    });
  };

  return {
    get db() {
      return db;
    },
    save,
    putEv,
    getEv,
    T,
    esc,
    money,
    date,
    badge,
    why,
    submit,
    move,
    login,
    session,
    guard,
    logout,
    toast,
    reset: () => {
      localStorage.removeItem(KEY);
      indexedDB.deleteDatabase('reflow_evidence');
      db = load();
    },
  };
})();

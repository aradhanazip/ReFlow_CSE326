(() => {
  const { esc, money, date, badge } = RF;
  const ses = RF.guard('customer');
  const cid = ses && ses.id;
  const $ = (selector) => document.querySelector(selector);
  const V = {
    overview: 'Overview',
    orders: 'My Orders',
    return: 'Initiate a Return',
    tracking: 'Track My Returns',
    refunds: 'Refund History',
    notifications: 'Notifications',
  };
  const REASONS = [
    'Product damaged during delivery',
    'Defective or malfunctioning product',
    'Wrong product delivered',
    'Missing accessories or components',
    'Product does not match the description',
    'Product quality dissatisfaction',
    'Changed mind',
    'Other',
  ];
  const STAGES = [
    'SUBMITTED',
    'APPROVED',
    'SHIPPED',
    'RECEIVED',
    'INSPECTION_PASSED',
    'REFUND_INITIATED',
    'REFUND_COMPLETED',
  ];
  let pre = '';
  let q = '';
  let files = [];
  const my = (key) => RF.db[key].filter((item) => item.cid === cid);
  const notes = () => RF.db.notes.filter((item) => item.to === cid);
  const empty = (message) => `<div class="card">${message}</div>`;

  const views = {
    overview() {
      const r = my('returns');
      const f = my('refunds');

      return `
        <h2>Welcome, ${esc(ses.name)}</h2>
        <div class="cards">
          <div class="card"><b>${my('orders').length}</b><span>Total orders</span></div>
          <div class="card"><b>${r.filter((item) => !['REJECTED', 'INSPECTION_FAILED', 'REFUND_COMPLETED'].includes(item.status)).length}</b><span>Active returns</span></div>
          <div class="card"><b>${f.filter((item) => item.status === 'Processing').length}</b><span>Pending refunds</span></div>
          <div class="card"><b>${money(f.filter((item) => item.status === 'Completed').reduce((total, item) => total + item.amount, 0))}</b><span>Refunded (simulated)</span></div>
        </div>
        <div class="card">
          <h3>Return policy</h3>
          <p>Products can be returned within ${RF.db.policy.windowDays} days of delivery, once per order.</p>
          <button class="btn" data-go="return">Start a return</button>
        </div>
        <h3>Recent notifications</h3>
        ${
          notes()
            .slice(0, 3)
            .map(
              (item) => `
                <div class="note">
                  ${esc(item.msg)}<br>
                  <small>${date(item.t)}</small>
                </div>`,
            )
            .join('') || empty('No notifications yet.')
        }`;
    },

    orders() {
      const rows = my('orders').filter((order) =>
        (order.id + order.name).toLowerCase().includes(q.toLowerCase()),
      );

      return `
        <h2>My Orders</h2>
        <input
          id="q"
          placeholder="Search by order ID or product"
          value="${esc(q)}"
          aria-label="Search orders"
        >
        <div class="tw">
          <table>
            <tr>
              <th>Order</th>
              <th>Product</th>
              <th>Price</th>
              <th>Delivered</th>
              <th>Return eligibility</th>
              <th></th>
            </tr>
            ${rows
              .map(
                (order) => `
                  <tr>
                    <td>${order.id}</td>
                    <td>${esc(order.name)}<br><small>${order.cat}, qty ${order.qty}, ${order.pay}</small></td>
                    <td>${money(order.price * order.qty)}</td>
                    <td>${date(order.deliveredAt)}</td>
                    <td>${esc(RF.why(order) || 'Eligible')}</td>
                    <td>
                      ${
                        RF.why(order)
                          ? ''
                          : `<button class="btn sm" data-act="start" data-id="${order.id}">Request Return</button>`
                      }
                    </td>
                  </tr>`,
              )
              .join('')}
          </table>
        </div>`;
    },

    return() {
      const el = my('orders').filter((order) => !RF.why(order));
      if (!el.length) {
        return `<h2>Initiate a Return</h2>${empty('No orders are eligible for return right now.')}`;
      }

      return `
        <h2>Initiate a Return</h2>
        <form class="card" id="rf" style="max-width:560px">
          <label for="o">1. Product</label>
          <select id="o">
            ${el
              .map(
                (order) => `
                  <option value="${order.id}" ${order.id === pre ? 'selected' : ''}>
                    ${order.id}: ${esc(order.name)} (${money(order.price * order.qty)})
                  </option>`,
              )
              .join('')}
          </select>
          <label for="r">2. Reason</label>
          <select id="r">${REASONS.map((reason) => `<option>${reason}</option>`).join('')}</select>
          <label for="d">3. Describe the problem</label>
          <textarea id="d" rows="4" minlength="10" required></textarea>
          <label for="x">4. Resolution</label>
          <select id="x">
            <option>Full refund</option>
            <option>Product exchange</option>
          </select>
          <label for="f">5. Photos or video of the product you received</label>
          <input
            id="f"
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
            multiple
          >
          <small>
            Up to 4 files. Images (JPG, PNG, WEBP) up to 5 MB, videos (MP4, WEBM, MOV)
            up to 25 MB. Required unless the reason is "Changed mind".
          </small>
          <div id="pv" class="pv"></div>
          <div class="err" role="alert" id="e"></div>
          <button class="btn" id="sb">Submit return request</button>
        </form>`;
    },

    tracking() {
      const rs = my('returns').filter((item) =>
        item.id.toLowerCase().includes(q.toLowerCase()),
      );

      return `
        <h2>Track My Returns</h2>
        <input
          id="q"
          placeholder="Search by return ID"
          value="${esc(q)}"
          aria-label="Search returns"
        >
        ${
          rs
            .map((r) => {
              const hs = Object.fromEntries(r.hist.map((history) => [history.s, history]));
              const li = STAGES.map(
                (stage) => `
                  <li class="${hs[stage] ? 'done' : ''} ${r.status === stage ? 'cur' : ''}">
                    ${stage.replace(/_/g, ' ')}${
                      hs[stage] ? ` <small>${date(hs[stage].t)}</small>` : ''
                    }
                  </li>`,
              ).join('');
              const bad = ['REJECTED', 'INSPECTION_FAILED'].includes(r.status)
                ? `<li class="bad">${r.status.replace(/_/g, ' ')}: ${esc(hs[r.status].note)}</li>`
                : '';

              return `
                <div class="card" style="margin:12px 0">
                  <h3>${r.id} ${badge(r.status)}</h3>
                  <p>
                    ${esc(r.name)}, ${esc(r.res)}, ${money(r.price)}<br>
                    <small>${esc(r.reason)}, submitted ${date(r.hist[0].t)}</small>
                  </p>
                  <ul class="tl">
                    ${
                      bad
                        ? li.split('</li>').slice(0, 2).join('</li>') + '</li>' + bad
                        : li
                    }
                  </ul>
                </div>`;
            })
            .join('') || empty('No returns found.')
        }`;
    },

    refunds() {
      const f = my('refunds');

      return `
        <h2>Refund History</h2>
        ${
          f.length
            ? `
              <div class="tw">
                <table>
                  <tr>
                    <th>Refund</th>
                    <th>Return</th>
                    <th>Product</th>
                    <th>Calculation</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                  ${f
                    .map(
                      (item) => `
                        <tr>
                          <td>${item.id}</td>
                          <td>${item.rid}</td>
                          <td>${esc(item.name)}</td>
                          <td>${money(item.price)} - ${money(item.ded)} = <b>${money(item.amount)}</b></td>
                          <td>${badge(item.status)}</td>
                          <td>
                            <button class="btn sm alt" data-act="receipt" data-id="${item.id}">
                              Receipt
                            </button>
                          </td>
                        </tr>`,
                    )
                    .join('')}
                </table>
              </div>
              <p><small>All refunds are simulated; no money moves.</small></p>`
            : empty('No refunds yet. Refunds appear after your returned product passes inspection.')
        }`;
    },

    notifications() {
      const n = notes();

      return `
        <h2>Notifications</h2>
        <button class="btn alt" data-act="readall">Mark all as read</button>
        ${
          n
            .map(
              (item) => `
                <div class="note ${item.read ? '' : 'new'}">
                  ${esc(item.msg)}<br>
                  <small>${date(item.t)}</small>
                  ${
                    item.read
                      ? ''
                      : `<button class="btn sm alt" data-act="read" data-id="${item.id}">Mark as read</button>`
                  }
                </div>`,
            )
            .join('') || empty('Nothing here yet.')
        }`;
    },
  };

  const cur = () => (location.hash.slice(1) in V ? location.hash.slice(1) : 'overview');

  function render() {
    files = [];
    const v = cur();
    $('#who').textContent = ses.name;
    const u = notes().filter((item) => !item.read).length;
    $('#bell').textContent = u ? u + ' unread' : '';
    $('#nav').innerHTML = Object.entries(V)
      .map(
        ([key, label]) =>
          `<button data-go="${key}" class="${key === v ? 'on' : ''}">${label}</button>`,
      )
      .join('');
    $('#view').innerHTML = views[v]();

    const qi = $('#q');
    if (qi) {
      qi.oninput = (event) => {
        q = event.target.value;
        const p = event.target.selectionStart;
        render();
        const n = $('#q');
        n.focus();
        n.setSelectionRange(p, p);
      };
    }
  }

  document.addEventListener('click', (event) => {
    const b = event.target.closest('[data-go],[data-act]');
    if (!b) return;

    const a = b.dataset.act;
    const id = b.dataset.id;
    if (b.dataset.go) {
      q = '';
      location.hash = b.dataset.go;
      if (cur() === b.dataset.go) render();
    } else if (a === 'logout') {
      RF.logout();
    } else if (a === 'start') {
      pre = id;
      location.hash = 'return';
    } else if (a === 'read') {
      RF.db.notes.find((item) => item.id === id).read = true;
      RF.save();
      render();
    } else if (a === 'readall') {
      notes().forEach((item) => (item.read = true));
      RF.save();
      render();
    } else if (a === 'receipt') {
      const x = RF.db.refunds.find((refund) => refund.id === id);
      const w = open('', '_blank');
      if (!w) return RF.toast('Allow pop-ups to print the receipt');

      w.document.write(`
        <title>${x.id}</title>
        <body style="font-family:sans-serif;max-width:480px;margin:30px auto">
          <h2>ReFlow Refund Receipt (SIMULATED)</h2>
          <p>
            Refund ${x.id} for ${x.rid}<br>
            ${esc(x.name)}<br>
            Price ${money(x.price)}<br>
            Deduction ${money(x.ded)}<br>
            <b>Refund ${money(x.amount)}</b><br>
            Status ${x.status}<br>
            ${date(x.startedAt)}
          </p>
          <p>No real payment was made.</p>
        </body>`);
      w.document.close();
      w.print();
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.id !== 'f') return;

    const err = $('#e');
    const pv = $('#pv');
    const bad = (message) => {
      err.textContent = message;
      files = [];
      pv.innerHTML = '';
      event.target.value = '';
    };
    err.textContent = '';
    pv.innerHTML = '';
    files = [];
    const L = [...event.target.files];
    if (L.length > 4) return bad('Choose at most 4 files.');

    for (const file of L) {
      const img = /^image\/(jpeg|png|webp)$/.test(file.type);
      const vid = /^video\/(mp4|webm|quicktime)$/.test(file.type);
      if (!img && !vid) return bad(file.name + ': unsupported file type.');
      if (file.size > (img ? 5 : 25) * 1048576) {
        return bad(file.name + ' is too large (' + (img ? 5 : 25) + ' MB maximum).');
      }

      files.push(file);
      const u = URL.createObjectURL(file);
      pv.insertAdjacentHTML(
        'beforeend',
        img
          ? `<img src="${u}" alt="Preview of ${esc(file.name)}">`
          : `<video src="${u}" controls></video>`,
      );
    }
  });

  document.addEventListener('submit', async (event) => {
    if (event.target.id !== 'rf') return;
    event.preventDefault();
    const sb = $('#sb');
    if (sb.disabled) return;

    const d = $('#d').value.trim();
    const rs = $('#r').value;
    if (d.length < 10) {
      return ($('#e').textContent = 'Describe the problem in at least 10 characters.');
    }
    if (!files.length && rs !== 'Changed mind') {
      return ($('#e').textContent =
        'Please add at least one photo or video of the product you received.');
    }

    sb.disabled = true;
    try {
      const id = RF.submit($('#o').value, rs, d, $('#x').value, files.length);
      if (files.length) await RF.putEv(id, files);
      files = [];
      pre = '';
      RF.toast('Return ' + id + ' submitted');
      location.hash = 'tracking';
    } catch (x) {
      $('#e').textContent = x.message;
      sb.disabled = false;
    }
  });

  window.onRFSync = render;
  addEventListener('hashchange', render);
  render();
})();

(() => {
  const { esc, money, date, badge, T } = RF;
  const ses = RF.guard('admin');
  const $ = (selector) => document.querySelector(selector);
  const V = {
    overview: 'Overview',
    requests: 'Return Requests',
    refunds: 'Refund Management',
    notifications: 'Notifications',
    settings: 'Settings',
  };
  let q = '';
  let sf = '';
  const COL = {
    SUBMITTED: '#F59E0B',
    APPROVED: '#4F46E5',
    SHIPPED: '#7C3AED',
    RECEIVED: '#0EA5E9',
    INSPECTION_PASSED: '#16A34A',
    INSPECTION_FAILED: '#DC2626',
    REJECTED: '#DC2626',
    REFUND_INITIATED: '#F59E0B',
    REFUND_COMPLETED: '#16A34A',
  };

  const views = {
    overview() {
      const d = RF.db;
      const r = d.returns;
      const c = (status) => r.filter((item) => item.status === status).length;

      return `
        <h2>Overview</h2>
        <div class="cards">
          <div class="card"><b>${d.orders.length}</b><span>Orders</span></div>
          <div class="card"><b>${r.length}</b><span>Return requests</span></div>
          <div class="card"><b>${c('SUBMITTED')}</b><span>Pending approval</span></div>
          <div class="card"><b>${c('REJECTED')}</b><span>Rejected</span></div>
          <div class="card"><b>${d.refunds.filter((item) => item.status === 'Processing').length}</b><span>Refunds in progress</span></div>
          <div class="card"><b>${money(d.refunds.filter((item) => item.status === 'Completed').reduce((total, item) => total + item.amount, 0))}</b><span>Refunded (simulated)</span></div>
        </div>
        <div class="card">
          <h3>Requests by status</h3>
          <canvas
            id="ch"
            width="360"
            height="220"
            aria-label="Doughnut chart of return requests by status"
          ></canvas>
          <div id="lg"></div>
        </div>`;
    },

    requests() {
      const rs = RF.db.returns.filter(
        (r) =>
          (r.id + r.name + r.reason).toLowerCase().includes(q.toLowerCase()) &&
          (!sf || r.status === sf),
      );

      return `
        <h2>Return Requests</h2>
        <div class="row">
          <input
            id="q"
            placeholder="Search ID, product or reason"
            value="${esc(q)}"
            aria-label="Search"
          >
          <select id="sf" aria-label="Filter by status">
            <option value="">All statuses</option>
            ${Object.keys(COL)
              .map((status) => `<option ${status === sf ? 'selected' : ''}>${status}</option>`)
              .join('')}
          </select>
        </div>
        <div class="tw">
          <table>
            <tr>
              <th>ID</th>
              <th>Product</th>
              <th>Reason</th>
              <th>Resolution</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
            ${rs
              .map(
                (r) => `
                  <tr>
                    <td>${r.id}<br><small>${date(r.hist[0].t)}</small></td>
                    <td>${esc(r.name)}<br>${money(r.price)}</td>
                    <td>${esc(r.reason)}<br><small>${esc(r.desc)}</small></td>
                    <td>${esc(r.res)}</td>
                    <td>${badge(r.status)}</td>
                    <td>
                      <button class="btn sm alt" data-act="ev" data-id="${r.id}">
                        Evidence (${r.ev || 0})
                      </button>
                      ${(T[r.status] || [])
                        .map(
                          (status) => `
                            <button
                              class="btn sm ${/REJ|FAIL/.test(status) ? 'red' : ''}"
                              data-act="mv"
                              data-id="${r.id}"
                              data-to="${status}"
                            >${status.replace(/_/g, ' ')}</button>`,
                        )
                        .join('') || '<small>No further actions</small>'}
                    </td>
                  </tr>`,
              )
              .join('')}
          </table>
        </div>
        ${rs.length ? '' : '<div class="card">No matching requests.</div>'}`;
    },

    refunds() {
      const f = RF.db.refunds;

      return `
        <h2>Refund Management</h2>
        <p>
          Refunds are created when you move a return to REFUND INITIATED.
          Complete them from Return Requests.
        </p>
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
                        </tr>`,
                    )
                    .join('')}
                </table>
              </div>`
            : '<div class="card">No refunds yet.</div>'
        }`;
    },

    notifications() {
      const n = RF.db.notes.filter((item) => item.to === 'admin');

      return `
        <h2>Notifications</h2>
        ${
          n
            .map(
              (item) => `
                <div class="note">
                  ${esc(item.msg)}<br>
                  <small>${date(item.t)}</small>
                </div>`,
            )
            .join('') || '<div class="card">No activity yet.</div>'
        }`;
    },

    settings() {
      return `
        <h2>Settings</h2>
        <div class="card" style="max-width:420px">
          <label for="w">Return window (days)</label>
          <input
            id="w"
            type="number"
            min="1"
            max="60"
            value="${RF.db.policy.windowDays}"
          >
          <button class="btn" data-act="win">Save policy</button>
          <p>Applies to future eligibility checks.</p>
          <button class="btn red" data-act="reset">Reset demo data</button>
        </div>`;
    },
  };

  const cur = () => (location.hash.slice(1) in V ? location.hash.slice(1) : 'overview');

  function chart() {
    const c = $('#ch');
    if (!c) return;

    const x = c.getContext('2d');
    const cnt = {};
    RF.db.returns.forEach((r) => (cnt[r.status] = (cnt[r.status] || 0) + 1));
    const tot = RF.db.returns.length;

    if (!tot) {
      $('#lg').textContent = 'No data yet.';
      return;
    }

    let a = -Math.PI / 2;
    Object.entries(cnt).forEach(([status, count]) => {
      const e = a + (count / tot) * 2 * Math.PI;
      x.beginPath();
      x.moveTo(110, 110);
      x.arc(110, 110, 100, a, e);
      x.fillStyle = COL[status];
      x.fill();
      a = e;
    });

    x.beginPath();
    x.arc(110, 110, 55, 0, 7);
    x.fillStyle = '#fff';
    x.fill();
    $('#lg').innerHTML = Object.entries(cnt)
      .map(
        ([status, count]) =>
          `<span class="b" style="margin:2px;background:${COL[status]};color:#fff">${status.replace(/_/g, ' ')}: ${count}</span>`,
      )
      .join('');
  }

  function render() {
    const v = cur();
    $('#who').textContent = ses.name + ' (Admin)';
    $('#bell').textContent =
      RF.db.returns.filter((r) => r.status === 'SUBMITTED').length + ' pending';
    $('#nav').innerHTML = Object.entries(V)
      .map(
        ([key, label]) =>
          `<button data-go="${key}" class="${key === v ? 'on' : ''}">${label}</button>`,
      )
      .join('');
    $('#view').innerHTML = views[v]();
    chart();

    const qi = $('#q');
    const sel = $('#sf');
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
    if (sel) {
      sel.onchange = (event) => {
        sf = event.target.value;
        render();
      };
    }
  }

  document.addEventListener('click', (event) => {
    const b = event.target.closest('[data-go],[data-act]');
    if (!b) return;

    const a = b.dataset.act;
    if (b.dataset.go) {
      location.hash = b.dataset.go;
      if (cur() === b.dataset.go) render();
    } else if (a === 'logout') {
      RF.logout();
    } else if (a === 'mv') {
      const to = b.dataset.to;
      let note = '';
      let ded = 0;

      if (to === 'REJECTED') {
        note = prompt('Rejection reason (required):');
        if (note === null) return;
      } else if (/INSPECTION/.test(to)) {
        note = prompt('Inspection notes:') || '';
      } else if (to === 'REFUND_INITIATED') {
        ded = prompt('Deduction in ₹ (0 for none):', '0');
        if (ded === null) return;
      }

      try {
        RF.move(b.dataset.id, to, note, ded);
        RF.toast('Updated to ' + to.replace(/_/g, ' '));
        render();
      } catch (x) {
        RF.toast(x.message);
      }
    } else if (a === 'ev') {
      showEv(b.dataset.id);
    } else if (a === 'win') {
      const w = +$('#w').value;
      if (w < 1 || w > 60) return RF.toast('Enter 1 to 60 days');
      RF.db.policy.windowDays = w;
      RF.save();
      RF.toast('Policy saved');
    } else if (a === 'reset' && confirm('Delete all demo data and restore the sample data?')) {
      RF.reset();
      render();
      RF.toast('Demo data reset');
    }
  });

  async function showEv(id) {
    const r = RF.db.returns.find((item) => item.id === id);
    let fs = [];
    try {
      fs = await RF.getEv(id);
    } catch (e) {}

    const m = document.createElement('div');
    const urls = [];
    m.className = 'mdl';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.innerHTML = `
      <div class="mbox">
        <h3>Evidence for ${esc(id)}</h3>
        <p>
          <b>${esc(r.name)}</b>, ${esc(r.reason)}<br>
          <small>Customer says: ${esc(r.desc)}</small>
        </p>
        <div class="pv">
          ${
            fs
              .map((file) => {
                const u = URL.createObjectURL(file.blob);
                urls.push(u);
                return file.type.startsWith('video/')
                  ? `<video src="${u}" controls></video>`
                  : `<img src="${u}" alt="${esc(file.name)}">`;
              })
              .join('') || '<p>The customer did not upload any photos or videos.</p>'
          }
        </div>
        <button class="btn" data-close>Close</button>
      </div>`;
    m.addEventListener('click', (event) => {
      if (event.target === m || event.target.hasAttribute('data-close')) {
        urls.forEach((url) => URL.revokeObjectURL(url));
        m.remove();
      }
    });
    document.body.appendChild(m);
    m.querySelector('[data-close]').focus();
  }

  window.onRFSync = render;
  addEventListener('hashchange', render);
  render();
})();

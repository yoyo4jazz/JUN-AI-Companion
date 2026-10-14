/* PPGOS Banner Booking — aplikasi statis (GitHub Pages) + Supabase.
 * Semua aturan penting (kapasitas, tanggal lewat, hak akses) juga dijaga di
 * database (supabase/schema.sql); logika di sini hanya untuk tampilan. */
(() => {
  'use strict';

  const cfg = window.APP_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $('#app');

  // ------------------------------------------------------------------ utils
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const parts = (ds) => ds.split('-').map(Number);
  const toUTC = (ds) => { const [y, m, d] = parts(ds); return new Date(Date.UTC(y, m - 1, d)); };
  const fromUTC = (dt) => ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  const addDays = (ds, n) => { const dt = toUTC(ds); dt.setUTCDate(dt.getUTCDate() + n); return fromUTC(dt); };
  const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
  const dow = (ds) => toUTC(ds).getUTCDay();
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const todayJkt = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const DOWS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const fmt = (ds) => { const [y, m, d] = parts(ds); return `${d} ${MON[m - 1]} ${y}`; };
  const fmtRange = (a, b) => {
    if (a === b) return fmt(a);
    const [y1, m1, d1] = parts(a), [y2, m2, d2] = parts(b);
    if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${MON[m1 - 1]} ${y1}`;
    if (y1 === y2) return `${d1} ${MON[m1 - 1]} – ${d2} ${MON[m2 - 1]} ${y1}`;
    return `${fmt(a)} – ${fmt(b)}`;
  };
  const fmtDT = (iso) => iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) : '';
  const fmtSize = (b) => b == null ? '' : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;
  const eachDay = (a, b, fn) => { for (let d = a; d <= b; d = addDays(d, 1)) fn(d); };

  const STATUS = {
    pending: 'Diajukan', approved: 'Disetujui', live: 'Tayang', done: 'Selesai',
    rejected: 'Ditolak', cancelled: 'Dibatalkan',
  };
  const ACTIVE = ['pending', 'approved', 'live'];
  const MSTATUS = { submitted: 'Menunggu review', approved: 'Materi OK', revision: 'Perlu revisi' };
  const ROLES = { pending: 'Menunggu persetujuan', principal: 'Principal', internal: 'Tim Internal', admin: 'Admin' };
  const KIND = { holiday: 'Libur nasional', cuti: 'Cuti bersama', ppgos: 'Event PPGOS' };
  const statusBadge = (s, map = STATUS) => `<span class="status s-${esc(s)}">${esc(map[s] || s)}</span>`;
  const placeTag = (p) => p ? `<span class="tag"><span class="dot" style="background:${esc(p.color)}"></span>${esc(p.name)}</span>` : '';

  let toastTimer;
  function toast(msg, isErr = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, isErr ? 6000 : 3200);
  }
  const errMsg = (e) => (e && (e.message || e.error_description)) || String(e);

  function openModal(title, html, onMount) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header><h2>${esc(title)}</h2><button class="close" aria-label="Tutup">×</button></header>
      <div class="mbody">${html}</div></div></div>`;
    const back = $('.modal-back', root);
    const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    $('.close', root).onclick = close;
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    const body = $('.mbody', root);
    if (onMount) onMount(body, close);
    const first = $('input,select,textarea,button:not(.close)', body);
    if (first) first.focus();
    return close;
  }
  const closeModal = () => { $('#modal-root').innerHTML = ''; };

  // ------------------------------------------------------------------ setup
  if (cfg.APP_NAME) { $('#app-name').textContent = cfg.APP_NAME; document.title = cfg.APP_NAME; }
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) {
    app.innerHTML = `<div class="card stack"><h1>Aplikasi belum terhubung ke database</h1>
      <p>Isi <code>SUPABASE_URL</code> dan <code>SUPABASE_ANON_KEY</code> di file <code>banner-booking/config.js</code>.
      Langkah lengkapnya ada di <code>banner-booking/README.md</code>.</p>
      ${window.supabase ? '' : '<p class="err-text">Library Supabase gagal dimuat. Periksa koneksi internet.</p>'}</div>`;
    return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const S = {
    session: null, profile: null,
    placements: [], years: [], pid: null,
    view: 'month', y: 0, m: 0,
    sel: null,            // {start, end, locked}
    avail: {},            // ds -> {used, cap}
    events: [],
    bookings: [],         // booking dalam bulan tampil (sesuai hak akses)
    principals: null,
    pendingUsers: 0,
  };
  const role = () => S.profile?.role || (S.session ? 'pending' : 'anon');
  const isStaff = () => ['internal', 'admin'].includes(role());
  const isAdmin = () => role() === 'admin';
  const canBook = () => ['principal', 'internal', 'admin'].includes(role());
  const placement = (id) => S.placements.find((p) => p.id === id);

  // ------------------------------------------------------------------ auth
  async function loadProfile() {
    S.profile = null;
    if (!S.session) return;
    const { data } = await sb.from('profiles').select('*').eq('id', S.session.user.id).maybeSingle();
    S.profile = data;
    if (isAdmin()) {
      const { count } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'pending');
      S.pendingUsers = count || 0;
    }
  }

  function renderChrome() {
    const r = role();
    const route = location.hash.replace('#', '').split('/')[0] || 'kalender';
    const links = [['kalender', 'Kalender']];
    if (canBook()) links.push(['booking', isStaff() ? 'Semua Booking' : 'Booking Saya']);
    if (isAdmin()) links.push(['admin', `Admin${S.pendingUsers ? ` <span class="badge-count">${S.pendingUsers}</span>` : ''}`]);
    $('#nav').innerHTML = links.map(([h, t]) => `<a href="#${h}" class="${route === h ? 'active' : ''}">${t}</a>`).join('');
    const ub = $('#userbox');
    if (!S.session) {
      ub.innerHTML = '<button class="ghost-light" id="btn-login">Masuk / Daftar</button>';
      $('#btn-login').onclick = () => authModal('login');
    } else {
      const name = S.profile?.full_name || S.session.user.email;
      ub.innerHTML = `<span class="uname">${esc(name)}</span><span class="role">${esc(ROLES[r] || r)}</span>
        <button class="ghost-light sm" id="btn-logout">Keluar</button>`;
      $('#btn-logout').onclick = async () => { await sb.auth.signOut(); location.hash = '#kalender'; };
    }
    $('#notice').innerHTML = S.session && r === 'pending'
      ? '<div class="notice">Akun Anda sudah terdaftar dan <b>menunggu persetujuan admin</b>. Sementara ini Anda hanya bisa melihat ketersediaan slot.</div>'
      : '';
  }

  function authModal(mode = 'login') {
    const isLogin = mode === 'login';
    openModal(isLogin ? 'Masuk' : 'Daftar akun baru', `
      <form id="f-auth" class="stack">
        ${isLogin ? '' : `<div class="grid2"><div><label for="a-name">Nama lengkap</label><input id="a-name" required></div>
          <div><label for="a-company">Perusahaan / Brand</label><input id="a-company" required></div></div>`}
        <div><label for="a-email">Email</label><input id="a-email" type="email" autocomplete="email" required></div>
        <div><label for="a-pass">Password</label><input id="a-pass" type="password" minlength="8" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required></div>
        <p class="err-text" id="a-err"></p>
        <div class="row"><button class="primary" type="submit">${isLogin ? 'Masuk' : 'Daftar'}</button>
          ${isLogin ? '<button type="button" id="a-forgot">Lupa password</button>' : ''}
          <span class="grow"></span>
          <a href="#" id="a-switch">${isLogin ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}</a></div>
        ${isLogin ? '' : '<p class="muted small">Akun baru perlu disetujui admin sebelum bisa booking.</p>'}
      </form>`, (body, close) => {
      $('#a-switch', body).onclick = (e) => { e.preventDefault(); authModal(isLogin ? 'signup' : 'login'); };
      const err = $('#a-err', body);
      if (isLogin) {
        $('#a-forgot', body).onclick = async () => {
          const email = $('#a-email', body).value.trim();
          if (!email) { err.textContent = 'Isi email dulu.'; return; }
          const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
          err.textContent = '';
          if (error) err.textContent = errMsg(error); else toast('Link reset password sudah dikirim ke email.');
        };
      }
      $('#f-auth', body).onsubmit = async (e) => {
        e.preventDefault();
        err.textContent = '';
        const btn = $('button[type=submit]', body); btn.disabled = true;
        const email = $('#a-email', body).value.trim(), password = $('#a-pass', body).value;
        try {
          if (isLogin) {
            const { error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw error;
            close();
          } else {
            const { data, error } = await sb.auth.signUp({
              email, password,
              options: {
                data: { full_name: $('#a-name', body).value.trim(), company: $('#a-company', body).value.trim() },
                emailRedirectTo: location.origin + location.pathname,
              },
            });
            if (error) throw error;
            close();
            if (!data.session) {
              openModal('Cek email Anda', `<p>Kami sudah mengirim link konfirmasi ke <b>${esc(email)}</b>. Setelah dikonfirmasi, silakan masuk.
                Admin perlu menyetujui akun Anda sebelum bisa booking.</p>`);
            }
          }
        } catch (ex) {
          err.textContent = /invalid login/i.test(errMsg(ex)) ? 'Email atau password salah.' : errMsg(ex);
        } finally { btn.disabled = false; }
      };
    });
  }

  function newPasswordModal() {
    openModal('Buat password baru', `<form id="f-np" class="stack">
      <div><label for="np">Password baru</label><input id="np" type="password" minlength="8" autocomplete="new-password" required></div>
      <p class="err-text" id="np-err"></p><button class="primary">Simpan</button></form>`, (body, close) => {
      $('#f-np', body).onsubmit = async (e) => {
        e.preventDefault();
        const { error } = await sb.auth.updateUser({ password: $('#np', body).value });
        if (error) $('#np-err', body).textContent = errMsg(error);
        else { close(); toast('Password berhasil diganti.'); }
      };
    });
  }

  // ------------------------------------------------------------------ base data
  async function loadBase() {
    const [pl, yr] = await Promise.all([
      sb.from('placements').select('*').order('sort').order('id'),
      sb.from('calendar_years').select('year').order('year'),
    ]);
    if (pl.error) throw pl.error;
    if (yr.error) throw yr.error;
    S.placements = pl.data || [];
    S.years = (yr.data || []).map((r) => r.year);
    const visible = S.placements.filter((p) => p.active);
    if (!visible.find((p) => p.id === S.pid)) S.pid = visible[0]?.id ?? null;
    if (!S.y) {
      const [ty, tm] = parts(todayJkt());
      if (S.years.includes(ty) || !S.years.length) { S.y = ty; S.m = tm; }
      else { S.y = S.years.find((y) => y > ty) ?? S.years[S.years.length - 1]; S.m = 1; }
    }
  }

  // ------------------------------------------------------------------ calendar
  async function loadCalendarData() {
    const from = S.view === 'year' ? ymd(S.y, 1, 1) : ymd(S.y, S.m, 1);
    const to = S.view === 'year' ? ymd(S.y, 12, 31) : ymd(S.y, S.m, dim(S.y, S.m));
    S.avail = {}; S.events = []; S.bookings = [];
    const jobs = [
      sb.from('calendar_events').select('*').lte('start_date', to).gte('end_date', from).order('start_date'),
    ];
    if (S.pid != null) jobs.push(sb.rpc('get_availability', { p_placement: S.pid, p_from: from, p_to: to }));
    if (S.session && canBook() && S.pid != null) {
      jobs.push(sb.from('bookings')
        .select('id,campaign,start_date,end_date,status,principal_id,principal:profiles!bookings_principal_fk(full_name,company)')
        .eq('placement_id', S.pid).in('status', ACTIVE).lte('start_date', to).gte('end_date', from));
    }
    const [ev, av, bk] = await Promise.all(jobs);
    if (ev.error) throw ev.error;
    S.events = ev.data || [];
    if (av) { if (av.error) throw av.error; for (const r of av.data || []) S.avail[r.day] = { used: r.used, cap: r.capacity }; }
    if (bk && !bk.error) S.bookings = bk.data || [];
  }

  function eventsOn(ds) { return S.events.filter((e) => e.start_date <= ds && e.end_date >= ds); }
  function bookingsOn(ds) { return S.bookings.filter((b) => b.start_date <= ds && b.end_date >= ds); }
  const isRed = (ds) => dow(ds) === 0 || eventsOn(ds).some((e) => e.kind === 'holiday');
  const yearOpen = (ds) => S.years.includes(parts(ds)[0]);

  // Status satu hari untuk placement terpilih
  function dayState(ds) {
    const today = todayJkt();
    if (ds < today) return 'past';
    if (!yearOpen(ds)) return 'closed';
    const a = S.avail[ds];
    if (!a) return 'free';
    if (role() === 'principal' && bookingsOn(ds).some((b) => b.principal_id === S.session.user.id)) return 'mine';
    if (a.used >= a.cap) return 'full';
    return a.used > 0 ? 'partial' : 'free';
  }

  function renderCalendar() {
    const visible = S.placements.filter((p) => p.active);
    if (!S.years.length) {
      app.innerHTML = `<div class="card empty"><h2>Kalender belum dibuka</h2><p>Admin belum membuat kalender tahun mana pun.${isAdmin() ? ' Buka menu <a href="#admin">Admin</a> untuk menambah tahun.' : ''}</p></div>`;
      return;
    }
    if (!visible.length) {
      app.innerHTML = '<div class="card empty"><h2>Belum ada placement aktif</h2></div>';
      return;
    }
    const p = placement(S.pid);
    const title = S.view === 'year' ? String(S.y) : `${MONTHS[S.m - 1]} ${S.y}`;
    const canPrev = S.view === 'year' ? S.years.some((y) => y < S.y) : (S.m > 1 || S.years.some((y) => y < S.y));
    const canNext = S.view === 'year' ? S.years.some((y) => y > S.y) : (S.m < 12 || S.years.some((y) => y > S.y));

    app.innerHTML = `
      <div class="pills" role="tablist" aria-label="Pilih placement">
        ${visible.map((x) => `<button class="pill ${x.id === S.pid ? 'active' : ''}" style="--pc:${esc(x.color)}" data-pid="${x.id}" role="tab" aria-selected="${x.id === S.pid}">
          <span class="dot" style="background:${esc(x.color)}"></span> ${esc(x.name)}
          <small>· ${x.capacity_per_day === 1 ? '1 principal/hari' : `maks ${x.capacity_per_day} principal/hari`}</small></button>`).join('')}
      </div>
      ${p?.description ? `<p class="muted small" style="margin-top:-4px">${esc(p.description)}${specText(p) ? ` · Spesifikasi: ${esc(specText(p))}` : ''}</p>` : ''}
      <div class="toolbar">
        <button id="prev" ${canPrev ? '' : 'disabled'} aria-label="Sebelumnya">‹</button>
        <h2>${title}</h2>
        <button id="next" ${canNext ? '' : 'disabled'} aria-label="Berikutnya">›</button>
        <button id="go-today" class="sm">Hari ini</button>
        <span class="spacer"></span>
        <div class="seg"><button data-view="month" class="${S.view === 'month' ? 'on' : ''}">Bulan</button><button data-view="year" class="${S.view === 'year' ? 'on' : ''}">Tahun</button></div>
      </div>
      <div class="legend">
        <span><i class="sw free"></i>Tersedia</span>
        ${p && p.capacity_per_day > 1 ? '<span><i class="sw partial"></i>Sebagian terisi</span>' : ''}
        <span><i class="sw full"></i>Penuh</span>
        <span><i class="sw past"></i>Sudah lewat</span>
        <span><i class="sw sel"></i>Dipilih</span>
        ${role() === 'principal' ? '<span><i class="sw mine"></i>Booking Anda</span>' : ''}
        <span><i class="sw hol"></i><b style="color:var(--red)">Merah</b> = Minggu / libur</span>
        <span><i class="sw ev"></i>Event PPGOS</span>
      </div>
      <div id="cal-body">${S.view === 'year' ? yearHTML() : monthHTML()}</div>
      <section class="card" style="margin-top:18px">
        <h2>Event ${S.view === 'year' ? S.y : `${MONTHS[S.m - 1]} ${S.y}`}</h2>
        ${eventsListHTML()}
      </section>
      ${!S.session ? '<p class="muted small" style="margin-top:14px">Masuk sebagai principal atau tim internal untuk melakukan booking dan upload materi.</p>' : ''}`;

    $$('.pill', app).forEach((b) => b.onclick = () => { S.pid = Number(b.dataset.pid); S.sel = null; showCalendar(); });
    $$('[data-view]', app).forEach((b) => b.onclick = () => { S.view = b.dataset.view; showCalendar(); });
    $('#prev').onclick = () => shift(-1);
    $('#next').onclick = () => shift(1);
    $('#go-today').onclick = () => {
      const [ty, tm] = parts(todayJkt());
      if (!S.years.includes(ty)) { toast(`Kalender ${ty} belum dibuka admin.`, true); return; }
      S.y = ty; S.m = tm; S.view = 'month'; showCalendar();
    };
    $$('.day[data-ds]', app).forEach((el) => el.onclick = () => clickDay(el.dataset.ds));
    $$('[data-month]', app).forEach((el) => el.onclick = () => { S.m = Number(el.dataset.month); S.view = 'month'; showCalendar(); });
    renderSelbar();
  }

  function shift(dir) {
    if (S.view === 'year') {
      const ys = dir < 0 ? S.years.filter((y) => y < S.y) : S.years.filter((y) => y > S.y);
      if (ys.length) S.y = dir < 0 ? ys[ys.length - 1] : ys[0];
    } else {
      let y = S.y, m = S.m + dir;
      if (m < 1) { m = 12; y--; }
      if (m > 12) { m = 1; y++; }
      if (!S.years.includes(y)) {
        const ys = dir < 0 ? S.years.filter((v) => v < S.y) : S.years.filter((v) => v > S.y);
        if (!ys.length) return;
        y = dir < 0 ? ys[ys.length - 1] : ys[0]; m = dir < 0 ? 12 : 1;
      }
      S.y = y; S.m = m;
    }
    showCalendar();
  }

  function specText(p) {
    const s = [];
    if (p.spec_width && p.spec_height) s.push(`${p.spec_width}×${p.spec_height}px`);
    if (p.formats) s.push(p.formats.toUpperCase().replace(/,/g, '/'));
    if (p.max_mb) s.push(`maks ${p.max_mb} MB`);
    return s.join(', ');
  }

  function inSel(ds) { return S.sel && ds >= S.sel.start && ds <= S.sel.end; }

  function monthHTML() {
    const first = ymd(S.y, S.m, 1), n = dim(S.y, S.m), today = todayJkt();
    let h = DOWS.map((d, i) => `<div class="dow ${i === 0 ? 'sun' : ''}">${d}</div>`).join('');
    for (let i = 0; i < dow(first); i++) h += '<div class="day blank" aria-hidden="true"></div>';
    for (let d = 1; d <= n; d++) {
      const ds = ymd(S.y, S.m, d);
      const st = dayState(ds), a = S.avail[ds], evs = eventsOn(ds), bks = bookingsOn(ds);
      const cls = ['day', st === 'mine' ? 'mine-day' : st, isRed(ds) ? 'red' : '', ds === today ? 'today' : '', inSel(ds) ? 'sel' : ''];
      let stTxt = '';
      if (st === 'full') stTxt = 'Penuh';
      else if (st === 'mine') stTxt = 'Booking Anda';
      else if (st === 'closed') stTxt = 'Belum dibuka';
      else if (st === 'partial') stTxt = `Sisa ${a.cap - a.used} dari ${a.cap}`;
      else if (st === 'free') stTxt = 'Tersedia';
      const chips = evs.slice(0, 2).map((e) => `<span class="chip ${e.kind}" title="${esc(e.title)}">${esc(e.title)}</span>`).join('')
        + (evs.length > 2 ? `<span class="chip more">+${evs.length - 2} event</span>` : '');
      const who = isStaff() ? bks.slice(0, 2).map((b) => `<span class="chip who" title="${esc(b.campaign)}">${esc(b.principal?.company || b.principal?.full_name || '—')}</span>`).join('')
        + (bks.length > 2 ? `<span class="chip who">+${bks.length - 2}</span>` : '') : '';
      const label = `${d} ${MONTHS[S.m - 1]}: ${stTxt || 'sudah lewat'}${evs.length ? ', ' + evs.map((e) => e.title).join(', ') : ''}`;
      const clickable = ['free', 'partial'].includes(st) && canSelect();
      h += `<button class="${cls.join(' ')}" ${clickable ? `data-ds="${ds}"` : 'aria-disabled="true" tabindex="-1"'} aria-label="${esc(label)}" aria-pressed="${inSel(ds)}">
        <span class="num">${d}</span>${stTxt ? `<span class="st">${stTxt}</span>` : ''}${chips}${who}</button>`;
    }
    return `<div class="cal">${h}</div>`;
  }

  function yearHTML() {
    const today = todayJkt();
    let out = '<div class="year">';
    for (let m = 1; m <= 12; m++) {
      const first = ymd(S.y, m, 1);
      let h = DOWS.map((d, i) => `<div class="dow ${i === 0 ? 'sun' : ''}">${d[0]}</div>`).join('');
      for (let i = 0; i < dow(first); i++) h += '<div class="md blank"></div>';
      let free = 0;
      for (let d = 1; d <= dim(S.y, m); d++) {
        const ds = ymd(S.y, m, d), st = dayState(ds), evs = eventsOn(ds);
        if (st === 'free' || st === 'partial') free++;
        const tip = `${d} ${MONTHS[m - 1]}${evs.length ? ' — ' + evs.map((e) => e.title).join(', ') : ''}`;
        h += `<div class="md ${st === 'mine' ? 'full' : st} ${isRed(ds) ? 'red' : ''} ${evs.some((e) => e.kind === 'ppgos') ? 'ev' : ''}" title="${esc(tip)}">${d}</div>`;
      }
      const past = ymd(S.y, m, dim(S.y, m)) < today;
      out += `<div class="mini"><h3 data-month="${m}" role="button" tabindex="0">${MONTHS[m - 1].toUpperCase()}</h3>
        <div class="cal">${h}</div><p class="small muted" style="text-align:center;margin:6px 0 0">${past ? 'Sudah lewat' : `${free} hari tersedia`}</p></div>`;
    }
    return out + '</div>';
  }

  function eventsListHTML() {
    if (!S.events.length) return '<p class="muted">Tidak ada event.</p>';
    return `<div class="events">${S.events.map((e) => {
      const [, m1, d1] = parts(e.start_date), [, m2, d2] = parts(e.end_date);
      const when = e.start_date === e.end_date ? `${d1}` : m1 === m2 ? `${d1}–${d2}` : `${d1}/${m1}–${d2}/${m2}`;
      const prefix = S.view === 'year' ? `${MON[m1 - 1]} ` : '';
      return `<div><b>${prefix}${when}</b><span>${esc(e.title)} <span class="chip ${e.kind}">${KIND[e.kind]}</span></span></div>`;
    }).join('')}</div>`;
  }

  const canSelect = () => !S.session || canBook();

  async function clickDay(ds) {
    if (!S.session) { authModal('login'); return; }
    const sel = S.sel;
    if (sel && !sel.locked && ds > sel.start) {
      if (diffDays(sel.start, ds) > 92) { toast('Maksimal 93 hari per booking.', true); return; }
      const ok = await rangeAvailable(sel.start, ds);
      if (ok === true) { S.sel = { start: sel.start, end: ds, locked: true }; }
      else { toast(ok, true); S.sel = { start: ds, end: ds, locked: false }; }
    } else if (sel && sel.start === ds && sel.end === ds) {
      S.sel = null;
    } else {
      S.sel = { start: ds, end: ds, locked: false };
    }
    const body = $('#cal-body');
    if (body) body.innerHTML = monthHTML();
    $$('.day[data-ds]', app).forEach((el) => el.onclick = () => clickDay(el.dataset.ds));
    renderSelbar();
  }

  // Cek rentang ke server (bisa melewati bulan yang belum dimuat).
  async function rangeAvailable(a, b) {
    const { data, error } = await sb.rpc('get_availability', { p_placement: S.pid, p_from: a, p_to: b });
    if (error) return errMsg(error);
    for (const r of data || []) {
      if (r.day < todayJkt()) return `Tanggal ${fmt(r.day)} sudah lewat.`;
      if (!yearOpen(r.day)) return `Kalender ${parts(r.day)[0]} belum dibuka.`;
      if (r.used >= r.capacity) return `Tanggal ${fmt(r.day)} sudah penuh. Pilih rentang lain.`;
    }
    if (role() === 'principal') {
      const { data: mine } = await sb.from('bookings').select('start_date,end_date')
        .eq('placement_id', S.pid).eq('principal_id', S.session.user.id).in('status', ACTIVE).lte('start_date', b).gte('end_date', a);
      if (mine && mine.length) return 'Anda sudah punya booking di rentang ini.';
    }
    return true;
  }

  function renderSelbar() {
    const bar = $('#selbar');
    const route = location.hash.replace('#', '') || 'kalender';
    if (!S.sel || route !== 'kalender') { bar.hidden = true; bar.innerHTML = ''; return; }
    const p = placement(S.pid);
    const days = diffDays(S.sel.start, S.sel.end) + 1;
    bar.hidden = false;
    bar.innerHTML = `<span>${placeTag(p)} · <b>${fmtRange(S.sel.start, S.sel.end)}</b> · ${days} hari
      ${S.sel.locked ? '' : '<span class="muted small">— klik tanggal lain untuk tanggal selesai</span>'}</span>
      <button id="sel-clear">Batal</button><button class="primary" id="sel-go">Lanjut Booking</button>`;
    $('#sel-clear').onclick = () => { S.sel = null; renderCalendar(); };
    $('#sel-go').onclick = () => bookingForm();
  }

  async function bookingForm() {
    const p = placement(S.pid), sel = S.sel;
    if (!sel) return;
    if (isStaff() && !S.principals) {
      const { data } = await sb.from('profiles').select('id,full_name,company,email').eq('role', 'principal').order('company');
      S.principals = data || [];
    }
    const evs = S.events.filter((e) => e.start_date <= sel.end && e.end_date >= sel.start);
    openModal('Booking slot', `<form id="f-book" class="stack">
      <dl class="kv"><dt>Placement</dt><dd>${placeTag(p)}</dd>
        <dt>Tanggal tayang</dt><dd>${fmtRange(sel.start, sel.end)} (${diffDays(sel.start, sel.end) + 1} hari)</dd>
        ${evs.length ? `<dt>Bertepatan dengan</dt><dd>${evs.map((e) => esc(e.title)).join(', ')}</dd>` : ''}
        ${specText(p) ? `<dt>Spesifikasi materi</dt><dd>${esc(specText(p))}</dd>` : ''}</dl>
      ${isStaff() ? `<div><label for="b-prin">Atas nama principal</label><select id="b-prin" required>
          <option value="">— pilih principal —</option>
          ${S.principals.map((x) => `<option value="${x.id}">${esc(x.company || '-')} — ${esc(x.full_name || x.email)}</option>`).join('')}
        </select>${S.principals.length ? '' : '<p class="err-text">Belum ada akun principal yang disetujui.</p>'}</div>` : ''}
      <div><label for="b-camp">Nama campaign / produk</label><input id="b-camp" maxlength="120" required placeholder="mis. Promo Susu X Hot Sale"></div>
      <div><label for="b-notes">Catatan (opsional)</label><textarea id="b-notes" maxlength="1000" placeholder="Link tujuan banner, target, dll."></textarea></div>
      ${isStaff() ? '<label class="check"><input type="checkbox" id="b-approve"> Langsung setujui</label>' : '<p class="muted small">Slot langsung dikunci untuk Anda dengan status <b>Diajukan</b> sampai direview tim internal. Materi bisa diupload setelah booking dibuat.</p>'}
      <p class="err-text" id="b-err"></p>
      <div class="row"><button class="primary" type="submit">Kirim Booking</button></div>
    </form>`, (body, close) => {
      $('#f-book', body).onsubmit = async (e) => {
        e.preventDefault();
        const btn = $('button[type=submit]', body); btn.disabled = true;
        const row = {
          placement_id: S.pid, start_date: sel.start, end_date: sel.end,
          campaign: $('#b-camp', body).value.trim(), notes: $('#b-notes', body).value.trim() || null,
          principal_id: isStaff() ? $('#b-prin', body).value : S.session.user.id,
          status: isStaff() && $('#b-approve', body).checked ? 'approved' : 'pending',
        };
        const { data, error } = await sb.from('bookings').insert(row).select('id').single();
        btn.disabled = false;
        if (error) { $('#b-err', body).textContent = errMsg(error); return; }
        close();
        S.sel = null;
        toast('Booking berhasil dibuat.');
        await showCalendar();
        openBooking(data.id);
      };
    });
  }

  async function showCalendar() {
    try {
      await loadCalendarData();
      renderCalendar();
    } catch (e) {
      app.innerHTML = `<div class="card"><p class="err-text">Gagal memuat kalender: ${esc(errMsg(e))}</p></div>`;
    }
  }

  // ------------------------------------------------------------------ bookings list
  const BK_SELECT = '*,placement:placements(id,name,color,capacity_per_day,spec_width,spec_height,max_mb,formats),principal:profiles!bookings_principal_fk(id,full_name,company,email),materials(count)';
  const listFilter = { status: 'active', pid: '', q: '', when: 'upcoming' };

  async function showBookings() {
    if (!canBook()) { location.hash = '#kalender'; return; }
    app.innerHTML = `<div class="row" style="margin-bottom:12px"><h1 class="grow" style="margin:0">${isStaff() ? 'Semua Booking' : 'Booking Saya'}</h1>
      <a class="btn primary" href="#kalender">+ Booking baru</a></div>
      <div class="card row" style="margin-bottom:14px">
        <div><label for="f-st">Status</label><select id="f-st">
          <option value="active">Aktif (diajukan/disetujui/tayang)</option><option value="pending">Diajukan</option>
          <option value="approved">Disetujui</option><option value="live">Tayang</option><option value="done">Selesai</option>
          <option value="rejected">Ditolak</option><option value="cancelled">Dibatalkan</option><option value="all">Semua</option></select></div>
        <div><label for="f-pl">Placement</label><select id="f-pl"><option value="">Semua</option>
          ${S.placements.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
        <div><label for="f-when">Periode</label><select id="f-when"><option value="upcoming">Hari ini & ke depan</option><option value="past">Sudah lewat</option><option value="all">Semua</option></select></div>
        ${isStaff() ? '<div class="grow"><label for="f-q">Cari campaign / principal</label><input id="f-q" type="search"></div>' : ''}
      </div>
      <div id="bk-list"><p class="muted">Memuat…</p></div>`;
    $('#f-st').value = listFilter.status; $('#f-pl').value = listFilter.pid; $('#f-when').value = listFilter.when;
    if ($('#f-q')) $('#f-q').value = listFilter.q;
    const reload = () => {
      listFilter.status = $('#f-st').value; listFilter.pid = $('#f-pl').value; listFilter.when = $('#f-when').value;
      listFilter.q = $('#f-q')?.value.trim().toLowerCase() || '';
      loadBookingList();
    };
    ['#f-st', '#f-pl', '#f-when'].forEach((s) => $(s).onchange = reload);
    if ($('#f-q')) $('#f-q').oninput = () => { listFilter.q = $('#f-q').value.trim().toLowerCase(); renderBookingRows(); };
    loadBookingList();
  }

  let bkRows = [];
  async function loadBookingList() {
    let q = sb.from('bookings').select(BK_SELECT);
    if (listFilter.status === 'active') q = q.in('status', ACTIVE);
    else if (listFilter.status !== 'all') q = q.eq('status', listFilter.status);
    if (listFilter.pid) q = q.eq('placement_id', Number(listFilter.pid));
    if (listFilter.when === 'upcoming') q = q.gte('end_date', todayJkt());
    if (listFilter.when === 'past') q = q.lt('end_date', todayJkt());
    q = q.order('start_date', { ascending: listFilter.when !== 'past' }).limit(500);
    const { data, error } = await q;
    if (error) { $('#bk-list').innerHTML = `<p class="err-text">${esc(errMsg(error))}</p>`; return; }
    bkRows = data || [];
    renderBookingRows();
  }

  function renderBookingRows() {
    const el = $('#bk-list');
    if (!el) return;
    const rows = bkRows.filter((b) => !listFilter.q || [b.campaign, b.principal?.company, b.principal?.full_name, b.principal?.email]
      .some((v) => (v || '').toLowerCase().includes(listFilter.q)));
    if (!rows.length) { el.innerHTML = '<div class="card empty">Belum ada booking.</div>'; return; }
    el.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Tanggal tayang</th><th>Placement</th><th>Campaign</th>
      ${isStaff() ? '<th>Principal</th>' : ''}<th>Materi</th><th>Status</th></tr></thead><tbody>
      ${rows.map((b) => {
        const nMat = b.materials?.[0]?.count ?? 0;
        const soon = ACTIVE.includes(b.status) && !nMat && diffDays(todayJkt(), b.start_date) <= 7;
        return `<tr class="click" data-id="${b.id}" tabindex="0"><td>${fmtRange(b.start_date, b.end_date)}</td><td>${placeTag(b.placement)}</td>
          <td>${esc(b.campaign)}</td>${isStaff() ? `<td>${esc(b.principal?.company || '')}<br><span class="muted small">${esc(b.principal?.full_name || b.principal?.email || '')}</span></td>` : ''}
          <td>${nMat ? `${nMat} file` : `<span class="${soon ? 'err-text' : 'muted'}">Belum ada${soon ? ' ⚠' : ''}</span>`}</td>
          <td>${statusBadge(b.status)}</td></tr>`;
      }).join('')}</tbody></table></div>`;
    $$('tr[data-id]', el).forEach((tr) => {
      tr.onclick = () => openBooking(tr.dataset.id);
      tr.onkeydown = (e) => { if (e.key === 'Enter') openBooking(tr.dataset.id); };
    });
  }

  // ------------------------------------------------------------------ booking detail
  async function openBooking(id) {
    const { data: b, error } = await sb.from('bookings').select(BK_SELECT).eq('id', id).maybeSingle();
    if (error || !b) { toast(error ? errMsg(error) : 'Booking tidak ditemukan.', true); return; }
    const { data: mats } = await sb.from('materials').select('*').eq('booking_id', id).order('created_at', { ascending: false });
    const p = b.placement;
    const mine = b.principal_id === S.session.user.id;
    const active = ACTIVE.includes(b.status);
    const canUpload = active && (isStaff() || mine);
    const acts = [];
    if (isStaff()) {
      if (b.status === 'pending') acts.push(['approved', 'Setujui', 'success'], ['rejected', 'Tolak', 'danger']);
      if (b.status === 'approved') acts.push(['live', 'Tandai Tayang', 'primary'], ['rejected', 'Tolak', 'danger']);
      if (b.status === 'live') acts.push(['done', 'Tandai Selesai', '']);
      if (active) acts.push(['cancelled', 'Batalkan', 'danger']);
    } else if (mine && ['pending', 'approved'].includes(b.status)) {
      acts.push(['cancelled', 'Batalkan booking', 'danger']);
    }

    openModal(b.campaign, `
      <dl class="kv">
        <dt>Status</dt><dd>${statusBadge(b.status)}</dd>
        <dt>Placement</dt><dd>${placeTag(p)}</dd>
        <dt>Tanggal tayang</dt><dd>${fmtRange(b.start_date, b.end_date)} (${diffDays(b.start_date, b.end_date) + 1} hari)</dd>
        <dt>Principal</dt><dd>${esc(b.principal?.company || '')} — ${esc(b.principal?.full_name || b.principal?.email || '')}</dd>
        ${b.notes ? `<dt>Catatan</dt><dd style="white-space:pre-wrap;font-weight:400">${esc(b.notes)}</dd>` : ''}
        ${b.review_note ? `<dt>Catatan review</dt><dd style="white-space:pre-wrap;font-weight:400">${esc(b.review_note)}</dd>` : ''}
        <dt>Dibuat</dt><dd style="font-weight:400">${fmtDT(b.created_at)}</dd>
      </dl>
      <div class="row" style="margin-top:14px">${acts.map(([s, t, c]) => `<button class="${c}" data-status="${s}">${t}</button>`).join('')}
        <a class="btn wa" id="bk-wa" target="_blank" rel="noopener" href="${esc(waLink(b, mats || []))}">WhatsApp</a>
        ${isAdmin() ? '<span class="grow"></span><button class="danger sm" id="bk-del">Hapus permanen</button>' : ''}</div>
      <h3 style="margin-top:22px">Materi digital</h3>
      ${p && specText(p) ? `<p class="muted small">Spesifikasi: ${esc(specText(p))}</p>` : ''}
      ${canUpload ? `<div class="drop stack"><div><label for="m-files">Upload file materi (bisa lebih dari satu)</label>
        <input type="file" id="m-files" multiple accept="${esc(acceptAttr(p))}"></div>
        <div><label for="m-note">Catatan untuk file ini (opsional)</label><input id="m-note" maxlength="300" placeholder="mis. versi revisi 2"></div>
        <div class="row"><button class="primary" id="m-up">Upload</button><span class="muted small" id="m-prog"></span></div>
        <div><label for="m-url">Atau tempel link materi (Google Drive, Dropbox, WeTransfer, dll.)</label>
        <div class="row"><input id="m-url" class="grow" type="url" placeholder="https://drive.google.com/..."><button id="m-link">Tambah link</button></div>
        <p class="muted small" style="margin:4px 0 0">Pastikan akses link di-set "Siapa saja yang memiliki link" agar tim bisa membukanya.</p></div></div>` : ''}
      <div class="mats" id="mats" style="margin-top:12px">${(mats || []).length ? '' : '<p class="muted">Belum ada materi.</p>'}</div>
    `, (body, close) => {
      $$('[data-status]', body).forEach((btn) => btn.onclick = () => changeStatus(b, btn.dataset.status, close));
      if ($('#bk-del', body)) $('#bk-del', body).onclick = async () => {
        if (!confirm('Hapus booking ini beserta semua materinya? Tidak bisa dibatalkan.')) return;
        const paths = (mats || []).map((m) => m.storage_path).filter(Boolean);
        if (paths.length) await sb.storage.from('materials').remove(paths);
        const { error: e2 } = await sb.from('bookings').delete().eq('id', b.id);
        if (e2) { toast(errMsg(e2), true); return; }
        close(); toast('Booking dihapus.'); refreshRoute();
      };
      if (canUpload) {
        $('#m-up', body).onclick = () => uploadMaterials(b, body);
        $('#m-link', body).onclick = () => addLink(b, body);
      }
      renderMaterials(b, mats || [], body);
    });
  }

  function acceptAttr(p) {
    if (!p?.formats) return 'image/*,video/*';
    return p.formats.split(',').map((f) => '.' + f.trim().toLowerCase()).join(',');
  }

  async function changeStatus(b, status, close) {
    let note = b.review_note;
    if (status === 'rejected' || (status === 'cancelled' && isStaff())) {
      const n = prompt(status === 'rejected' ? 'Alasan penolakan (akan terlihat oleh principal):' : 'Alasan pembatalan:', '');
      if (n === null) return;
      note = n.trim() || note;
    } else if (status === 'cancelled') {
      if (!confirm('Batalkan booking ini? Slot akan dibuka untuk principal lain.')) return;
    } else if (status === 'approved') {
      const n = prompt('Catatan persetujuan (opsional):', '');
      if (n === null) return;
      note = n.trim() || note;
    }
    const patch = { status };
    if (isStaff()) patch.review_note = note;
    const { error } = await sb.from('bookings').update(patch).eq('id', b.id);
    if (error) { toast(errMsg(error), true); return; }
    close();
    toast(`Status: ${STATUS[status]}`);
    refreshRoute();
    openBooking(b.id);
  }

  async function renderMaterials(b, mats, body) {
    const box = $('#mats', body);
    if (!mats.length) return;
    const paths = mats.map((m) => m.storage_path).filter(Boolean);
    const { data: urls } = paths.length ? await sb.storage.from('materials').createSignedUrls(paths, 3600) : { data: [] };
    const urlOf = Object.fromEntries((urls || []).map((u) => [u.path, u.signedUrl]));
    box.innerHTML = mats.map((m) => {
      const url = urlOf[m.storage_path];
      const isImg = !m.url && (m.mime || '').startsWith('image/');
      const canDel = isAdmin() || m.uploaded_by === S.session.user.id;
      return `<div class="mat">
        <div class="thumb" ${isImg && url ? `style="background-image:url('${esc(url)}')"` : ''}>${isImg ? '' : m.url ? `🔗 ${esc(hostOf(m.url))}` : esc((m.mime || 'file').split('/')[0].toUpperCase())}</div>
        <div class="body"><span class="name">${esc(m.file_name)}</span>
          <span class="muted">${[m.width && m.height ? `${m.width}×${m.height}px` : '', fmtSize(m.size_bytes)].filter(Boolean).join(' · ')}</span>
          <span>${statusBadge(m.status, MSTATUS)}</span>
          ${m.note ? `<span class="muted" style="white-space:pre-wrap">${esc(m.note)}</span>` : ''}
          <span class="muted small">${fmtDT(m.created_at)}</span>
          <div class="acts">
            ${m.url ? `<a class="btn sm" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">Buka link</a>` : `<button class="sm" data-dl="${m.id}">Download</button>`}
            ${isStaff() && m.status !== 'approved' ? `<button class="sm success" data-mok="${m.id}">OK</button>` : ''}
            ${isStaff() && m.status !== 'revision' ? `<button class="sm danger" data-mrev="${m.id}">Revisi</button>` : ''}
            ${canDel ? `<button class="sm danger" data-mdel="${m.id}" aria-label="Hapus ${esc(m.file_name)}">Hapus</button>` : ''}
          </div></div></div>`;
    }).join('');
    const byId = Object.fromEntries(mats.map((m) => [m.id, m]));
    $$('[data-dl]', box).forEach((btn) => btn.onclick = async () => {
      const m = byId[btn.dataset.dl];
      const { data, error } = await sb.storage.from('materials').createSignedUrl(m.storage_path, 600, { download: m.file_name });
      if (error) { toast(errMsg(error), true); return; }
      window.open(data.signedUrl, '_blank', 'noopener');
    });
    const review = async (id, status) => {
      let note = byId[id].note;
      if (status === 'revision') {
        const n = prompt('Apa yang perlu direvisi?', '');
        if (n === null) return;
        note = n.trim() ? `Revisi: ${n.trim()}` : note;
      }
      const { error } = await sb.from('materials').update({ status, note }).eq('id', id);
      if (error) { toast(errMsg(error), true); return; }
      closeModal(); openBooking(b.id);
    };
    $$('[data-mok]', box).forEach((btn) => btn.onclick = () => review(btn.dataset.mok, 'approved'));
    $$('[data-mrev]', box).forEach((btn) => btn.onclick = () => review(btn.dataset.mrev, 'revision'));
    $$('[data-mdel]', box).forEach((btn) => btn.onclick = async () => {
      const m = byId[btn.dataset.mdel];
      if (!confirm(`Hapus ${m.file_name}?`)) return;
      if (m.storage_path) {
        const { error: e1 } = await sb.storage.from('materials').remove([m.storage_path]);
        if (e1) { toast(errMsg(e1), true); return; }
      }
      const { error: e2 } = await sb.from('materials').delete().eq('id', m.id);
      if (e2) { toast(errMsg(e2), true); return; }
      closeModal(); openBooking(b.id);
    });
  }

  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'link'; } }

  async function addLink(b, body) {
    const raw = $('#m-url', body).value.trim();
    let u;
    try { u = new URL(raw); } catch { u = null; }
    if (!u || !/^https?:$/.test(u.protocol)) { toast('Link tidak valid. Harus diawali https://', true); return; }
    const { error } = await sb.from('materials').insert({
      booking_id: b.id, url: u.href, file_name: hostOf(u.href), note: $('#m-note', body).value.trim() || null,
    });
    if (error) { toast(errMsg(error), true); return; }
    toast('Link materi ditambahkan.');
    closeModal();
    openBooking(b.id);
    if ((location.hash || '').startsWith('#booking')) loadBookingList();
  }

  // Click-to-chat WhatsApp (gratis, tanpa API): membuka WA dengan pesan terisi.
  function waLink(b, mats) {
    const appUrl = location.origin + location.pathname + '#booking/' + b.id;
    const lines = [
      `*Booking ${b.placement?.name || 'Banner'} PPGOS*`,
      `Campaign: ${b.campaign}`,
      `Principal: ${b.principal?.company || ''}${b.principal?.full_name ? ` (${b.principal.full_name})` : ''}`,
      `Tanggal tayang: ${fmtRange(b.start_date, b.end_date)}`,
      `Status: ${STATUS[b.status] || b.status}`,
      `Materi: ${mats.length ? `${mats.length} item` : 'belum ada'}`,
      ...mats.filter((m) => m.url).map((m) => `- ${m.url}`),
      '',
      `Detail: ${appUrl}`,
    ];
    const num = String(cfg.WA_TEAM_NUMBER || '').replace(/\D/g, '');
    const to = role() === 'principal' && num ? num : '';
    return `https://wa.me/${to}?text=${encodeURIComponent(lines.join('\n'))}`;
  }

  function mediaSize(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const done = (w, h) => { URL.revokeObjectURL(url); resolve(w && h ? { width: w, height: h } : {}); };
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => done(img.naturalWidth, img.naturalHeight);
        img.onerror = () => done();
        img.src = url;
      } else if (file.type.startsWith('video/')) {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => done(v.videoWidth, v.videoHeight);
        v.onerror = () => done();
        v.src = url;
      } else done();
    });
  }

  async function uploadMaterials(b, body) {
    const files = [...$('#m-files', body).files];
    const prog = $('#m-prog', body);
    if (!files.length) { prog.textContent = 'Pilih file dulu.'; return; }
    const p = b.placement || {};
    const formats = (p.formats || '').split(',').map((f) => f.trim().toLowerCase()).filter(Boolean);
    const maxBytes = Number(p.max_mb || 50) * 1048576;
    const prepared = [];
    for (const f of files) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (formats.length && !formats.includes(ext)) { toast(`${f.name}: format .${ext} tidak diizinkan (${formats.join(', ')}).`, true); return; }
      if (f.size > maxBytes) { toast(`${f.name}: ukuran ${fmtSize(f.size)} melebihi batas ${p.max_mb} MB.`, true); return; }
      const dimn = await mediaSize(f);
      if (p.spec_width && p.spec_height && dimn.width && (dimn.width !== p.spec_width || dimn.height !== p.spec_height)) {
        if (!confirm(`${f.name} berukuran ${dimn.width}×${dimn.height}px, spesifikasi ${p.spec_width}×${p.spec_height}px.\nTetap upload?`)) return;
      }
      prepared.push({ f, dimn });
    }
    const note = $('#m-note', body).value.trim() || null;
    $('#m-up', body).disabled = true;
    let n = 0;
    for (const { f, dimn } of prepared) {
      n++;
      prog.textContent = `Mengupload ${n}/${prepared.length}: ${f.name}…`;
      const safe = f.name.replace(/[^\w.\-]+/g, '_').slice(-80);
      const path = `${b.id}/${Date.now()}-${safe}`;
      const up = await sb.storage.from('materials').upload(path, f, { contentType: f.type || undefined, upsert: false });
      if (up.error) { toast(`${f.name}: ${errMsg(up.error)}`, true); $('#m-up', body).disabled = false; prog.textContent = ''; return; }
      const { error } = await sb.from('materials').insert({
        booking_id: b.id, storage_path: path, file_name: f.name, mime: f.type || null,
        size_bytes: f.size, width: dimn.width || null, height: dimn.height || null, note,
      });
      if (error) {
        await sb.storage.from('materials').remove([path]);
        toast(`${f.name}: ${errMsg(error)}`, true); $('#m-up', body).disabled = false; prog.textContent = ''; return;
      }
    }
    toast(`${prepared.length} file berhasil diupload.`);
    closeModal();
    openBooking(b.id);
    if ((location.hash || '').startsWith('#booking')) loadBookingList();
  }

  // ------------------------------------------------------------------ admin
  let adminTab = 'years';
  async function showAdmin() {
    if (!isAdmin()) { location.hash = '#kalender'; return; }
    app.innerHTML = `<h1>Admin</h1><div class="tabs" role="tablist">
      <button data-tab="years" class="${adminTab === 'years' ? 'on' : ''}">Tahun & Event</button>
      <button data-tab="placements" class="${adminTab === 'placements' ? 'on' : ''}">Placement</button>
      <button data-tab="users" class="${adminTab === 'users' ? 'on' : ''}">Pengguna${S.pendingUsers ? ` <span class="badge-count">${S.pendingUsers}</span>` : ''}</button>
      </div><div id="admin-body"><p class="muted">Memuat…</p></div>`;
    $$('[data-tab]', app).forEach((b) => b.onclick = () => { adminTab = b.dataset.tab; showAdmin(); });
    const body = $('#admin-body');
    if (adminTab === 'years') return adminYears(body);
    if (adminTab === 'placements') return adminPlacements(body);
    return adminUsers(body);
  }

  let adminYear = null;
  async function adminYears(body) {
    if (!adminYear || !S.years.includes(adminYear)) adminYear = S.years.includes(S.y) ? S.y : S.years[S.years.length - 1] ?? null;
    let evs = [];
    if (adminYear) {
      const { data } = await sb.from('calendar_events').select('*').eq('year', adminYear).order('start_date').order('kind');
      evs = data || [];
    }
    const nextYear = (S.years.length ? Math.max(...S.years) : parts(todayJkt())[0] - 1) + 1;
    body.innerHTML = `<div class="stack">
      <section class="card"><h2>Tahun kalender</h2>
        <p class="muted small">Membuat tahun baru akan membuka booking untuk tahun tersebut dan otomatis mengambil libur nasional Indonesia.
        Cuti bersama dan perubahan dari SKB 3 Menteri tetap perlu dicek & ditambahkan manual.</p>
        <div class="row">${S.years.map((y) => `<button class="${y === adminYear ? 'primary' : ''}" data-year="${y}">${y}</button>`).join('') || '<span class="muted">Belum ada.</span>'}
          <span class="grow"></span>
          <input id="ny" type="number" min="2020" max="2100" value="${nextYear}" style="width:110px" aria-label="Tahun baru">
          <button class="primary" id="ny-add">+ Buat tahun</button></div>
      </section>
      ${adminYear ? `<section class="card"><div class="row"><h2 class="grow" style="margin:0">Event ${adminYear}</h2>
          <button id="hol-fetch">↻ Ambil libur nasional otomatis</button>
          <button class="danger" id="y-del">Hapus tahun ${adminYear}</button></div>
        <form id="ev-add" class="row" style="margin:14px 0">
          <div><label for="ev-s">Mulai</label><input id="ev-s" type="date" min="${adminYear}-01-01" max="${adminYear}-12-31" required></div>
          <div><label for="ev-e">Selesai</label><input id="ev-e" type="date" min="${adminYear}-01-01" max="${adminYear + 1}-12-31"></div>
          <div class="grow"><label for="ev-t">Nama event</label><input id="ev-t" required maxlength="80" placeholder="mis. Flash Sale"></div>
          <div><label for="ev-k">Jenis</label><select id="ev-k">${Object.entries(KIND).map(([k, v]) => `<option value="${k}" ${k === 'ppgos' ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div><label>&nbsp;</label><button class="primary">Tambah</button></div>
        </form>
        <details><summary><b>Import banyak sekaligus</b> (copy-paste dari kalender event)</summary>
          <p class="muted small">Satu baris satu event: <code>tanggal mulai;tanggal selesai;nama;jenis</code>. Tanggal selesai & jenis boleh kosong (jenis default: ppgos; pilihan: ppgos, holiday, cuti). Format tanggal YYYY-MM-DD atau DD/MM.</p>
          <textarea id="bulk" placeholder="${adminYear}-01-14;;Flash Sale\n21/01;23/01;Hot Sale\n${adminYear}-02-16;;Cuti Bersama Imlek;cuti"></textarea>
          <div class="row" style="margin-top:8px"><button id="bulk-go">Import</button><span class="muted small" id="bulk-msg"></span></div>
        </details>
        <div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Tanggal</th><th>Event</th><th>Jenis</th><th></th></tr></thead><tbody>
          ${evs.map((e) => `<tr><td>${fmtRange(e.start_date, e.end_date)}</td><td>${esc(e.title)}</td><td><span class="chip ${e.kind}">${KIND[e.kind]}</span></td>
            <td style="text-align:right;white-space:nowrap"><button class="sm" data-ev-edit="${e.id}">Ubah</button> <button class="sm danger" data-ev-del="${e.id}">Hapus</button></td></tr>`).join('')
            || '<tr><td colspan="4" class="muted">Belum ada event.</td></tr>'}
        </tbody></table></div></section>` : ''}
    </div>`;

    $$('[data-year]', body).forEach((b) => b.onclick = () => { adminYear = Number(b.dataset.year); adminYears(body); });
    $('#ny-add', body).onclick = async () => {
      const y = Number($('#ny', body).value);
      if (!(y >= 2020 && y <= 2100)) { toast('Tahun tidak valid.', true); return; }
      const { error } = await sb.from('calendar_years').insert({ year: y });
      if (error) { toast(/duplicate|unique/i.test(errMsg(error)) ? `Tahun ${y} sudah ada.` : errMsg(error), true); return; }
      await loadBase();
      adminYear = y;
      const n = await fetchHolidays(y);
      toast(n >= 0 ? `Tahun ${y} dibuat, ${n} libur nasional ditambahkan. Silakan cek & tambahkan event PPGOS.` : `Tahun ${y} dibuat. Libur nasional gagal diambil otomatis — tambahkan manual.`, n < 0);
      adminYears(body);
    };
    if (!adminYear) return;
    $('#hol-fetch', body).onclick = async () => {
      const n = await fetchHolidays(adminYear);
      toast(n >= 0 ? `${n} libur nasional baru ditambahkan.` : 'Gagal mengambil data libur. Coba lagi nanti atau isi manual.', n < 0);
      adminYears(body);
    };
    $('#y-del', body).onclick = async () => {
      const typed = prompt(`Menghapus tahun ${adminYear} akan menghapus semua event-nya dan menutup booking untuk tahun itu (booking yang sudah ada tidak terhapus).\nKetik ${adminYear} untuk konfirmasi:`);
      if (typed !== String(adminYear)) return;
      const { error } = await sb.from('calendar_years').delete().eq('year', adminYear);
      if (error) { toast(errMsg(error), true); return; }
      await loadBase(); adminYear = null; adminYears(body);
    };
    $('#ev-add', body).onsubmit = async (e) => {
      e.preventDefault();
      const s = $('#ev-s', body).value, en = $('#ev-e', body).value || s;
      if (en < s) { toast('Tanggal selesai sebelum tanggal mulai.', true); return; }
      const { error } = await sb.from('calendar_events').insert({ year: adminYear, start_date: s, end_date: en, title: $('#ev-t', body).value.trim(), kind: $('#ev-k', body).value });
      if (error) { toast(errMsg(error), true); return; }
      adminYears(body);
    };
    $('#bulk-go', body).onclick = async () => {
      const { rows, bad } = parseBulk($('#bulk', body).value, adminYear);
      if (bad.length) { $('#bulk-msg', body).textContent = `Baris tidak valid: ${bad.join(', ')}`; return; }
      if (!rows.length) return;
      const { error } = await sb.from('calendar_events').insert(rows);
      if (error) { $('#bulk-msg', body).textContent = errMsg(error); return; }
      toast(`${rows.length} event diimport.`);
      adminYears(body);
    };
    const byId = Object.fromEntries(evs.map((e) => [e.id, e]));
    $$('[data-ev-del]', body).forEach((b) => b.onclick = async () => {
      if (!confirm(`Hapus event "${byId[b.dataset.evDel].title}"?`)) return;
      const { error } = await sb.from('calendar_events').delete().eq('id', Number(b.dataset.evDel));
      if (error) toast(errMsg(error), true); else adminYears(body);
    });
    $$('[data-ev-edit]', body).forEach((b) => b.onclick = () => {
      const ev = byId[b.dataset.evEdit];
      openModal('Ubah event', `<form id="f-ev" class="stack"><div class="grid2">
        <div><label for="xe-s">Mulai</label><input id="xe-s" type="date" value="${ev.start_date}" min="${adminYear}-01-01" max="${adminYear}-12-31" required></div>
        <div><label for="xe-e">Selesai</label><input id="xe-e" type="date" value="${ev.end_date}" required></div></div>
        <div><label for="xe-t">Nama</label><input id="xe-t" value="${esc(ev.title)}" required maxlength="80"></div>
        <div><label for="xe-k">Jenis</label><select id="xe-k">${Object.entries(KIND).map(([k, v]) => `<option value="${k}" ${k === ev.kind ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <button class="primary">Simpan</button></form>`, (mb, close) => {
        $('#f-ev', mb).onsubmit = async (e) => {
          e.preventDefault();
          const { error } = await sb.from('calendar_events').update({
            start_date: $('#xe-s', mb).value, end_date: $('#xe-e', mb).value, title: $('#xe-t', mb).value.trim(), kind: $('#xe-k', mb).value,
          }).eq('id', ev.id);
          if (error) { toast(errMsg(error), true); return; }
          close(); adminYears(body);
        };
      });
    });
  }

  function parseBulk(text, year) {
    const rows = [], bad = [];
    const norm = (s) => {
      s = (s || '').trim();
      if (!s) return '';
      let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (m) return ymd(+m[1], +m[2], +m[3]);
      m = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}))?$/);
      if (m) return ymd(m[3] ? +m[3] : year, +m[2], +m[1]);
      return null;
    };
    const valid = (ds) => { const [y, m, d] = parts(ds); return m >= 1 && m <= 12 && d >= 1 && d <= dim(y, m); };
    text.split('\n').forEach((line, i) => {
      if (!line.trim()) return;
      const [a, b, title, kind] = line.split(';');
      const s = norm(a), e = norm(b) || s, k = (kind || 'ppgos').trim().toLowerCase();
      if (!s || e === null || !title?.trim() || !KIND[k] || !valid(s) || !valid(e) || e < s || parts(s)[0] !== year) { bad.push(i + 1); return; }
      rows.push({ year, start_date: s, end_date: e, title: title.trim(), kind: k });
    });
    return { rows, bad };
  }

  // Libur nasional dari Nager.Date (gratis, tanpa API key). Hasil tetap perlu dicek admin.
  async function fetchHolidays(year) {
    try {
      const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ID`);
      if (!r.ok) throw new Error(r.status);
      const list = await r.json();
      const { data: existing } = await sb.from('calendar_events').select('start_date,title').eq('year', year).eq('kind', 'holiday');
      const have = new Set((existing || []).map((e) => e.start_date));
      const rows = list.filter((h) => !have.has(h.date)).map((h) => ({ year, start_date: h.date, end_date: h.date, title: h.localName || h.name, kind: 'holiday' }));
      if (rows.length) {
        const { error } = await sb.from('calendar_events').insert(rows);
        if (error) throw error;
      }
      return rows.length;
    } catch (e) {
      console.warn('holiday fetch failed', e);
      return -1;
    }
  }

  async function adminPlacements(body) {
    const { data, error } = await sb.from('placements').select('*').order('sort').order('id');
    if (error) { body.innerHTML = `<p class="err-text">${esc(errMsg(error))}</p>`; return; }
    const rowHTML = (p) => `<form class="card stack" data-pl="${p.id ?? 'new'}">
      <div class="row"><h3 class="grow" style="margin:0">${p.id ? esc(p.name) : 'Placement baru'}</h3>
        <label class="check" style="margin:0"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}> Aktif</label></div>
      <div class="grid2">
        <div><label>Nama</label><input name="name" value="${esc(p.name || '')}" required maxlength="60"></div>
        <div><label>Kapasitas principal per hari</label><input name="capacity_per_day" type="number" min="1" max="50" value="${p.capacity_per_day ?? 1}" required></div>
        <div><label>Lebar materi (px, opsional)</label><input name="spec_width" type="number" min="1" value="${p.spec_width ?? ''}"></div>
        <div><label>Tinggi materi (px, opsional)</label><input name="spec_height" type="number" min="1" value="${p.spec_height ?? ''}"></div>
        <div><label>Format file (pisahkan koma)</label><input name="formats" value="${esc(p.formats || 'jpg,jpeg,png,webp,gif')}"></div>
        <div><label>Maks ukuran file (MB, ≤ 50)</label><input name="max_mb" type="number" min="1" max="50" step="0.5" value="${p.max_mb ?? 5}"></div>
        <div><label>Warna</label><input name="color" type="color" value="${esc(p.color || '#0b76d1')}"></div>
        <div><label>Urutan tampil</label><input name="sort" type="number" value="${p.sort ?? 0}"></div>
      </div>
      <div><label>Deskripsi</label><input name="description" value="${esc(p.description || '')}" maxlength="200"></div>
      <div class="row"><button class="primary">${p.id ? 'Simpan' : 'Tambah placement'}</button></div>
    </form>`;
    body.innerHTML = `<p class="muted small">Menurunkan kapasitas tidak membatalkan booking yang sudah ada; hanya membatasi booking baru.</p>
      <div class="stack">${(data || []).map(rowHTML).join('')}${rowHTML({})}</div>`;
    $$('form[data-pl]', body).forEach((f) => f.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const num = (k) => fd.get(k) === '' ? null : Number(fd.get(k));
      const row = {
        name: fd.get('name').trim(), description: fd.get('description').trim() || null,
        capacity_per_day: num('capacity_per_day'), spec_width: num('spec_width'), spec_height: num('spec_height'),
        formats: fd.get('formats').replace(/\s|\./g, '').toLowerCase(), max_mb: num('max_mb'),
        color: fd.get('color'), sort: num('sort') ?? 0, active: fd.get('active') === 'on',
      };
      const id = f.dataset.pl;
      const { error: e2 } = id === 'new'
        ? await sb.from('placements').insert(row)
        : await sb.from('placements').update(row).eq('id', Number(id));
      if (e2) { toast(errMsg(e2), true); return; }
      toast('Placement disimpan.');
      await loadBase();
      adminPlacements(body);
    });
  }

  async function adminUsers(body) {
    const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) { body.innerHTML = `<p class="err-text">${esc(errMsg(error))}</p>`; return; }
    const users = (data || []).sort((a, b) => (a.role === 'pending' ? 0 : 1) - (b.role === 'pending' ? 0 : 1));
    body.innerHTML = `<p class="muted small">Pengguna baru mendaftar dengan status <b>Menunggu persetujuan</b>. Ubah perannya menjadi Principal atau Tim Internal agar bisa memakai aplikasi.</p>
      <div class="table-wrap"><table><thead><tr><th>Nama</th><th>Perusahaan</th><th>Email</th><th>Terdaftar</th><th>Peran</th></tr></thead><tbody>
      ${users.map((u) => `<tr><td>${esc(u.full_name || '—')}</td><td>${esc(u.company || '—')}</td><td>${esc(u.email || '')}</td><td>${fmtDT(u.created_at)}</td>
        <td><select data-uid="${u.id}" aria-label="Peran ${esc(u.full_name || u.email)}" ${u.id === S.session.user.id ? 'disabled title="Tidak bisa mengubah peran sendiri"' : ''}>
          ${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${v}</option>`).join('')}</select></td></tr>`).join('')}
      </tbody></table></div>`;
    $$('select[data-uid]', body).forEach((s) => s.onchange = async () => {
      const { error: e2 } = await sb.from('profiles').update({ role: s.value }).eq('id', s.dataset.uid);
      if (e2) { toast(errMsg(e2), true); return; }
      toast('Peran diperbarui.');
      S.principals = null;
      await loadProfile(); renderChrome();
    });
  }

  // ------------------------------------------------------------------ router
  async function refreshRoute() {
    renderChrome();
    const route = location.hash.replace('#', '').split('/')[0] || 'kalender';
    renderSelbar();
    if (route === 'booking') {
      if (!S.session) { await showCalendar(); authModal('login'); return; }
      const id = location.hash.split('/')[1];
      await showBookings();
      if (id && S.session) openBooking(decodeURIComponent(id));
      return;
    }
    if (route === 'admin') return showAdmin();
    return showCalendar();
  }

  window.addEventListener('hashchange', () => { closeModal(); refreshRoute(); });

  async function start() {
    try {
      const { data } = await sb.auth.getSession();
      S.session = data.session;
      await loadProfile();
      await loadBase();
    } catch (e) {
      app.innerHTML = `<div class="card"><p class="err-text">Gagal terhubung ke database: ${esc(errMsg(e))}</p>
        <p class="muted">Pastikan <code>schema.sql</code> sudah dijalankan di Supabase dan isi <code>config.js</code> benar.</p></div>`;
      return;
    }
    await refreshRoute();
    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') { S.session = session; newPasswordModal(); return; }
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') { S.session = session; return; }
      const changed = (session?.user?.id || null) !== (S.session?.user?.id || null);
      S.session = session;
      if (!changed) return;
      S.sel = null; S.principals = null;
      await loadProfile();
      refreshRoute();
    });
  }
  start();
})();

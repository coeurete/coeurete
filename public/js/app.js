/*
 * COEURETE : le site (catalogue, fiche produit, panier, création de la citation).
 * L'étape livraison / paiement / suivi est dans checkout.js.
 * Prix, livraison et paiement : voir config.js. Modèles : voir data.js.
 */
(function () {
'use strict';

var CFG = window.COEURETE_CONFIG;
var DATA = window.COEURETE_DATA;
var COLORS = DATA.COLORS, CATALOG_COLORS = DATA.CATALOG_COLORS, PRODUCTS = DATA.PRODUCTS;
var BY_ID = {}; PRODUCTS.forEach(function (p) { BY_ID[p.id] = p; });
var HEART_PATH = 'M12 21C5 15 2 11.5 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 3.500-3 7-10 13z';

/* ====== utilitaires ====== */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
var fmt;
try { fmt = new Intl.NumberFormat(CFG.locale, { style: 'currency', currency: CFG.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
catch (e) { fmt = { format: function (n) { return n + ' ' + CFG.currency; } }; }
function money(n) { return fmt.format(n); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function gq(s) { return '« ' + s + ' »'; }
function img(id) { return 'assets/img/p' + pad(id) + '.jpg'; }
function linePrice(l) { return CFG.price + (l.emb ? CFG.embroidery : 0); }
function subtotal() { return cart.reduce(function (s, l) { return s + linePrice(l); }, 0); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ====== état du serveur (citations IA, carte, e-mails) ====== */
var server = { known: false, online: false, cardEnabled: false, quoteEnabled: false, emailEnabled: false };
var serverReady = fetch(CFG.api.config, { headers: { accept: 'application/json' } })
  .then(function (r) { if (!r.ok) throw new Error('offline'); return r.json(); })
  .then(function (j) {
    server.online = true;
    server.cardEnabled = !!j.cardEnabled && CFG.cardEnabled !== false;
    server.quoteEnabled = !!j.quoteEnabled;
    server.emailEnabled = !!j.emailEnabled;
  })
  .catch(function () { server.online = false; })
  .then(function () { server.known = true; fillStatic(); });

/* ====== panier (mémorisé dans ce navigateur) ====== */
var cart = [];
try {
  var raw = JSON.parse(localStorage.getItem('coeurete-cart') || '[]');
  if (Array.isArray(raw)) cart = raw.filter(function (l) { return l && BY_ID[l.pid] && COLORS[l.color]; });
} catch (e) { cart = []; }
function save() { try { localStorage.setItem('coeurete-cart', JSON.stringify(cart)); } catch (e) {} }

/* ====== calques ====== */
var stack = [], lastFocus = [];
function openLayer(el, focusSel) {
  el.hidden = false; stack.push(el); document.body.classList.add('lock');
  lastFocus.push(document.activeElement);
  var f = (focusSel && $(focusSel, el)) || $('[data-close]', el);
  if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 30);
}
function closeLayer(el, silent) {
  if (el.hidden) return;
  el.hidden = true;
  stack = stack.filter(function (x) { return x !== el; });
  if (!stack.length) document.body.classList.remove('lock');
  var f = lastFocus.pop(); if (!silent && f && f.focus) f.focus({ preventScroll: true });
}
document.addEventListener('keydown', function (e) {
  var top = stack[stack.length - 1]; if (!top) return;
  if (e.key === 'Escape') { e.preventDefault(); requestClose(top); return; }
  if (e.key === 'Tab') {
    var f = $$('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],summary', top).filter(function (n) { return n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
function requestClose(el) { if (el === flowOv) stopGen(); closeLayer(el); }
$$('.overlay,.drawer').forEach(function (el) {
  el.addEventListener('mousedown', function (e) { if (e.target === el) requestClose(el); });
  $$('[data-close]', el).forEach(function (b) { b.addEventListener('click', function () { requestClose(el); }); });
});

var toastT;
function toast(msg) {
  var t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 3200);
}

/* ====== défilement de citations ====== */
(function () {
  var qs = PRODUCTS.map(function (p) { return p.quote; });
  $('#marquee').innerHTML =
    qs.map(function (q) { return '<span>' + esc(q) + '</span>'; }).join('') +
    qs.map(function (q) { return '<span aria-hidden="true">' + esc(q) + '</span>'; }).join('');
})();

/* ====== regard du personnage ====== */
(function () {
  var ch = $('#char'); if (!ch || reduceMotion) return;
  var pupils = $$('.pupil', ch), raf = 0;
  window.addEventListener('pointermove', function (e) {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var r = ch.getBoundingClientRect(); if (!r.width) return;
      var cx = r.left + r.width / 2, cy = r.top + r.height * 0.38;
      var dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 320));
      var dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 320));
      pupils.forEach(function (p) { p.style.transform = 'translate(' + (dx * 5).toFixed(1) + 'px,' + (dy * 4).toFixed(1) + 'px)'; });
    });
  }, { passive: true });
})();

/* ====== textes qui dépendent de config.js (livraison, paiement, FAQ) ====== */
var ICONS = {
  truck: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 9h16v13H3zM19 13h6l4 5v4H19z"/><circle cx="9" cy="24" r="2.500"/><circle cx="24" cy="24" r="2.500"/></svg>',
  bolt: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M18 3L6 18h8l-2 11 12-15h-8z"/></svg>',
  gift: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 14h22v14H5zM3 9h26v5H3zM16 9v19M16 9c-4-6-9-4-7 0M16 9c4-6 9-4 7 0"/></svg>',
  card: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="7" width="26" height="18" rx="2"/><path d="M3 13h26M8 20h6"/></svg>'
};
function freeText() { return CFG.freeShippingFrom > 0 ? money(CFG.freeShippingFrom) : ''; }
function fillStatic() {
  var d0 = CFG.delivery[0], d1 = CFG.delivery[1];
  $('#announce').textContent = (CFG.freeShippingFrom > 0 ? 'Livraison offerte dès ' + freeText() + ' · ' : '') + 'Paiement à la livraison disponible';
  $('#shipIntro').textContent = 'Chaque t-shirt est imprimé après ta commande : compte ' + CFG.prepTime + ' de préparation, puis le délai de livraison que tu choisis.';

  var cards = CFG.delivery.map(function (d, i) {
    return '<li class="ship-card">' + (i === 0 ? ICONS.truck : ICONS.bolt) + '<h3>' + esc(d.label) + '</h3><p class="big">' + money(d.price) + '</p><p>' + esc(d.delay) + '</p></li>';
  });
  if (CFG.freeShippingFrom > 0) cards.push('<li class="ship-card">' + ICONS.gift + '<h3>Livraison offerte</h3><p class="big">dès ' + freeText() + '</p><p>Sur toute commande de t-shirts de ce montant ou plus.</p></li>');
  var cardOn = server.cardEnabled;
  cards.push('<li class="ship-card">' + ICONS.card + '<h3>Paiement</h3><p class="big">' + (cardOn ? 'Livraison ou carte' : 'À la livraison') + '</p><p>' + (cardOn ? 'Tu paies en espèces au livreur, ou par carte sur une page sécurisée.' : 'Tu paies en espèces au livreur, à la réception de ton colis.') + '</p></li>');
  $('#shipCards').innerHTML = cards.join('');

  $('#faqWhen').textContent = 'Ton t-shirt est imprimé après ta commande (compte ' + CFG.prepTime + '). Ensuite, la livraison prend ' + d0.delay.toLowerCase() + (d1 ? ' en livraison standard, ou ' + d1.delay.toLowerCase() + ' en express' : '') + '. Tu reçois un e-mail dès que le colis part.';
  $('#faqChange').textContent = 'Écris-nous au plus vite avec ton numéro de commande. Si ton t-shirt n’est pas encore imprimé, nous pouvons changer ta citation.';
  $('#faqPay').textContent = cardOn
    ? 'À la livraison, tu paies en espèces au livreur. Par carte, tu es redirigé vers une page de paiement sécurisée : aucun numéro de carte n’est saisi sur ce site.'
    : 'Pour le moment, tu paies en espèces au livreur, à la réception de ton colis. Le paiement par carte arrive bientôt.';
  $('#faqReturns').textContent = CFG.returnsText;

  var c = CFG.contact || {}, bits = [];
  if (c.email) bits.push(c.email); if (c.phone) bits.push(c.phone); if (c.instagram) bits.push(c.instagram);
  var line = $('#contactLine');
  if (bits.length) { line.hidden = false; line.textContent = 'Une question ? '; var b = document.createElement('b'); b.textContent = bits.join(' · '); line.appendChild(b); }
  else line.hidden = true;
  renderCart();
}

/* ====== collection ====== */
var FILTERS = [['all', 'Tous'], ['clair', 'Clairs'], ['sombre', 'Sombres'], ['couleur', 'Couleurs']];
var filter = 'all';
function renderChips() {
  $('#chips').innerHTML = FILTERS.map(function (f) {
    var n = f[0] === 'all' ? PRODUCTS.length : PRODUCTS.filter(function (p) { return p.group === f[0]; }).length;
    return '<button type="button" class="chip" data-f="' + f[0] + '" aria-pressed="' + (filter === f[0]) + '">' + f[1] + '<i>' + n + '</i></button>';
  }).join('');
}
$('#chips').addEventListener('click', function (e) {
  var b = e.target.closest('.chip'); if (!b) return;
  filter = b.getAttribute('data-f'); renderChips(); renderGrid();
});
function dots(p) {
  return p.colors.map(function (k) { return '<span class="dot" style="--c:' + COLORS[k].hex + '" title="' + esc(COLORS[k].name) + '"></span>'; }).join('');
}
function renderGrid() {
  var list = PRODUCTS.filter(function (p) { return filter === 'all' || p.group === filter; });
  $('#grid').innerHTML = list.map(function (p) {
    return '<li><button type="button" class="card" data-pid="' + p.id + '" aria-label="Voir ' + esc(p.name) + '">'
      + '<span class="plate"><img src="' + img(p.id) + '" alt="' + esc(p.name) + ' : devant et derrière" loading="lazy" width="306" height="152">'
      + '<span class="tag">Devant</span><span class="tag r">Derrière</span>'
      + '<svg class="pop" viewBox="0 0 24 24" aria-hidden="true"><path d="' + HEART_PATH + '"/></svg></span>'
      + '<span class="cmeta"><span class="num">' + pad(p.id) + '</span><span class="pname">' + esc(p.name) + '</span></span>'
      + '<span class="pback">' + esc(p.back) + '</span>'
      + '<span class="pquote"><small>Citation d’exemple</small>' + esc(gq(p.quote)) + '</span>'
      + '<span class="cfoot"><span class="dots">' + dots(p) + '</span><span class="price">' + money(CFG.price) + '</span></span>'
      + '</button></li>';
  }).join('');
}
$('#grid').addEventListener('click', function (e) {
  var c = e.target.closest('.card'); if (c) openProduct(+c.getAttribute('data-pid'));
});

/* coloris */
var TEE = 'M92 22L52 36L10 82L44 118L70 98V262Q150 270 230 262V98L256 118L290 82L248 36L208 22C198 46 176 56 150 56C124 56 102 46 92 22Z';
$('#colors').innerHTML = CATALOG_COLORS.map(function (k) {
  var c = COLORS[k];
  return '<li><svg viewBox="0 0 300 280" aria-hidden="true"><path d="' + TEE + '" fill="' + c.hex + '" stroke="rgba(128,128,128,.55)" stroke-width="3" stroke-linejoin="round"/>'
    + '<path d="M92 22C102 46 124 56 150 56C176 56 198 46 208 22" fill="none" stroke="rgba(128,128,128,.5)" stroke-width="3" stroke-linecap="round"/>'
    + '<path d="' + HEART_PATH + '" transform="translate(134 112) scale(1.35)" fill="none" stroke="' + (c.light ? '#151413' : '#F2EEE4') + '" stroke-width="1.8" stroke-linejoin="round"/></svg>' + esc(c.name) + '</li>';
}).join('');

/* ====== fiche produit ====== */
var sel = null;
function openProduct(pid) {
  var p = BY_ID[pid]; sel = { pid: pid, color: p.colors[0], size: 'M', emb: false };
  $('#pImg').src = img(pid); $('#pImg').alt = p.name + ' : devant et derrière';
  $('#pNum').textContent = 'Modèle ' + pad(pid);
  $('#pTitle').textContent = p.name;
  $('#pBack').textContent = p.back;
  $('#pQuote').textContent = gq(p.quote);
  $('#pColors').innerHTML = p.colors.map(function (k, i) {
    return '<label class="opt"><input type="radio" name="pcolor" value="' + k + '"' + (i === 0 ? ' checked' : '') + '><span class="face"><i style="--c:' + COLORS[k].hex + '"></i>' + esc(COLORS[k].name) + '</span></label>';
  }).join('');
  $('#pSizes').innerHTML = CFG.sizes.map(function (s) {
    return '<label class="opt"><input type="radio" name="psize" value="' + s + '"' + (s === 'M' ? ' checked' : '') + '><span class="face">' + s + '</span></label>';
  }).join('');
  $('#pEmb').checked = false;
  $('#pEmbPrice').textContent = '(+' + money(CFG.embroidery) + ')';
  updPTotal();
  openLayer($('#productOv'), '#pAdd');
}
function updPTotal() { $('#pTotal').textContent = money(CFG.price + (sel.emb ? CFG.embroidery : 0)); }
$('#productOv').addEventListener('change', function (e) {
  var t = e.target; if (!sel) return;
  if (t.name === 'pcolor') sel.color = t.value;
  else if (t.name === 'psize') sel.size = t.value;
  else if (t.id === 'pEmb') { sel.emb = t.checked; updPTotal(); }
});
$('#pAdd').addEventListener('click', function () {
  if (!sel) return;
  cart.push({ uid: uid(), pid: sel.pid, color: sel.color, size: sel.size, emb: sel.emb, quote: null, desc: '', draft: '', tried: [], regen: 0 });
  save(); updBadge(true);
  closeLayer($('#productOv'));
  toast(BY_ID[sel.pid].name + ' ajouté au panier');
});

/* ====== panier ====== */
function updBadge(bump) {
  var b = $('#badge'); b.textContent = cart.length; b.setAttribute('data-n', cart.length);
  $('#cartBtn').setAttribute('aria-label', 'Ouvrir le panier, ' + cart.length + ' article' + (cart.length > 1 ? 's' : ''));
  if (bump) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
}
function renderFreeShip() {
  var box = $('#fs'), t = CFG.freeShippingFrom;
  if (!t || !cart.length) { box.hidden = true; return; }
  var sub = subtotal(), left = t - sub;
  box.hidden = false;
  box.innerHTML = (left > 0
    ? 'Plus que <b>' + money(left) + '</b> pour la livraison offerte.'
    : '<b>Livraison offerte</b> sur ta commande.') + '<div class="bar"><i style="width:' + Math.min(100, Math.round(sub / t * 100)) + '%"></i></div>';
}
function renderCart() {
  var list = $('#dList'), foot = $('#dFoot');
  renderFreeShip();
  if (!cart.length) {
    list.innerHTML = '<div class="dempty"><svg viewBox="0 0 120 110" aria-hidden="true"><path d="M60 98C20 66 8 46 8 30A24 24 0 0 1 60 22 24 24 0 0 1 112 30c0 16-12 36-52 68z"/><path d="M44 48v6M76 48v6M46 68c9 8 19 8 28 0"/></svg><p>Ton panier est vide.</p><p>Un cœur t’attend dans la collection.</p></div>';
    foot.hidden = true; return;
  }
  foot.hidden = false;
  list.innerHTML = cart.map(function (l, i) {
    var p = BY_ID[l.pid], c = COLORS[l.color];
    return '<div class="line"><div class="th"><img src="' + img(l.pid) + '" alt=""></div>'
      + '<div><h3>' + esc(p.name) + '</h3><p class="sub">' + esc(c.name) + ' · ' + esc(l.size) + (l.emb ? ' · broderie cœur' : '') + '</p>'
      + (l.quote ? '<p class="q">' + esc(gq(l.quote)) + '</p>' : '<p class="q todo">Citation à créer à l’étape suivante</p>') + '</div>'
      + '<div class="right"><span>' + money(linePrice(l)) + '</span><button class="link rm" type="button" data-rm="' + i + '" aria-label="Retirer ' + esc(p.name) + ' du panier">Retirer</button></div></div>';
  }).join('');
  $('#dTotal').textContent = money(subtotal());
}
$('#dList').addEventListener('click', function (e) {
  var b = e.target.closest('[data-rm]'); if (!b) return;
  cart.splice(+b.getAttribute('data-rm'), 1); save(); updBadge(); renderCart();
});
$('#cartBtn').addEventListener('click', function () {
  renderCart(); openLayer($('#cartDr'), '#checkout');
  if (!cart.length) { var c = $('#cartDr [data-close]'); if (c) c.focus(); }
});

/* ====== création de la citation ====== */
var flowOv = $('#flowOv'), pv = $('#pv'), pvText = $('#pvText');
var flow = { i: 0, phase: 'write', ctl: null, busy: false, reveal: false, timer: 0 };

function paint(l, text, typing) {
  var c = COLORS[l.color];
  pv.style.setProperty('--tee', c.hex);
  pv.setAttribute('data-tone', c.light ? 'light' : 'dark');
  pv.classList.toggle('typing', !!typing);
  pvText.textContent = '';
  var el = document.createElement('span');
  if (text) { el.className = 'q'; el.textContent = text; }
  else { el.className = 'ph'; el.textContent = typing ? '…' : 'Ta citation apparaîtra ici'; }
  pvText.appendChild(el);
}
function clearTimer() { if (flow.timer) { clearInterval(flow.timer); flow.timer = 0; } }
/* La citation s'écrit lettre par lettre sur le t-shirt */
function typewrite(l, text) {
  clearTimer();
  if (reduceMotion) { paint(l, text, false); return; }
  var n = 0;
  flow.timer = setInterval(function () {
    n++; paint(l, text.slice(0, n), n < text.length);
    if (n >= text.length) clearTimer();
  }, 32);
}

function startFlow() {
  if (!cart.length) return;
  closeLayer($('#cartDr'), true);
  var first = cart.findIndex(function (l) { return !l.quote; });
  flow.i = first < 0 ? 0 : first;
  flow.phase = first < 0 ? 'recap' : 'write';
  var l = cart[flow.i];
  if (flow.phase === 'write' && l.desc.trim().length >= CFG.minDescription && l.draft) flow.phase = 'review';
  openLayer(flowOv);
  renderFlow();
}
$('#checkout').addEventListener('click', startFlow);

function stopGen() { clearTimer(); if (flow.ctl) { try { flow.ctl.abort(); } catch (e) {} flow.ctl = null; } flow.busy = false; }

function renderProg() {
  $('#flowProg').innerHTML = cart.map(function (l, i) { return '<i class="' + (l.quote ? 'on ' : '') + (i === flow.i && flow.phase !== 'recap' ? 'cur' : '') + '"></i>'; }).join('');
}
function setMsg(t, err) { var m = $('#flowMsg'); if (m) { m.textContent = t || ''; m.classList.toggle('err', !!err); } }

function renderFlow() {
  clearTimer();
  var recap = flow.phase === 'recap';
  $('#flowWrite').hidden = recap; $('#flowRecap').hidden = !recap;
  renderProg();
  if (recap) {
    $('#flowTitle').textContent = 'Tes citations';
    $('#flowWhere').textContent = cart.length + ' t-shirt' + (cart.length > 1 ? 's' : '') + ', ' + cart.length + ' citation' + (cart.length > 1 ? 's' : '');
    renderRecap(); return;
  }
  var l = cart[flow.i], p = BY_ID[l.pid];
  $('#flowTitle').textContent = 'Ta citation';
  $('#flowWhere').textContent = 'T-shirt ' + (flow.i + 1) + ' sur ' + cart.length + ' · ' + p.name + ' · ' + COLORS[l.color].name + ' · ' + l.size;
  var pane = $('#flowPane');
  var canAuto = server.online && server.quoteEnabled;

  if (flow.phase === 'write') {
    paint(l, l.quote || '', false);
    pane.innerHTML = '<h3>Parle-nous de toi</h3>'
      + '<p class="hint">Trois ou quatre phrases : ce qui te fait vibrer, ce que tu traverses, ce que tu rêves de devenir. Plus tu es précis, plus ta citation te ressemble.</p>'
      + '<label for="descIn">Ta description</label>'
      + '<textarea id="descIn" maxlength="600" placeholder="Ex. : Je suis timide, mais je rêve de monter sur scène un jour. Ma grand-mère me manque. J’écris mes poèmes dans le train."></textarea>'
      + '<div class="meta"><span id="descHelp"></span><span id="descCount"></span></div>'
      + '<div class="actions"><button type="button" class="btn btn-red" id="genBtn">Créer ma citation</button>'
      + '<button type="button" class="link" id="manualBtn">J’écris ma propre citation</button></div>'
      + '<p class="msg" id="flowMsg" role="status" aria-live="polite"></p>';
    var ta = $('#descIn'); ta.value = l.desc || '';
    var upd = function () {
      l.desc = ta.value; save();
      var n = ta.value.trim().length;
      $('#descCount').textContent = ta.value.length + ' / 600';
      $('#descHelp').textContent = n < CFG.minDescription ? ('Encore ' + (CFG.minDescription - n) + ' caractère' + (CFG.minDescription - n > 1 ? 's' : '') + ' pour une citation sur mesure') : '';
    };
    ta.addEventListener('input', upd); upd();
    $('#genBtn').addEventListener('click', generate);
    $('#manualBtn').addEventListener('click', function () { flow.phase = 'manual'; renderFlow(); });
    setTimeout(function () { ta.focus({ preventScroll: true }); }, 40);
    if (server.known && !canAuto) setMsg(server.online ? 'La création automatique n’est pas activée pour le moment. Tu peux écrire ta citation toi-même.' : 'Le serveur n’est pas lancé : la création automatique est indisponible. Tu peux écrire ta citation toi-même.');
  }

  else if (flow.phase === 'review') {
    var left = CFG.maxRegen - l.regen;
    if (flow.reveal) { flow.reveal = false; typewrite(l, l.draft); } else paint(l, l.draft, false);
    pane.innerHTML = '<h3>Voilà ta citation</h3>'
      + '<p class="big-q">' + esc(gq(l.draft)) + '</p>'
      + '<p class="hint">Elle sera imprimée sur le devant de ton t-shirt, sous un petit cœur. Tu la gardes ou tu en demandes une autre.</p>'
      + '<div class="actions"><button type="button" class="btn btn-red" id="keepBtn">Je la garde</button>'
      + '<button type="button" class="btn btn-ghost" id="againBtn" style="color:var(--ink);border-color:var(--ink)"' + (left <= 0 || !canAuto ? ' disabled' : '') + '>Une autre' + (left > 0 && canAuto ? ' (' + left + ' restante' + (left > 1 ? 's' : '') + ')' : '') + '</button></div>'
      + '<div class="actions"><button type="button" class="link" id="editDescBtn">Modifier ma description</button><button type="button" class="link" id="manualBtn">J’écris ma propre citation</button></div>'
      + '<p class="msg" id="flowMsg" role="status" aria-live="polite"></p>';
    $('#keepBtn').addEventListener('click', keep);
    $('#againBtn').addEventListener('click', function () { l.regen++; generate(); });
    $('#editDescBtn').addEventListener('click', function () { flow.phase = 'write'; renderFlow(); });
    $('#manualBtn').addEventListener('click', function () { flow.phase = 'manual'; renderFlow(); });
    setTimeout(function () { $('#keepBtn').focus({ preventScroll: true }); }, 40);
  }

  else if (flow.phase === 'manual') {
    var cur = l.draft || l.quote || '';
    paint(l, cur, false);
    pane.innerHTML = '<h3>Écris ta propre citation</h3>'
      + '<p class="hint">Une ou deux courtes phrases, 80 caractères au maximum. Elle sera imprimée telle quelle.</p>'
      + '<label for="manualIn">Ta citation</label>'
      + '<input class="in" id="manualIn" type="text" maxlength="80" autocomplete="off">'
      + '<div class="meta"><span></span><span id="mCount"></span></div>'
      + '<div class="actions"><button type="button" class="btn btn-red" id="keepBtn" disabled>Je garde cette citation</button>'
      + '<button type="button" class="link" id="backBtn">Retour</button></div>'
      + '<p class="msg" id="flowMsg" role="status" aria-live="polite"></p>';
    var inp = $('#manualIn'); inp.value = cur;
    var up2 = function () { var v = inp.value.trim(); l.draft = v; paint(l, v, false); $('#mCount').textContent = inp.value.length + ' / 80'; $('#keepBtn').disabled = v.length < 3; };
    inp.addEventListener('input', up2); up2();
    $('#keepBtn').addEventListener('click', keep);
    $('#backBtn').addEventListener('click', function () { flow.phase = 'write'; renderFlow(); });
    setTimeout(function () { inp.focus({ preventScroll: true }); }, 40);
  }
}

async function generate() {
  var l = cart[flow.i];
  var n = l.desc.trim().length;
  if (n < CFG.minDescription) { setMsg('Encore ' + (CFG.minDescription - n) + ' caractères et ta citation pourra s’écrire.', true); return; }
  if (!server.online || !server.quoteEnabled) {
    flow.phase = 'manual'; renderFlow();
    setMsg(server.online ? 'La création automatique n’est pas activée pour le moment. Tu peux écrire ta citation toi-même.' : 'Le serveur n’est pas lancé : tu peux écrire ta citation toi-même.');
    return;
  }
  if (l.draft) l.tried = (l.tried || []).concat(l.draft).slice(-4);
  stopGen();
  var ctl = new AbortController(); flow.ctl = ctl; flow.busy = true;
  var gb = $('#genBtn') || $('#againBtn'); if (gb) gb.disabled = true;
  var kb = $('#keepBtn'); if (kb) kb.disabled = true;
  setMsg('Ta citation s’écrit…');
  paint(l, '', true);
  try {
    var res = await fetch(CFG.api.quote, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ description: l.desc, tried: l.tried || [] })
    });
    var j = await res.json().catch(function () { return {}; });
    if (flow.ctl !== ctl) return;
    if (!res.ok || !j.quote) { var er = new Error('quote'); er.status = res.status; throw er; }
    l.draft = String(j.quote); flow.busy = false; flow.ctl = null; flow.phase = 'review'; flow.reveal = true; save(); renderFlow();
  } catch (e) {
    if (flow.ctl !== ctl) return;
    flow.busy = false; flow.ctl = null;
    if (e && e.name === 'AbortError') return;
    if (e.status === 503) { flow.phase = 'manual'; renderFlow(); setMsg('La création automatique n’est pas activée pour le moment. Tu peux écrire ta citation toi-même.'); return; }
    var hadDraft = l.tried && l.tried.length;
    if (hadDraft) l.draft = l.tried[l.tried.length - 1];
    flow.phase = hadDraft ? 'review' : 'write'; flow.reveal = false; renderFlow();
    setMsg(e.status === 429 ? 'Trop de demandes pour le moment. Réessaie dans un instant.'
      : e.status === 400 ? 'Ta description est trop courte ou trop longue. Reformule-la avec tes propres mots.'
      : 'La citation n’a pas pu être créée. Réessaie, ou écris la tienne.', true);
  }
}

function keep() {
  var l = cart[flow.i];
  var q = (l.draft || '').trim(); if (q.length < 3) return;
  l.quote = q; save();
  var next = cart.findIndex(function (x, i) { return !x.quote && i !== flow.i; });
  if (next >= 0) { flow.i = next; flow.phase = cart[next].desc.trim().length >= CFG.minDescription && cart[next].draft ? 'review' : 'write'; }
  else flow.phase = 'recap';
  renderFlow();
  $('#flowOv .sheet').scrollTop = 0;
}

function renderRecap() {
  var box = $('#flowRecap');
  box.innerHTML = '<h3>Tes t-shirts, tes phrases</h3>'
    + '<div class="rlist">' + cart.map(function (l, i) {
      var p = BY_ID[l.pid];
      return '<div class="ritem"><div class="th"><img src="' + img(l.pid) + '" alt=""></div>'
        + '<div><p class="big-q">' + esc(gq(l.quote || '')) + '</p><p class="sub">' + esc(p.name) + ' · ' + esc(COLORS[l.color].name) + ' · ' + esc(l.size) + (l.emb ? ' · broderie cœur' : '') + ' · ' + money(linePrice(l)) + '</p></div>'
        + '<div class="acts"><button type="button" class="link" data-edit="' + i + '">Modifier</button></div></div>';
    }).join('') + '</div>'
    + '<div class="rtotal"><span>Sous-total</span><b>' + money(subtotal()) + '</b></div>'
    + '<p class="hint">La livraison est calculée à l’étape suivante.</p>'
    + '<div class="actions"><button type="button" class="btn btn-red" id="goCheckout">Continuer vers la livraison</button></div>';
  $('#goCheckout').addEventListener('click', function () {
    closeLayer(flowOv, true);
    window.Coeurete.openCheckout();
  });
  $$('[data-edit]', box).forEach(function (b) {
    b.addEventListener('click', function () {
      flow.i = +b.getAttribute('data-edit'); var l = cart[flow.i]; l.draft = l.quote; flow.phase = 'review'; renderFlow();
    });
  });
  setTimeout(function () { var g = $('#goCheckout'); if (g) g.focus({ preventScroll: true }); }, 40);
}

/* ====== ce que checkout.js a le droit d'utiliser ====== */
window.Coeurete = {
  cfg: CFG, data: DATA, server: server, serverReady: serverReady,
  byId: BY_ID, colors: COLORS,
  getCart: function () { return cart; },
  clearCart: function () { cart = []; save(); updBadge(); renderCart(); },
  subtotal: subtotal, linePrice: linePrice,
  money: money, esc: esc, gq: gq, img: img, $: $, $$: $$,
  openLayer: openLayer, closeLayer: closeLayer, toast: toast,
  startFlow: startFlow, renderCart: renderCart,
  openCart: function () { renderCart(); openLayer($('#cartDr'), '#checkout'); },
  openCheckout: function () { throw new Error('checkout.js non chargé'); }
};

/* ====== démarrage ====== */
renderChips(); renderGrid(); updBadge(false); fillStatic();
})();

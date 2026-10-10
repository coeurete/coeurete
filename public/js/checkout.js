/*
 * COEURETE : livraison, paiement, confirmation et suivi de commande.
 * Dépend de app.js (window.Coeurete) et de config.js (prix, livraison, paiement).
 */
(function () {
'use strict';

var C = window.Coeurete, CFG = C.cfg, $ = C.$, $$ = C.$$, esc = C.esc, money = C.money, gq = C.gq;
var coOv = $('#coOv'), doneOv = $('#doneOv'), trackOv = $('#trackOv'), form = $('#coForm');
var state = { delivery: CFG.delivery[0].id, payment: 'cod', busy: false };

var FIELDS = {
  fullName: ['fName', 'eName'], phone: ['fPhone', 'ePhone'], email: ['fEmail', 'eEmail'],
  country: ['fCountry', 'eCountry'], city: ['fCity', 'eCity'], address: ['fAddress', 'eAddress'], notes: ['fNotes', 'eNotes'],
  deliveryId: [null, 'eDeliveryId'], paymentMethod: [null, 'ePaymentMethod'], items: [null, 'eItems']
};

/* ---------- aides ---------- */
function deliveryById(id) { return CFG.delivery.filter(function (d) { return d.id === id; })[0] || CFG.delivery[0]; }
function isFree() { return CFG.freeShippingFrom > 0 && C.subtotal() >= CFG.freeShippingFrom; }
function shippingFor(d) { return isFree() ? 0 : d.price; }
function total() { return C.subtotal() + shippingFor(deliveryById(state.delivery)); }
function clean(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }

function getSavedCustomer() { try { return JSON.parse(localStorage.getItem('coeurete-customer') || '{}') || {}; } catch (e) { return {}; } }
function saveCustomer(c) { try { localStorage.setItem('coeurete-customer', JSON.stringify(c)); } catch (e) {} }

/* ---------- formulaire ---------- */
function renderChoices() {
  $('#deliveryChoices').innerHTML = CFG.delivery.map(function (d) {
    var p = shippingFor(d);
    return '<label class="choice"><input type="radio" name="delivery" value="' + esc(d.id) + '"' + (d.id === state.delivery ? ' checked' : '') + '>'
      + '<span class="box"><span class="rad"></span><span><span class="t">' + esc(d.label) + '</span><span class="s">' + esc(d.delay) + '</span></span>'
      + '<span class="p">' + (p ? money(p) : 'Offerte') + '</span></span></label>';
  }).join('');
  var cardOk = C.server.cardEnabled;
  $('#paymentChoices').innerHTML = CFG.payments.map(function (m) {
    var off = m.id === 'card' && !cardOk;
    return '<label class="choice"><input type="radio" name="payment" value="' + esc(m.id) + '"' + (m.id === state.payment ? ' checked' : '') + (off ? ' disabled' : '') + '>'
      + '<span class="box"><span class="rad"></span><span><span class="t">' + esc(m.label) + '</span><span class="s">' + esc(off ? 'Pas encore disponible : choisis le paiement à la livraison.' : m.help) + '</span></span><span></span></span></label>';
  }).join('');
}

function renderSummary() {
  var cart = C.getCart(), d = deliveryById(state.delivery), ship = shippingFor(d);
  $('#coItems').innerHTML = cart.map(function (l) {
    var p = C.byId[l.pid];
    return '<li class="sitem"><div class="th"><img src="' + C.img(l.pid) + '" alt=""></div>'
      + '<div><div class="nm">' + esc(p.name) + '</div><div class="sub">' + esc(C.colors[l.color].name) + ' · ' + esc(l.size) + (l.emb ? ' · broderie cœur' : '') + '</div><div class="q">' + esc(gq(l.quote || '')) + '</div></div>'
      + '<div class="pr">' + money(C.linePrice(l)) + '</div></li>';
  }).join('');
  $('#coSums').innerHTML = '<div><dt>Sous-total</dt><dd>' + money(C.subtotal()) + '</dd></div>'
    + '<div><dt>Livraison</dt><dd>' + (ship ? money(ship) : 'Offerte') + '</dd></div>'
    + '<div class="tot"><dt>Total</dt><dd>' + money(total()) + '</dd></div>';
  $('#coTotal').textContent = money(total());
  $('#coEta').textContent = 'Préparation : ' + CFG.prepTime + '. Livraison : ' + d.delay.toLowerCase() + '.';
  $('#coSubmit').textContent = state.payment === 'card' ? 'Payer par carte' : 'Confirmer la commande';
}

function fillForm() {
  var s = getSavedCustomer();
  $('#fCountry').innerHTML = CFG.countries.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  $('#cityList').innerHTML = CFG.cities.map(function (c) { return '<option value="' + esc(c) + '"></option>'; }).join('');
  $('#fName').value = s.fullName || ''; $('#fPhone').value = s.phone || ''; $('#fEmail').value = s.email || '';
  if (s.country && CFG.countries.indexOf(s.country) >= 0) $('#fCountry').value = s.country;
  $('#fCity').value = s.city || ''; $('#fAddress').value = s.address || ''; $('#fNotes').value = s.notes || '';
}

function setErr(field, msg) {
  var ids = FIELDS[field] || [null, 'eItems'];
  var input = ids[0] && document.getElementById(ids[0]), err = document.getElementById(ids[1]);
  if (err) err.textContent = msg || '';
  if (input) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); if (msg) input.setAttribute('aria-describedby', ids[1]); }
}
function clearErrors() { Object.keys(FIELDS).forEach(function (f) { setErr(f, ''); }); $('#coMsg').textContent = ''; $('#coMsg').classList.remove('err'); }
function focusField(field) { var ids = FIELDS[field]; var el = ids && ids[0] && document.getElementById(ids[0]); if (el) el.focus(); }

function readCustomer() {
  return {
    fullName: clean($('#fName').value), phone: clean($('#fPhone').value), email: clean($('#fEmail').value),
    country: clean($('#fCountry').value), city: clean($('#fCity').value), address: clean($('#fAddress').value), notes: clean($('#fNotes').value)
  };
}

/* Mêmes règles que le serveur : le serveur revérifie toujours */
function validate(c) {
  var e = [];
  if (c.fullName.length < 3 || c.fullName.length > 80) e.push(['fullName', 'Indique ton nom complet.']);
  if (!/^\+?[0-9][0-9 ().-]{6,18}$/.test(c.phone)) e.push(['phone', 'Indique un numéro de téléphone valide.']);
  if (!/^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]{2,}$/.test(c.email)) e.push(['email', 'Indique une adresse e-mail valide : ta confirmation y sera envoyée.']);
  if (CFG.countries.indexOf(c.country) < 0) e.push(['country', 'Pays non disponible pour la livraison.']);
  if (c.city.length < 2) e.push(['city', 'Indique ta ville.']);
  if (c.address.length < 8) e.push(['address', 'Indique ton adresse complète (rue, numéro, quartier).']);
  if (c.notes.length > 240) e.push(['notes', 'Précisions trop longues (240 caractères maximum).']);
  return e;
}

function openCheckout() {
  var cart = C.getCart();
  if (!cart.length) { C.toast('Ton panier est vide.'); return; }
  if (cart.some(function (l) { return !l.quote; })) { C.startFlow(); return; }
  state.busy = false;
  var btn = $('#coSubmit'); btn.disabled = false;
  if (CFG.delivery.every(function (d) { return d.id !== state.delivery; })) state.delivery = CFG.delivery[0].id;
  if (state.payment === 'card' && !C.server.cardEnabled) state.payment = 'cod';
  fillForm(); clearErrors(); renderChoices(); renderSummary();
  C.openLayer(coOv, '#fName');
}
C.openCheckout = openCheckout;

form.addEventListener('change', function (e) {
  if (e.target.name === 'delivery') { state.delivery = e.target.value; renderChoices(); renderSummary(); }
  else if (e.target.name === 'payment') { state.payment = e.target.value; renderSummary(); }
});
form.addEventListener('input', function (e) {
  var id = e.target.id; Object.keys(FIELDS).forEach(function (f) { if (FIELDS[f][0] === id) setErr(f, ''); });
  var m = $('#coMsg'); if (m.classList.contains('err')) { m.textContent = ''; m.classList.remove('err'); }
});
$('#coBack').addEventListener('click', function () { C.closeLayer(coOv, true); C.startFlow(); });

/* ---------- envoi de la commande ---------- */
async function send(payload) {
  if (!C.server.online) {
    if (!CFG.demoFallback) throw { message: 'Le serveur est injoignable. Réessaie dans un instant.' };
    return { demo: true, orderId: 'DEMO-' + Date.now().toString(36).toUpperCase().slice(-6), total: total(), currency: CFG.currency, emailSent: false, emailMode: 'none' };
  }
  var res = await fetch(CFG.api.order, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  var j = await res.json().catch(function () { return {}; });
  if (!res.ok) { var er = j.error || {}; throw { field: er.field, message: er.message || 'La commande n’a pas pu être envoyée. Réessaie.' }; }
  return j;
}

form.addEventListener('submit', async function (ev) {
  ev.preventDefault();
  if (state.busy) return;
  clearErrors();
  var c = readCustomer(), errs = validate(c);
  if (errs.length) {
    errs.forEach(function (x) { setErr(x[0], x[1]); });
    focusField(errs[0][0]);
    $('#coMsg').textContent = 'Corrige les champs en rouge pour continuer.'; $('#coMsg').classList.add('err');
    return;
  }
  var cart = C.getCart();
  var payload = {
    customer: c, deliveryId: state.delivery, paymentMethod: state.payment,
    items: cart.map(function (l) { return { pid: l.pid, color: l.color, size: l.size, emb: !!l.emb, quote: l.quote }; })
  };
  state.busy = true; $('#coSubmit').disabled = true;
  $('#coMsg').textContent = state.payment === 'card' ? 'Redirection vers le paiement sécurisé…' : 'Envoi de ta commande…';
  try {
    var res = await send(payload);
    saveCustomer(c);
    if (res.redirectUrl && /^https:\/\//i.test(res.redirectUrl)) { window.location.href = res.redirectUrl; return; }
    var snapshot = { customer: c, items: cart.map(function (l) { return { quote: l.quote }; }), method: state.payment, delivery: deliveryById(state.delivery).label };
    C.clearCart();
    C.closeLayer(coOv, true);
    showDone(res, snapshot);
  } catch (e) {
    state.busy = false; $('#coSubmit').disabled = false;
    if (e && e.field && FIELDS[e.field]) { setErr(e.field, e.message); focusField(e.field); $('#coMsg').textContent = ''; }
    else { $('#coMsg').textContent = (e && e.message) || 'La commande n’a pas pu être envoyée. Réessaie.'; $('#coMsg').classList.add('err'); }
  }
});

/* ---------- commande confirmée ---------- */
var HEART = '<svg class="bigheart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C5 15 2 11.5 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 3.500-3 7-10 13z"/></svg>';

function showDone(res, ctx) {
  var first = ctx.customer.fullName.split(' ')[0];
  var notes = [];
  if (res.demo) {
    notes.push('<p class="notice warn"><b>Mode démo.</b> Le serveur n’est pas lancé : cette commande n’a pas été enregistrée ni envoyée. Lance <code>npm start</code> pour de vraies commandes.</p>');
  } else if (res.emailSent) {
    notes.push('<p class="notice">Un e-mail de confirmation est parti à <b>' + esc(ctx.customer.email) + '</b>. Pense à regarder tes spams si tu ne le vois pas.</p>');
  } else {
    notes.push('<p class="notice warn">Ta commande est bien enregistrée, mais l’e-mail de confirmation n’a pas pu être envoyé. Note ton numéro de commande : il te sert à la suivre.</p>');
  }
  if (ctx.method === 'cod') notes.push('<p>Paiement à la livraison : prépare <b>' + money(res.total) + '</b> en espèces pour le livreur.</p>');
  $('#doneBox').innerHTML = HEART
    + '<h2 id="doneTitle">Merci ' + esc(first) + ' !</h2>'
    + '<p>Ta commande est enregistrée. ' + esc(ctx.delivery) + ' : préparation ' + esc(CFG.prepTime) + ', puis livraison.</p>'
    + '<div class="oid" aria-label="Numéro de commande">' + esc(res.orderId) + '</div>'
    + notes.join('')
    + '<div class="quotes">' + ctx.items.map(function (i) { return '<q>' + esc(i.quote) + '</q>'; }).join('') + '</div>'
    + '<div class="actions" style="justify-content:center"><button type="button" class="btn btn-red" id="doneTrack">Suivre ma commande</button><button type="button" class="link" id="doneShop">Retour à la boutique</button></div>';
  $('#doneTrack').addEventListener('click', function () { C.closeLayer(doneOv, true); openTrack({ id: res.orderId, phone: ctx.customer.phone, auto: !res.demo }); });
  $('#doneShop').addEventListener('click', function () { C.closeLayer(doneOv); });
  C.openLayer(doneOv, '#doneTrack');
}

function showPaid(id) {
  $('#doneBox').innerHTML = HEART
    + '<h2 id="doneTitle">Merci !</h2>'
    + '<p>Ton paiement par carte est en cours de validation. Dès qu’il est confirmé, tu reçois un e-mail avec ton récapitulatif.</p>'
    + '<div class="oid" aria-label="Numéro de commande">' + esc(id) + '</div>'
    + '<p class="notice">Garde ce numéro de commande : avec ton téléphone, il te permet de suivre ton colis.</p>'
    + '<div class="actions" style="justify-content:center"><button type="button" class="btn btn-red" id="doneTrack">Suivre ma commande</button><button type="button" class="link" id="doneShop">Retour à la boutique</button></div>';
  $('#doneTrack').addEventListener('click', function () { C.closeLayer(doneOv, true); openTrack({ id: id }); });
  $('#doneShop').addEventListener('click', function () { C.closeLayer(doneOv); });
  C.openLayer(doneOv, '#doneTrack');
}

/* ---------- suivi de commande ---------- */
var STEPS = [
  ['Commande reçue', 'Ta commande est enregistrée.'],
  ['En préparation', 'Ton t-shirt est imprimé avec ta citation.'],
  ['Expédiée', 'Ton colis est en route.'],
  ['Livrée', 'Profite bien de ton cœur.']
];
var STEP_OF = { en_attente_paiement: 0, erreur_paiement: 0, nouvelle: 1, payee: 1, expediee: 2, livree: 3 };

function openTrack(opts) {
  opts = opts || {};
  $('#tResult').innerHTML = ''; $('#tMsg').textContent = ''; $('#tMsg').classList.remove('err');
  if (opts.id) $('#tId').value = opts.id;
  if (opts.phone) $('#tPhone').value = opts.phone;
  var saved = getSavedCustomer(); if (!$('#tPhone').value && saved.phone) $('#tPhone').value = saved.phone;
  C.openLayer(trackOv, opts.id && $('#tPhone').value ? '#tGo' : (opts.id ? '#tPhone' : '#tId'));
  if (opts.auto && opts.id && $('#tPhone').value) lookup();
}
function tmsg(t, err) { var m = $('#tMsg'); m.textContent = t || ''; m.classList.toggle('err', !!err); }

async function lookup() {
  var id = clean($('#tId').value).toUpperCase(), phone = clean($('#tPhone').value);
  $('#tResult').innerHTML = '';
  if (!id || phone.replace(/\D/g, '').length < 7) { tmsg('Indique ton numéro de commande et le téléphone utilisé à la commande.', true); return; }
  if (!C.server.online) { tmsg('Le suivi demande que le serveur soit lancé.', true); return; }
  $('#tGo').disabled = true; tmsg('Recherche de ta commande…');
  try {
    var res = await fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: id, phone: phone }) });
    var j = await res.json().catch(function () { return {}; });
    if (!res.ok) { tmsg((j.error && j.error.message) || 'Impossible de charger ta commande.', true); return; }
    tmsg(''); renderTrack(j.order);
  } catch (e) { tmsg('Impossible de joindre le serveur. Réessaie dans un instant.', true); }
  finally { $('#tGo').disabled = false; }
}
$('#trackForm').addEventListener('submit', function (e) { e.preventDefault(); lookup(); });

function renderTrack(o) {
  var html = '';
  if (o.status === 'annulee') {
    html += '<p class="notice warn" style="border:1.5px solid var(--red);padding:12px 16px">Cette commande a été annulée. Écris-nous si tu penses que c’est une erreur.</p>';
  } else {
    var idx = STEP_OF[o.status] != null ? STEP_OF[o.status] : 0;
    html += '<ol class="tl">' + STEPS.map(function (s, i) {
      var extra = '';
      if (i === 0 && o.status === 'en_attente_paiement') extra = 'En attente de ton paiement par carte.';
      else if (i === 0 && o.status === 'erreur_paiement') extra = 'Le paiement par carte n’a pas abouti.';
      else if (i === 2 && o.trackingNumber && idx >= 2) extra = 'N° de suivi transporteur : ' + o.trackingNumber;
      else extra = s[1];
      return '<li class="' + (i <= idx ? 'on' : '') + '"' + (i === idx ? ' aria-current="step"' : '') + '><b>' + s[0] + '</b><span>' + esc(extra) + '</span></li>';
    }).join('') + '</ol>';
  }
  html += '<div class="tbox"><b>' + esc(o.id) + '</b>'
    + o.items.map(function (i) { return '<div><div class="q">' + esc(gq(i.quote)) + '</div><span class="fine">' + esc(i.name) + ' · ' + esc(i.colorName) + ' · ' + esc(i.size) + '</span></div>'; }).join('')
    + '<span class="fine">' + esc(o.delivery) + ' (' + esc(o.delay) + ') vers ' + esc(o.city) + ' · ' + esc(o.paymentLabel) + ' · ' + money(o.total) + '</span>'
    + '<span class="fine">Commandée le ' + esc(new Date(o.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })) + '</span></div>';
  $('#tResult').innerHTML = html;
}

document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-open-track]'); if (!b) return;
  e.preventDefault();
  $$('.overlay:not([hidden]),.drawer:not([hidden])').forEach(function (el) { if (el !== trackOv) C.closeLayer(el, true); });
  openTrack();
});

/* ---------- retours d'une page externe (paiement carte, lien d'e-mail) ---------- */
(function () {
  var q = new URLSearchParams(window.location.search);
  var paid = q.get('paid'), cancelled = q.get('cancelled'), suivi = q.get('suivi');
  if (!paid && !cancelled && !suivi) return;
  try { history.replaceState(null, '', window.location.pathname + window.location.hash); } catch (e) {}
  C.serverReady.then(function () {
    if (paid) { C.clearCart(); showPaid(paid.slice(0, 40)); }
    else if (cancelled) { C.toast('Paiement annulé. Ton panier est conservé : tu peux réessayer ou payer à la livraison.'); C.openCart(); }
    else if (suivi) openTrack({ id: suivi.slice(0, 40) });
  });
})();
})();

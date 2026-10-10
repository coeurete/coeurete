'use strict';
/*
 * Commandes : validation, calcul des prix (toujours côté serveur) et
 * enregistrement dans data/orders.json.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CFG = require('../public/js/config.js');
const DATA = require('../public/js/data.js');

const FILE = path.join(__dirname, '..', 'data', 'orders.json');
const BY_ID = {};
DATA.PRODUCTS.forEach(p => { BY_ID[p.id] = p; });

function fail(field, message) { return { error: { field, message } }; }
function text(v, min, max) {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length >= min && s.length <= max ? s : null;
}

function validate(body, opts) {
  if (!body || typeof body !== 'object') return fail('body', 'Commande invalide.');
  const c = body.customer || {};

  const fullName = text(c.fullName, 3, 80);
  if (!fullName) return fail('fullName', 'Indique ton nom complet.');
  const phone = text(c.phone, 7, 20);
  if (!phone || !/^\+?[0-9][0-9 ().-]{6,18}$/.test(phone)) return fail('phone', 'Indique un numéro de téléphone valide.');
  const email = text(c.email, 5, 120);
  if (!email || !/^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]{2,}$/.test(email)) return fail('email', 'Indique une adresse e-mail valide : ta confirmation de commande y sera envoyée.');
  const country = text(c.country, 2, 40);
  if (!country || CFG.countries.indexOf(country) < 0) return fail('country', 'Pays non disponible pour la livraison.');
  const city = text(c.city, 2, 60);
  if (!city) return fail('city', 'Indique ta ville.');
  const address = text(c.address, 8, 240);
  if (!address) return fail('address', 'Indique ton adresse complète (rue, numéro, quartier).');
  let notes = '';
  if (c.notes) { notes = text(c.notes, 1, 240); if (!notes) return fail('notes', 'Précisions trop longues (240 caractères maximum).'); }

  const delivery = CFG.delivery.find(d => d.id === body.deliveryId);
  if (!delivery) return fail('deliveryId', 'Choisis un mode de livraison.');

  const payment = CFG.payments.find(p => p.id === body.paymentMethod);
  if (!payment) return fail('paymentMethod', 'Choisis un mode de paiement.');
  if (payment.id === 'card' && !opts.cardEnabled) return fail('paymentMethod', 'Le paiement par carte n’est pas disponible pour le moment.');

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 10) return fail('items', 'Ton panier doit contenir entre 1 et 10 t-shirts.');

  const items = [];
  for (const it of body.items) {
    const p = BY_ID[it && it.pid];
    if (!p) return fail('items', 'Un modèle du panier n’existe plus.');
    if (p.colors.indexOf(it.color) < 0) return fail('items', 'Un coloris du panier n’est pas disponible pour ' + p.name + '.');
    if (CFG.sizes.indexOf(it.size) < 0) return fail('items', 'Une taille du panier n’est pas valide.');
    const quote = text(it.quote, 3, 110);
    if (!quote) return fail('items', 'Chaque t-shirt doit avoir sa citation (3 à 110 caractères).');
    const emb = it.emb === true;
    items.push({
      pid: p.id, name: p.name, color: it.color, colorName: DATA.COLORS[it.color].name, size: it.size,
      emb, quote, unitPrice: CFG.price + (emb ? CFG.embroidery : 0)
    });
  }

  const subtotal = items.reduce((s, i) => s + i.unitPrice, 0);
  const free = CFG.freeShippingFrom > 0 && subtotal >= CFG.freeShippingFrom;
  const shipping = free ? 0 : delivery.price;

  return {
    order: {
      customer: { fullName, phone, email, country, city, address, notes },
      delivery: { id: delivery.id, label: delivery.label, delay: delivery.delay, price: shipping },
      payment: { method: payment.id, label: payment.label },
      items, subtotal, shipping, total: subtotal + shipping, currency: CFG.currency
    }
  };
}

/* ---------- stockage (fichier JSON, écritures une par une) ---------- */
let chain = Promise.resolve();
function readAll() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return []; }
}
function writeAll(list) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, FILE);
}
function enqueue(fn) {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
}

function newId() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return 'CO-' + d + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

function save(order) {
  return enqueue(() => {
    const list = readAll();
    const full = Object.assign({
      id: newId(),
      createdAt: new Date().toISOString(),
      // nouvelle = à préparer (paiement à la livraison) · en_attente_paiement = carte pas encore payée
      status: order.payment.method === 'cod' ? 'nouvelle' : 'en_attente_paiement'
    }, order);
    list.push(full);
    writeAll(list);
    return full;
  });
}

function update(id, patch) {
  return enqueue(() => {
    const list = readAll();
    const o = list.find(x => x.id === id);
    if (!o) return null;
    Object.assign(o, patch);
    writeAll(list);
    return o;
  });
}

function list() { return readAll().reverse(); }
function get(id) { return readAll().find(o => o.id === id) || null; }

const STATUSES = ['nouvelle', 'en_attente_paiement', 'payee', 'expediee', 'livree', 'annulee', 'erreur_paiement'];

/* Recherche pour le suivi : numéro de commande + téléphone (8 derniers chiffres) */
function digits(s) { return String(s || '').replace(/\D/g, ''); }
function find(id, phone) {
  const wanted = String(id || '').trim().toUpperCase();
  const tail = digits(phone).slice(-8);
  if (!wanted || tail.length < 7) return null;
  const o = readAll().find(x => x.id === wanted);
  if (!o || digits(o.customer.phone).slice(-8) !== tail) return null;
  return o;
}

/* Ce que le client a le droit de voir (pas d'adresse, ni d'e-mail, ni de téléphone) */
function publicView(o) {
  return {
    id: o.id, status: o.status, createdAt: o.createdAt,
    firstName: o.customer.fullName.split(' ')[0],
    city: o.customer.city,
    delivery: o.delivery.label, delay: o.delivery.delay,
    payment: o.payment.method, paymentLabel: o.payment.label,
    total: o.total, currency: o.currency,
    trackingNumber: o.trackingNumber || '',
    items: o.items.map(i => ({ name: i.name, colorName: i.colorName, size: i.size, quote: i.quote }))
  };
}

module.exports = { validate, save, update, list, get, find, publicView, STATUSES };

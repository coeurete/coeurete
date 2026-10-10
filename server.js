'use strict';
require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');

const CFG = require('./public/js/config.js');
const quotes = require('./server/quote.js');
const orders = require('./server/orders.js');
const payments = require('./server/payments.js');
const mail = require('./server/mail.js');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

/* Petite limite de requêtes par adresse IP (en mémoire) */
function limiter(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const list = (hits.get(req.ip) || []).filter(t => now - t < windowMs);
    if (list.length >= max) return res.status(429).json({ error: { code: 'rate_limited', message: 'Trop de demandes, réessaie dans un instant.' } });
    list.push(now);
    hits.set(req.ip, list);
    next();
  };
}

function baseUrl(req) {
  return (process.env.BASE_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
}

/* Envoie les e-mails d'une commande confirmée et note le résultat dans la commande */
async function notifyOrder(order, base) {
  const [customer, owner] = await Promise.all([mail.sendConfirmation(order, base), mail.sendOwnerAlert(order)]);
  await orders.update(order.id, { emailStatus: { customer: customer.mode === 'smtp' ? (customer.sent ? 'sent' : 'failed') : 'preview', owner: owner.mode === 'smtp' ? (owner.sent ? 'sent' : 'failed') : owner.mode } });
  return customer;
}

/* ---------- notification Stripe (corps brut obligatoire, avant express.json) ---------- */
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!payments.enabled() || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(404).end();
  let event;
  try { event = payments.readWebhook(req.body, req.get('stripe-signature')); }
  catch (e) { return res.status(400).send('Signature invalide'); }

  const obj = event.data.object || {};
  const id = obj.metadata && obj.metadata.orderId;
  try {
    if (id && event.type === 'checkout.session.completed') {
      const before = orders.get(id);
      if (before && before.status !== 'payee') {
        const paid = await orders.update(id, { status: 'payee', paidAt: new Date().toISOString() });
        await notifyOrder(paid, (process.env.BASE_URL || '').replace(/\/$/, ''));
      }
    } else if (id && event.type === 'checkout.session.expired') {
      const before = orders.get(id);
      if (before && before.status === 'en_attente_paiement') await orders.update(id, { status: 'annulee' });
    }
  } catch (e) { console.error('[webhook]', e); return res.status(500).end(); }
  res.json({ received: true });
});

app.use(express.json({ limit: '50kb' }));

/* ---------- API ---------- */
app.get('/api/config', (req, res) => {
  res.json({ cardEnabled: payments.enabled(), quoteEnabled: quotes.available(), emailEnabled: mail.smtpEnabled() });
});

app.post('/api/quote', limiter(12, 60 * 1000), async (req, res) => {
  const body = req.body || {};
  const description = typeof body.description === 'string' ? body.description.replace(/\s+/g, ' ').trim() : '';
  if (description.length < CFG.minDescription || description.length > 600) {
    return res.status(400).json({ error: { code: 'invalid', message: 'La description doit faire entre ' + CFG.minDescription + ' et 600 caractères.' } });
  }
  const tried = (Array.isArray(body.tried) ? body.tried : []).filter(t => typeof t === 'string').slice(-4).map(t => t.slice(0, 120));
  try {
    const quote = await quotes.generateQuote(description, tried);
    res.json({ quote });
  } catch (e) {
    const code = e.code || 'upstream_error';
    console.error('[quote]', e.message);
    res.status(code === 'unavailable' ? 503 : code === 'rate_limited' ? 429 : 502).json({ error: { code, message: 'La citation n’a pas pu être créée.' } });
  }
});

app.post('/api/orders', limiter(6, 60 * 1000), async (req, res) => {
  const v = orders.validate(req.body, { cardEnabled: payments.enabled() });
  if (v.error) return res.status(400).json({ error: Object.assign({ code: 'invalid' }, v.error) });

  let saved;
  try { saved = await orders.save(v.order); }
  catch (e) { console.error('[orders]', e); return res.status(500).json({ error: { code: 'server', message: 'La commande n’a pas pu être enregistrée.' } }); }

  const out = { orderId: saved.id, total: saved.total, currency: saved.currency, status: saved.status, emailSent: false, emailMode: 'none' };

  if (saved.payment.method === 'card') {
    try {
      const pay = await payments.createCardPayment(saved, baseUrl(req));
      out.redirectUrl = pay.url;
    } catch (e) {
      console.error('[payment]', e.message);
      await orders.update(saved.id, { status: 'erreur_paiement' });
      return res.status(502).json({ error: { code: 'payment', message: 'Le paiement par carte n’a pas pu démarrer. Choisis le paiement à la livraison ou réessaie.' } });
    }
    return res.status(201).json(out);
  }

  // Paiement à la livraison : la commande est confirmée tout de suite
  try {
    const c = await notifyOrder(saved, baseUrl(req));
    out.emailSent = c.sent;
    out.emailMode = c.mode;
  } catch (e) { console.error('[mail]', e); }
  res.status(201).json(out);
});

/* Suivi de commande : numéro + téléphone */
app.post('/api/track', limiter(20, 60 * 1000), (req, res) => {
  const b = req.body || {};
  const o = orders.find(b.orderId, b.phone);
  if (!o) return res.status(404).json({ error: { code: 'not_found', message: 'Aucune commande ne correspond à ce numéro et à ce téléphone.' } });
  res.json({ order: orders.publicView(o) });
});

/* ---------- administration ---------- */
function adminOk(req) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const given = String(req.get('x-admin-token') || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(token).digest();
  return crypto.timingSafeEqual(a, b);
}
function adminGuard(req, res, next) {
  if (!process.env.ADMIN_TOKEN) return res.status(404).end();
  if (!adminOk(req)) return res.status(401).json({ error: { code: 'unauthorized', message: 'Mot de passe incorrect.' } });
  next();
}
app.get('/api/admin/orders', limiter(30, 60 * 1000), adminGuard, (req, res) => {
  res.json({ orders: orders.list() });
});
app.patch('/api/admin/orders/:id', limiter(60, 60 * 1000), adminGuard, async (req, res) => {
  const o = orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: { code: 'not_found', message: 'Commande introuvable.' } });
  const status = req.body && req.body.status;
  if (orders.STATUSES.indexOf(status) < 0) return res.status(400).json({ error: { code: 'invalid', message: 'Statut inconnu.' } });

  const patch = { status };
  const tn = req.body.trackingNumber;
  if (typeof tn === 'string' && tn.trim()) patch.trackingNumber = tn.replace(/[\u0000-\u001F]/g, '').trim().slice(0, 60);
  if (status === 'expediee') patch.shippedAt = new Date().toISOString();
  if (status === 'livree') patch.deliveredAt = new Date().toISOString();
  const updated = await orders.update(o.id, patch);

  let email = null;
  if (status === 'expediee' && o.status !== 'expediee') {
    const r = await mail.sendShipped(updated, baseUrl(req));
    email = { sent: r.sent, mode: r.mode };
  }
  res.json({ order: updated, email });
});
app.get('/admin', (req, res) => {
  if (!process.env.ADMIN_TOKEN) return res.status(404).send('Administration désactivée : définis ADMIN_TOKEN dans .env');
  res.sendFile(path.join(__dirname, 'server', 'admin.html'));
});

/* ---------- le site ---------- */
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

/* Erreurs : toujours en JSON pour l'API */
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'invalid', message: 'Requête illisible.' } });
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: { code: 'invalid', message: 'Requête trop volumineuse.' } });
  console.error(err);
  res.status(500).json({ error: { code: 'server', message: 'Erreur du serveur.' } });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('Coeurete : http://localhost:' + PORT);
    console.log(' - citation IA     : ' + (quotes.available() ? 'activée' : 'désactivée (pas de ANTHROPIC_API_KEY)'));
    console.log(' - paiement carte  : ' + (payments.enabled() ? 'activé (Stripe)' : 'désactivé (pas de STRIPE_SECRET_KEY)'));
    console.log(' - e-mails clients : ' + (mail.smtpEnabled() ? 'activés (SMTP)' : 'désactivés : les e-mails sont enregistrés dans data/outbox (voir SMTP_* dans .env)'));
    console.log(' - administration  : ' + (process.env.ADMIN_TOKEN ? 'http://localhost:' + PORT + '/admin' : 'désactivée (pas de ADMIN_TOKEN)'));
  });
}
module.exports = app;

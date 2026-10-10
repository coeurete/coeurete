'use strict';
/*
 * E-mails de la boutique :
 *   - confirmation de commande envoyée au client
 *   - alerte « nouvelle commande » envoyée à toi
 *   - « ta commande est expédiée » envoyée au client
 *
 * L'envoi passe par ton adresse e-mail (SMTP, voir .env). Sans réglages SMTP,
 * rien n'est envoyé : chaque e-mail est enregistré dans data/outbox/ pour que
 * tu puisses voir à quoi il ressemble.
 */
const fs = require('fs');
const path = require('path');
const CFG = require('../public/js/config.js');

const OUTBOX = path.join(__dirname, '..', 'data', 'outbox');

function smtpEnabled() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transport = null;
function getTransport() {
  if (!transport) {
    const nodemailer = require('nodemailer');
    const port = Number(process.env.SMTP_PORT) || 465;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000
    });
  }
  return transport;
}

function fromAddress() {
  return process.env.MAIL_FROM || (CFG.brand + ' <' + (process.env.SMTP_USER || 'no-reply@localhost') + '>');
}

/* ---------- gabarits ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(n, currency) {
  try { return new Intl.NumberFormat(CFG.locale || 'fr-FR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n); }
  catch (e) { return n + ' ' + currency; }
}
const RED = '#D42A34', INK = '#151413', PAPER = '#F2EEE4', MUTED = '#6B655B', LINE = '#D9D2C2';

function layout(title, bodyHtml) {
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title></head>' +
    '<body style="margin:0;padding:0;background:' + PAPER + ';font-family:Helvetica,Arial,sans-serif;color:' + INK + ';">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + PAPER + ';"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ' + LINE + ';">' +
    '<tr><td style="background:#0F0E0E;color:' + PAPER + ';padding:22px 28px;font-family:Impact,\'Arial Narrow\',Arial,sans-serif;font-size:30px;letter-spacing:2px;">' + esc(CFG.brand.toUpperCase()) + ' <span style="color:' + RED + ';">&#9829;</span>' +
    '<div style="font-family:Georgia,serif;font-style:italic;font-size:14px;letter-spacing:0;color:#A9A499;margin-top:2px;">Plus qu’un t-shirt, un état d’esprit.</div></td></tr>' +
    '<tr><td style="padding:28px;">' + bodyHtml + '</td></tr>' +
    '<tr><td style="padding:18px 28px;border-top:1px solid ' + LINE + ';font-size:12px;color:' + MUTED + ';">' + footerText() + '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function footerText() {
  const c = CFG.contact || {};
  const bits = [];
  if (c.email) bits.push(esc(c.email));
  if (c.phone) bits.push(esc(c.phone));
  if (c.instagram) bits.push(esc(c.instagram));
  return (bits.length ? 'Une question ? ' + bits.join(' · ') + '<br>' : '') + 'Des cœurs partout, pour toujours.';
}

function itemsTable(order) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 0;">' + order.items.map(i =>
    '<tr><td style="padding:14px 0;border-top:1px solid ' + LINE + ';">' +
    '<div style="font-weight:bold;font-size:15px;">' + esc(i.name) + '</div>' +
    '<div style="font-size:13px;color:' + MUTED + ';">' + esc(i.colorName) + ' · ' + esc(i.size) + (i.emb ? ' · broderie cœur' : '') + '</div>' +
    '<div style="font-family:Georgia,serif;font-style:italic;font-size:19px;line-height:1.25;margin-top:6px;">« ' + esc(i.quote) + ' »</div></td>' +
    '<td align="right" valign="top" style="padding:14px 0;border-top:1px solid ' + LINE + ';font-size:14px;white-space:nowrap;">' + esc(money(i.unitPrice, order.currency)) + '</td></tr>'
  ).join('') + '</table>';
}

function totalsTable(order) {
  const row = (a, b, strong) => '<tr><td style="padding:4px 0;font-size:' + (strong ? 16 : 14) + 'px;' + (strong ? 'font-weight:bold;' : 'color:' + MUTED + ';') + '">' + a + '</td><td align="right" style="padding:4px 0;font-size:' + (strong ? 16 : 14) + 'px;' + (strong ? 'font-weight:bold;' : '') + '">' + b + '</td></tr>';
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid ' + INK + ';margin-top:6px;padding-top:6px;">' +
    row('Sous-total', esc(money(order.subtotal, order.currency))) +
    row(esc(order.delivery.label), order.shipping ? esc(money(order.shipping, order.currency)) : 'Offerte') +
    row('Total', esc(money(order.total, order.currency)), true) + '</table>';
}

function trackLink(order, base) {
  if (!base) return '';
  const url = base + '/?suivi=' + encodeURIComponent(order.id);
  return '<p style="margin:22px 0 0;"><a href="' + esc(url) + '" style="display:inline-block;background:' + RED + ';color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;">Suivre ma commande</a></p>';
}

function paymentNote(order) {
  if (order.payment.method === 'cod') return 'Paiement à la livraison : prépare <b>' + esc(money(order.total, order.currency)) + '</b> en espèces pour le livreur.';
  return 'Paiement par carte : <b>' + esc(money(order.total, order.currency)) + '</b>.';
}

function addressBlock(order) {
  const c = order.customer;
  return esc(c.fullName) + '<br>' + esc(c.address) + '<br>' + esc(c.city) + ', ' + esc(c.country) + '<br>' + esc(c.phone) + (c.notes ? '<br><i>' + esc(c.notes) + '</i>' : '');
}

function confirmationMail(order, base) {
  const first = order.customer.fullName.split(' ')[0];
  const subject = 'Ta commande ' + order.id + ' est confirmée';
  const html = layout(subject,
    '<h1 style="margin:0 0 6px;font-size:24px;">Merci ' + esc(first) + ' !</h1>' +
    '<p style="margin:0 0 18px;color:' + MUTED + ';">Ta commande est bien reçue. Chaque t-shirt est imprimé avec la citation écrite pour toi.</p>' +
    '<p style="margin:0 0 18px;padding:12px 16px;border:2px dashed ' + INK + ';font-family:Impact,\'Arial Narrow\',Arial,sans-serif;font-size:22px;letter-spacing:2px;text-align:center;">' + esc(order.id) + '</p>' +
    itemsTable(order) + totalsTable(order) +
    '<p style="margin:20px 0 4px;font-weight:bold;">Livraison</p><p style="margin:0;font-size:14px;line-height:1.5;">' + addressBlock(order) + '</p>' +
    '<p style="margin:10px 0 0;font-size:14px;color:' + MUTED + ';">' + esc(order.delivery.label) + ' · ' + esc(order.delivery.delay) + (CFG.prepTime ? ' (après ' + esc(CFG.prepTime) + ' de préparation)' : '') + '</p>' +
    '<p style="margin:16px 0 0;font-size:14px;">' + paymentNote(order) + '</p>' +
    trackLink(order, base) +
    '<p style="margin:22px 0 0;font-size:13px;color:' + MUTED + ';">Pour suivre ta commande, garde ce numéro et le téléphone utilisé à la commande.</p>');
  const text = 'Merci ' + first + ' ! Ta commande ' + order.id + ' est bien reçue.\n\n' +
    order.items.map(i => '- ' + i.name + ' · ' + i.colorName + ' · ' + i.size + '\n  « ' + i.quote + ' »').join('\n') +
    '\n\nTotal : ' + money(order.total, order.currency) + '\nLivraison : ' + order.delivery.label + ' (' + order.delivery.delay + ')\n' +
    order.customer.address + ', ' + order.customer.city + '\n' + (base ? '\nSuivi : ' + base + '/?suivi=' + order.id + '\n' : '');
  return { subject, html, text };
}

function ownerMail(order) {
  const subject = 'Nouvelle commande ' + order.id + ' · ' + money(order.total, order.currency) + ' · ' + (order.payment.method === 'cod' ? 'paiement à la livraison' : 'carte');
  const html = layout(subject,
    '<h1 style="margin:0 0 6px;font-size:22px;">Nouvelle commande</h1>' +
    '<p style="margin:0 0 14px;color:' + MUTED + ';">' + esc(order.id) + ' · ' + esc(order.payment.label) + '</p>' +
    itemsTable(order) + totalsTable(order) +
    '<p style="margin:20px 0 4px;font-weight:bold;">Client</p><p style="margin:0;font-size:14px;line-height:1.5;">' + addressBlock(order) + '<br>' + esc(order.customer.email) + '</p>' +
    '<p style="margin:14px 0 0;font-size:14px;">' + esc(order.delivery.label) + ' · ' + esc(order.delivery.delay) + '</p>');
  const text = 'Nouvelle commande ' + order.id + '\n' + order.customer.fullName + ' · ' + order.customer.phone + ' · ' + order.customer.email + '\n' +
    order.customer.address + ', ' + order.customer.city + '\n\n' +
    order.items.map(i => '- ' + i.name + ' · ' + i.colorName + ' · ' + i.size + (i.emb ? ' · broderie' : '') + '\n  « ' + i.quote + ' »').join('\n') +
    '\n\nTotal : ' + money(order.total, order.currency) + ' (' + order.payment.label + ')';
  return { subject, html, text };
}

function shippedMail(order, base) {
  const first = order.customer.fullName.split(' ')[0];
  const subject = 'Ta commande ' + order.id + ' est expédiée';
  const html = layout(subject,
    '<h1 style="margin:0 0 6px;font-size:24px;">C’est parti, ' + esc(first) + ' !</h1>' +
    '<p style="margin:0 0 16px;color:' + MUTED + ';">Ta commande ' + esc(order.id) + ' vient d’étre confiée au livreur. Délai annoncé : ' + esc(order.delivery.delay) + '.</p>' +
    (order.trackingNumber ? '<p style="margin:0 0 16px;padding:12px 16px;background:' + PAPER + ';font-size:14px;">Numéro de suivi du transporteur : <b>' + esc(order.trackingNumber) + '</b></p>' : '') +
    '<p style="margin:0 0 4px;font-weight:bold;">Adresse de livraison</p><p style="margin:0;font-size:14px;line-height:1.5;">' + addressBlock(order) + '</p>' +
    '<p style="margin:16px 0 0;font-size:14px;">' + paymentNote(order) + '</p>' + trackLink(order, base));
  const text = 'Ta commande ' + order.id + ' est expédiée (' + order.delivery.delay + ').' + (order.trackingNumber ? '\nSuivi transporteur : ' + order.trackingNumber : '') + (base ? '\nSuivi : ' + base + '/?suivi=' + order.id : '');
  return { subject, html, text };
}

/* ---------- envoi ---------- */
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50); }

async function deliver(to, mail) {
  if (!smtpEnabled()) {
    try {
      fs.mkdirSync(OUTBOX, { recursive: true });
      const file = path.join(OUTBOX, new Date().toISOString().replace(/[:.]/g, '-') + '_' + slug(to) + '_' + slug(mail.subject) + '.html');
      fs.writeFileSync(file, '<!-- À : ' + to + ' | Objet : ' + mail.subject + ' -->\n' + mail.html);
      return { sent: false, mode: 'preview', file: path.relative(process.cwd(), file) };
    } catch (e) { return { sent: false, mode: 'preview', error: e.message }; }
  }
  try {
    await getTransport().sendMail({ from: fromAddress(), to, subject: mail.subject, text: mail.text, html: mail.html });
    return { sent: true, mode: 'smtp' };
  } catch (e) {
    console.error('[mail] échec vers', to, '-', e.message);
    return { sent: false, mode: 'smtp', error: e.message };
  }
}

function ownerAddress() { return process.env.OWNER_EMAIL || process.env.SMTP_USER || ''; }

module.exports = {
  smtpEnabled,
  sendConfirmation: (order, base) => deliver(order.customer.email, confirmationMail(order, base)),
  sendShipped: (order, base) => deliver(order.customer.email, shippedMail(order, base)),
  sendOwnerAlert: (order) => ownerAddress() ? deliver(ownerAddress(), ownerMail(order)) : Promise.resolve({ sent: false, mode: 'none' })
};

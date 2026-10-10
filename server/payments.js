'use strict';
/*
 * Paiement par carte : redirection vers une page de paiement hébergée.
 * Les numéros de carte ne passent JAMAIS par ton site ni ton serveur.
 *
 * Ce fichier contient l'adaptateur Stripe (Stripe Checkout). Pour un autre
 * fournisseur (CMI, PayZone, YouCan Pay...), garde la même forme :
 *   enabled()                    -> true si le fournisseur est configuré
 *   createCardPayment(order, baseUrl) -> { url }  (page où envoyer le client)
 * et branche-le dans server.js à la place de Stripe.
 */
const CFG = require('../public/js/config.js');

let stripeClient = null;
function stripe() {
  if (!stripeClient) {
    const Stripe = require('stripe');
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

function enabled() { return Boolean(process.env.STRIPE_SECRET_KEY); }

async function createCardPayment(order, baseUrl) {
  const currency = (process.env.STRIPE_CURRENCY || CFG.currency).toLowerCase();
  const line_items = order.items.map(i => ({
    quantity: 1,
    price_data: {
      currency,
      unit_amount: Math.round(i.unitPrice * 100),
      product_data: {
        name: i.name + ' · ' + i.colorName + ' · ' + i.size,
        description: 'Citation : ' + i.quote
      }
    }
  }));
  if (order.shipping > 0) {
    line_items.push({
      quantity: 1,
      price_data: { currency, unit_amount: Math.round(order.shipping * 100), product_data: { name: order.delivery.label } }
    });
  }
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    line_items,
    client_reference_id: order.id,
    metadata: { orderId: order.id },
    customer_email: order.customer.email || undefined,
    success_url: baseUrl + '/?paid=' + encodeURIComponent(order.id),
    cancel_url: baseUrl + '/?cancelled=' + encodeURIComponent(order.id)
  });
  return { url: session.url, sessionId: session.id };
}

/* Vérifie la signature d'une notification Stripe et renvoie l'événement */
function readWebhook(rawBody, signature) {
  return stripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

module.exports = { enabled, createCardPayment, readWebhook};
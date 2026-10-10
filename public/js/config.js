/*
 * RÉGLAGES DE LA BOUTIQUE
 * ------------------------------------------------------------------
 * C'est ici que tu changes les prix, la monnaie, les modes de livraison
 * et les modes de paiement. Ce fichier est lu à la fois par le site
 * (navigateur) et par le serveur (Node), donc les prix sont toujours
 * recalculés côté serveur avec ces mêmes valeurs.
 *
 * Les prix ci-dessous sont des exemples : remplace-les par les tiens.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.COEURETE_CONFIG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    brand: 'Coeurete',

    // Monnaie et format d'affichage
    currency: 'MAD',
    locale: 'fr-MA',

    // Prix (dans la monnaie ci-dessus)
    price: 189,          // prix d'un t-shirt
    embroidery: 20,      // supplément « petit cœur brodé sur la manche »
    sizes: ['S', 'M', 'L', 'XL'],

    // Livraison offerte à partir de ce montant de t-shirts (0 = jamais offerte)
    freeShippingFrom: 500,

    delivery: [
      { id: 'standard', label: 'Livraison à domicile', delay: '2 à 4 jours ouvrables', price: 35 },
      { id: 'express',  label: 'Livraison express',    delay: '24 à 48 h dans les grandes villes', price: 60 }
    ],

    // Modes de paiement proposés au client
    payments: [
      { id: 'cod',  label: 'Paiement à la livraison', help: 'Tu paies en espèces au livreur, à la réception de ton colis.' },
      { id: 'card', label: 'Carte bancaire',          help: 'Tu es redirigé vers la page de paiement sécurisée. Aucune donnée de carte n’est saisie sur ce site.' }
    ],

    // Chaque t-shirt est imprimé après la commande : temps de préparation avant l'expédition
    prepTime: '1 à 3 jours ouvrables',

    // Texte de la politique d'échange (à adapter à tes vraies règles)
    returnsText: 'Si la taille ne te va pas, écris-nous avec ton numéro de commande et nous trouvons une solution. Comme chaque t-shirt est imprimé avec une citation écrite pour toi, il ne peut pas être repris pour un simple changement d’avis.',

    // Tes coordonnées, affichées sur le site et dans les e-mails (laisse '' pour ne rien afficher)
    contact: { email: '', phone: '', instagram: '' },

    countries: ['Maroc'],
    cities: ['Casablanca', 'Rabat', 'Salé', 'Kénitra', 'Marrakech', 'Fès', 'Meknès', 'Tanger', 'Tétouan', 'Agadir', 'Oujda', 'Témara', 'Mohammedia', 'El Jadida', 'Safi', 'Nador', 'Béni Mellal', 'Laâyoune'],

    // Création de la citation
    minDescription: 40,   // nombre minimum de caractères de la description du client
    maxRegen: 4,          // nombre de « Une autre » possibles par t-shirt

    // Adresses de l'API (ne change rien tant que tu utilises server.js)
    api: { config: '/api/config', quote: '/api/quote', order: '/api/orders' },

    // La carte est proposée tant que le serveur ne dit pas le contraire (voir .env)
    cardEnabled: true,

    // Si le serveur n'est pas lancé (ex. ouverture avec Live Server), la commande est
    // simulée dans le navigateur au lieu d'être envoyée. Mets false en production.
    demoFallback: true
  };
});

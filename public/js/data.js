/*
 * CATALOGUE : les 15 modèles et les coloris.
 * Lu par le site et par le serveur (qui vérifie chaque commande).
 * Pour ajouter un modèle : ajoute une ligne dans PRODUCTS et dépose
 * l'image dans public/assets/img/pNN.jpg (NN = id sur deux chiffres).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.COEURETE_DATA = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var COLORS = {
    blanc:      { name: 'Blanc',      hex: '#F3EFE6', light: true },
    noir:       { name: 'Noir',       hex: '#151413', light: false },
    gris:       { name: 'Gris',       hex: '#8F8C88', light: true },
    anthracite: { name: 'Anthracite', hex: '#3B3C3F', light: false },
    kaki:       { name: 'Kaki',       hex: '#56603F', light: false },
    bleu:       { name: 'Bleu ciel',  hex: '#9DC4E8', light: true },
    rose:       { name: 'Rose',       hex: '#E8A9B2', light: true },
    beige:      { name: 'Beige',      hex: '#D9CDB8', light: true },
    rouge:      { name: 'Rouge cœur', hex: '#D42A34', light: false },
    marine:     { name: 'Marine',     hex: '#1D2C4B', light: false },
    sable:      { name: 'Sable',      hex: '#B9A98E', light: true }
  };

  // Les 8 coloris de la planche
  var CATALOG_COLORS = ['blanc', 'noir', 'gris', 'anthracite', 'kaki', 'bleu', 'rose', 'beige'];

  // group : clair | sombre | couleur (sert au filtre de la collection)
  var PRODUCTS = [
    { id: 1,  name: 'Classic Heart',     quote: 'Tout ira bien.',                          back: 'Un grand cœur rouge tracé au marqueur, avec ses bras et ses jambes.', group: 'clair',   colors: ['blanc', 'rouge', 'noir'] },
    { id: 2,  name: 'Minimal Quote',     quote: 'Rêve grand. Travaille dur. Reste humble.', back: 'Un cœur rayonnant, tracé en lignes concentriques.',                 group: 'sombre',  colors: ['noir', 'blanc', 'gris'] },
    { id: 3,  name: 'Broken Heart',      quote: 'Même brisé, le cœur aime encore.',         back: 'Un cœur brisé qui coule, sur un t-shirt délavé.',                   group: 'sombre',  colors: ['anthracite', 'gris', 'blanc'] },
    { id: 4,  name: 'Love & Dream',      quote: 'Love Dream Create.',                       back: 'Un petit cœur bonhomme, les bras grands ouverts.',                  group: 'clair',   colors: ['blanc', 'rouge', 'noir'] },
    { id: 5,  name: 'Heart in the Sky',  quote: 'Les beaux jours arrivent.',                back: 'Un cœur posé sur un nuage.',                                        group: 'sombre',  colors: ['noir', 'blanc', 'bleu'] },
    { id: 6,  name: 'Double Heart',      quote: 'Toi + Moi = ♡',                       back: 'Deux cœurs rouges qui se tiennent par la main.',                    group: 'clair',   colors: ['blanc', 'rouge', 'noir'] },
    { id: 7,  name: 'Dark Vibes',        quote: 'Même dans la nuit, je vois la lumière.',   back: 'Un cœur en flammes au regard malicieux.',                           group: 'sombre',  colors: ['noir', 'gris', 'blanc'] },
    { id: 8,  name: 'The Journey',       quote: 'Un pas après l’autre.',               back: 'Un cœur randonneur, entre montagnes et soleil.',                    group: 'couleur', colors: ['kaki', 'beige', 'blanc'] },
    { id: 9,  name: 'Street Heart',      quote: 'C’est la vie.',                       back: 'Un cœur couronné façon graffiti, qui dégouline.',                   group: 'sombre',  colors: ['noir', 'gris', 'blanc'] },
    { id: 10, name: 'Vintage',           quote: 'Les rêves n’ont pas de prix.',        back: 'Un cœur bonhomme qui tient une fleur.',                             group: 'clair',   colors: ['beige', 'sable', 'noir'] },
    { id: 11, name: 'Aesthetic',         quote: 'Plus d’amour. Moins de stress.',      back: 'Un cœur bonhomme au trait fin.',                                    group: 'couleur', colors: ['bleu', 'blanc', 'marine'] },
    { id: 12, name: 'Abstract',          quote: 'Le cœur sait.',                            back: 'Un cœur gribouillé au marqueur.',                                   group: 'couleur', colors: ['rose', 'beige', 'anthracite'] },
    { id: 13, name: 'Words Only (Typo)', quote: 'Amour. Équilibre. Ambition. Liberté.',     back: 'Quatre mots manuscrits : Amour, Équilibre, Ambition, Liberté.',     group: 'sombre',  colors: ['noir', 'blanc', 'gris'] },
    { id: 14, name: 'Full Back Art',     quote: 'La vie est belle.',                        back: 'Un grand cœur couronné qui occupe tout le dos.',                    group: 'clair',   colors: ['beige', 'rouge', 'noir'] },
    { id: 15, name: 'Collage',           quote: 'Rien n’est impossible.',              back: 'Un collage de cœurs, de mots et de gribouillis.',                   group: 'sombre',  colors: ['noir', 'blanc', 'gris'] }
  ];

  return { COLORS: COLORS, CATALOG_COLORS: CATALOG_COLORS, PRODUCTS: PRODUCTS };
});

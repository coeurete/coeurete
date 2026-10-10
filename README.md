# Coeurete — boutique en ligne

T-shirts oversize avec un cœur dessiné au dos et une **citation unique pour chaque client** sur le devant.
Le client décrit qui il est, une IA écrit sa citation, puis il renseigne sa livraison et choisit son paiement
(à la livraison ou par carte). Il reçoit un e-mail de confirmation, et toi une alerte de nouvelle commande.

## Démarrer (Visual Studio Code)

1. Installe [Node.js](https://nodejs.org) (version 18 ou plus).
2. Ouvre ce dossier dans VS Code (`Fichier > Ouvrir un dossier`), puis ouvre le terminal (`Ctrl + ù` ou `Terminal > Nouveau terminal`).
3. Installe les dépendances (une seule fois) :
   ```bash
   npm install
   ```
4. Copie `.env.example` en `.env` et remplis ce que tu veux activer (voir plus bas).
5. Lance la boutique :
   ```bash
   npm run dev
   ```
6. Ouvre <http://localhost:3000>.

Sans rien remplir dans `.env`, le site fonctionne déjà : le client peut écrire sa citation lui-même, payer à la livraison,
et les commandes sont enregistrées. Les e-mails sont alors sauvegardés dans `data/outbox/` (ouvre un fichier `.html`
dans le navigateur pour voir l'e-mail que le client recevrait).

> N'ouvre pas `public/index.html` avec « Live Server » seul : le serveur Node est nécessaire pour les commandes,
> les e-mails, le suivi et la citation IA. Sans serveur, le site passe en **mode démo** (aucune commande envoyée).

## Ce que tu peux régler

| Je veux changer…                                                | Fichier                |
| --------------------------------------------------------------- | ---------------------- |
| Prix, monnaie, livraison, villes, délais, textes d'échange, contact | `public/js/config.js`  |
| Les 15 modèles, leurs couleurs, leurs descriptions               | `public/js/data.js`    |
| Photos des modèles (`p01.jpg` à `p15.jpg`)                       | `public/assets/img/`   |
| Couleurs, polices, mise en page                                  | `public/css/style.css` |
| Le texte et les sections du site                                 | `public/index.html`    |
| La consigne donnée à l'IA pour écrire la citation                | `server/quote.js`      |
| L'apparence des e-mails                                          | `server/mail.js`       |

Les prix et textes de `config.js` sont **des exemples** (189 MAD le t-shirt, livraison 35 MAD, etc.) :
remplace-les par les tiens. Le serveur recalcule toujours le prix lui-même : un client ne peut pas le modifier depuis son navigateur.
Le texte sur les échanges (`returnsText`) est aussi un exemple à adapter à tes vraies règles.

## Activer la citation par IA

Crée une clé sur <https://console.anthropic.com> et mets-la dans `.env` :

```
ANTHROPIC_API_KEY=sk-ant-...
```

La clé reste sur le serveur, jamais dans le navigateur. Chaque citation coûte une très petite somme (modèle rapide).
Sans clé, le client écrit sa propre citation.

## Activer les e-mails (confirmation de commande)

Le client reçoit : la confirmation de commande, puis un e-mail quand tu marques la commande « expédiée ».
Toi, tu reçois une alerte à chaque nouvelle commande. Avec **Gmail** :

1. Active la validation en deux étapes sur ton compte Google.
2. Crée un « mot de passe d'application » : <https://myaccount.google.com/apppasswords>.
3. Dans `.env` :
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=ton.adresse@gmail.com
   SMTP_PASS=le-mot-de-passe-d-application
   MAIL_FROM=Coeurete <ton.adresse@gmail.com>
   OWNER_EMAIL=ton.adresse@gmail.com
   ```
4. Redémarre le serveur : le terminal affiche « e-mails clients : activés ».

N'importe quel autre fournisseur SMTP fonctionne (Outlook, Brevo, Mailjet…). Gmail limite le nombre d'envois par jour :
pour une vraie boutique avec du volume, prends un service d'e-mails dédié et une adresse à ton nom de domaine.

Renseigne aussi `contact` dans `public/js/config.js` (e-mail, téléphone, Instagram) : ces infos s'affichent sur le site et en bas des e-mails.

## Gérer les commandes

Dans `.env`, choisis un mot de passe : `ADMIN_TOKEN=une-longue-phrase-secrète`. Puis ouvre <http://localhost:3000/admin>.
Tu y vois chaque commande avec **la citation à imprimer**, l'adresse, le mode de paiement. Tu peux :

- marquer une commande **expédiée** (avec un numéro de suivi facultatif) : le client reçoit alors un e-mail ;
- la marquer **livrée** ou **annulée** ;
- exporter toutes les commandes en CSV.

Les commandes sont enregistrées dans `data/orders.json` (fichier simple, adapté pour démarrer ; sauvegarde-le régulièrement).
Le client peut suivre sa commande avec son numéro et son téléphone (bouton « Suivi » du site).

## Paiement par carte

- **Paiement à la livraison** : fonctionne tout de suite, sans configuration.
- **Carte bancaire** : le site est prêt pour **Stripe** (page de paiement hébergée : les numéros de carte ne passent jamais par ton site).
  Mets `STRIPE_SECRET_KEY` dans `.env`, crée dans le tableau de bord Stripe une notification (webhook) vers
  `https://ton-site.com/api/stripe/webhook` pour les événements `checkout.session.completed` et `checkout.session.expired`,
  et mets son secret dans `STRIPE_WEBHOOK_SECRET`. Sans clé, l'option carte est grisée automatiquement.
- **Attention (Maroc)** : à ma connaissance, Stripe ne permet pas d'ouvrir un compte marchand depuis le Maroc (vérifie la liste des pays sur stripe.com). Si ta boutique est au Maroc,
  utilise un prestataire local (CMI, PayZone, YouCan Pay…). Ils se branchent dans `server/payments.js` : garde les deux fonctions
  `enabled()` et `createCardPayment(order, baseUrl)` qui renvoient une adresse de paiement, et remplace le contenu de Stripe.
  Les autres fichiers n'ont pas à changer.

## Mettre le site en ligne

Il te faut un hébergement qui exécute Node.js (Render, Railway, Fly.io, un VPS…). Prévois :

- les variables de `.env` saisies dans l'hébergeur (jamais dans le code) ;
- `BASE_URL=https://ton-site.com` et `TRUST_PROXY=1` ;
- un disque persistant pour le dossier `data/` (sinon les commandes sont perdues à chaque redémarrage) ;
- le HTTPS (fourni par la plupart des hébergeurs).

Avant d'ouvrir au public, vérifie aussi avec un juriste local les mentions légales, conditions de vente et la gestion des données personnelles
(noms, adresses, téléphones) : ce projet ne les fournit pas.

## Structure

```
server.js            serveur Express (API commandes, citation, suivi, admin)
server/              quote.js · orders.js · mail.js · payments.js · admin.html
public/              le site : index.html, css/, js/, assets/img/
data/                orders.json et outbox/ (créés automatiquement, ignorés par git)
.env                 tes secrets (à créer depuis .env.example, ne jamais partager)
```

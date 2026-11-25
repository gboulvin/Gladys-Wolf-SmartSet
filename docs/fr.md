# Wolf SmartSet

Supervisez et pilotez votre installation de chauffage **Wolf** (chaudières à
condensation gaz et fioul, pompes à chaleur, ventilation double flux, modules
solaires...) depuis Gladys, via le cloud **Wolf SmartSet**.

## Avant de commencer

- Votre installation doit être connectée à Wolf SmartSet par une passerelle
  Wolf (**ISM7**, **Link home**, **Link pro**...) et visible dans le
  [portail Wolf SmartSet](https://www.wolf-smartset.com) ou l'application.
- Gardez sous la main l'identifiant et le mot de passe de ce compte. Wolf
  SmartSet n'accepte que des mots de passe de **30 caractères au plus**.
- L'intégration dialogue avec le cloud Wolf (c'est une intégration **cloud**) :
  Gladys a besoin d'un accès Internet, et les valeurs sont aussi fraîches que
  Wolf SmartSet les rend.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Saisissez votre **identifiant** et votre **mot de passe** Wolf SmartSet.
3. Choisissez la **langue des noms de paramètres** : Wolf SmartSet traduit
   lui-même le nom de ses paramètres (anglais, français, allemand ou espagnol).
4. Laissez le **mode expert** désactivé sauf besoin de tous les paramètres du
   régulateur : désactivé, vous obtenez les paramètres que le portail Wolf
   montre à l'utilisateur ; activé, tous les paramètres de tous les menus
   (beaucoup plus de fonctionnalités).
5. L'**intervalle de rafraîchissement** règle la fréquence de lecture des
   valeurs dans le cloud Wolf : toutes les 2 minutes par défaut, toutes les
   minutes au plus. Le cloud Wolf est lent et limite le nombre de requêtes,
   restez raisonnable.
6. Enregistrez, puis cliquez sur **Tester la connexion** : le message sous le
   bouton indique le nombre d'installations trouvées.
7. Ouvrez l'onglet **Découverte** : chaque installation Wolf apparaît comme un
   appareil, prêt à être ajouté.

## Ce que vous obtenez

Chaque installation Wolf devient un appareil Gladys. Ses fonctionnalités sont
les paramètres de l'installation, nommés par Wolf SmartSet et classés selon
leur unité :

| Paramètre Wolf                                       | Fonctionnalité Gladys          | Pilotable                                 |
| ---------------------------------------------------- | ------------------------------ | ----------------------------------------- |
| Température (°C), en lecture seule                   | Sonde de température           | non                                       |
| Température (°C), modifiable (ambiance, eau chaude…) | Consigne de thermostat         | **oui**                                   |
| Pression (bar)                                       | Capteur de pression            | non                                       |
| Puissance (kW) / quantité de chaleur (kWh)           | Capteur de puissance/d'énergie | non                                       |
| Heures de fonctionnement                             | Durée                          | non                                       |
| Pourcentage (modulation, pompe…)                     | Valeur en %                    | non                                       |
| Liste de choix (mode, programme, état)               | Liste de choix                 | **oui**, si modifiable dans Wolf SmartSet |
| Autre (tr/min, l/min, Hz, texte…)                    | Texte avec son unité           | non                                       |

Le badge de l'appareil indique **cloud** tant que sa passerelle joint Wolf
SmartSet, et **injoignable** quand la passerelle est hors ligne.

Pour connaître les paramètres modifiables d'une installation et leurs
identifiants, cliquez sur **Lister les paramètres modifiables** dans l'onglet
Configuration.

## Scènes

**Déclencheurs**

- **Connexion de la passerelle Wolf modifiée** : la passerelle d'une
  installation s'est connectée ou déconnectée. Filtrez sur l'installation et
  l'état ; la scène reçoit `{{triggerEvent.data.status}}` (`online` /
  `offline`).
- **Mode ou état Wolf modifié** : un paramètre à choix (mode de
  fonctionnement, programme, état du brûleur…) a pris une nouvelle valeur. La
  scène reçoit le nom du paramètre, son identifiant, la nouvelle et
  l'ancienne valeur. Un changement fait par Gladys lui-même ne le déclenche
  jamais.

Les valeurs numériques (températures, pression…) sont des fonctionnalités de
l'appareil : utilisez le déclencheur standard « état d'un appareil » de Gladys
pour les seuils.

**Actions**

- **Lire une installation Wolf maintenant** : lit toutes les valeurs sans
  attendre l'intervalle de rafraîchissement. Sorties : passerelle en ligne,
  nombre de valeurs lues.
- **Modifier un paramètre Wolf** : écrit une consigne, un mode ou tout
  paramètre modifiable. Le paramètre est désigné par son nom ou son
  identifiant ; la valeur d'une liste de choix est son libellé (ex. `Eco`) ou
  son numéro. Sorties : le paramètre et la valeur écrite.
- **Lire un paramètre Wolf** : rend une valeur disponible pour les actions
  suivantes de la scène (en texte, brute et numérique).

## Widget du tableau de bord

Le widget **Installation Wolf** affiche les principales températures et la
pression d'une installation (en direct), la connexion de la passerelle, la
dernière lecture et les modes en cours, avec un bouton **Actualiser**.
Choisissez l'installation dans les réglages du widget (la première sinon).

## Dépannage

- **« Wolf SmartSet a refusé l'identifiant ou le mot de passe »** : vérifiez-les
  dans le portail Wolf SmartSet ; raccourcissez le mot de passe à 30 caractères
  si besoin.
- **Aucun appareil dans Découverte** : cliquez sur **Tester la connexion** ; le
  compte doit posséder au moins une installation.
- **Les valeurs ne bougent plus, badge « injoignable »** : la passerelle Wolf a
  perdu sa connexion : vérifiez son alimentation et son réseau.
- **Un paramètre manque** : activez le **mode expert**.

Cette intégration utilise les mêmes services web Wolf SmartSet que le portail
Wolf ; ce n'est pas une API publique, elle peut changer sans préavis.

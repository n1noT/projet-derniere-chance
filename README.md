# Projet Dernière Chance

Extension Chrome qui capture automatiquement les films depuis CANAL+ et les enregistre dans un Google Sheets avec leur date d'expiration.

## Fonctionnalités

- Extraction automatique du titre, genre, durée, réalisateur et date d'expiration
- Gestion des formats de date courts : « Disponible jusqu'à mardi », « Disponible plus de 6 mois »
- Contrainte d'unicité titre + réalisateur : met à jour la ligne si la nouvelle date est plus lointaine
- Tri automatique par date d'expiration après chaque ajout
- Case à cocher DVD / Blu-ray
- Lien direct vers la page CANAL+ du film

## Installation

### 1. Cloner le repo

```bash
git clone https://github.com/n1noT/projet-derniere-chance.git
cd projet-derniere-chance
```

### 2. Configurer les credentials Google

#### a. Créer un projet Google Cloud

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un nouveau projet
3. Activer l'API **Google Sheets**
4. Aller dans **APIs & Services → Identifiants → Créer des identifiants → ID client OAuth**
5. Choisir le type **Extension Chrome** → Aller à la partie 3 pour récupérer l'ID d'extension
6. Copier le **Client ID** obtenu

#### b. Renseigner le `.env`

```bash
cp .env.example .env
```

Ouvrir `.env` et remplacer la valeur :

```
GOOGLE_CLIENT_ID=votre_client_id.apps.googleusercontent.com
```

#### c. Patcher le manifest

```bash
node setup.js
```

### 3. Charger l'extension dans Chrome

1. Ouvrir `chrome://extensions`
2. Activer le **mode développeur**
3. Cliquer **Charger l'extension non empaquetée**
4. Sélectionner ce dossier
5. Récupérer l'ID d'extension pour l'OAuth sur la page `chrome://extensions`

### 4. Préparer le Google Sheets

Créer un Google Sheets avec les colonnes dans cet ordre :

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Expiration | Film | Genre | Réalisateur | Durée (min) | DD | Lien |

- Formater la colonne **F** en **Case à cocher** (Format → Case à cocher)
- Copier l'**ID** du Sheets depuis son URL : `https://docs.google.com/spreadsheets/d/**ID**/edit`

### 5. Configurer l'extension

1. Aller sur une fiche film CANAL+
2. Cliquer sur l'icône de l'extension
3. Ouvrir ⚙ **Paramètres**
4. Saisir l'ID du Sheets et le nom de l'onglet

## Utilisation

1. Naviguer vers une fiche film sur [CANAL+](https://www.canalplus.com)
2. Cliquer sur l'icône de l'extension
3. Vérifier les champs extraits automatiquement (Il est possible qu'au premier chargement de canal+ les champs ne se remplissent pas automatiquement, recharger simplement la page)
4. Cocher **DVD / Blu-ray** si vous possédez le film physiquement
5. Cliquer **＋ Ajouter à Sheets**

## Structure du projet

```
├── manifest.json                  # Config extension (client_id patché par setup.js)
├── .env.example                   # Template des variables d'environnement
├── setup.js                       # Script de configuration initiale
├── background.js                  # Service worker : écriture Google Sheets
├── content/
│   ├── canal-plus-interceptor.js  # Injection MAIN world : capture des appels API hodor
│   └── canal-plus.js              # Content script : extraction et communication popup
├── popup/
│   ├── popup.html
│   └── popup.js
└── icons/
```

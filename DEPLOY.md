# Guide de déploiement — Photo Gallery Protégée

## Architecture

```
Vercel (Frontend React)  ←→  Railway (Backend Node.js)
      ↕                              ↕
  Client accède             Stockage images + DB JSON
  via navigateur            (persist sur Railway volume)
```

---

## 1. Préparer le backend sur Railway

### Étape 1 — Créer le compte et le projet

1. Va sur [railway.app](https://railway.app) → Sign Up (gratuit)
2. **New Project** → **Empty Project**
3. **Add Service** → **GitHub Repo** (connecte ton GitHub)

### Étape 2 — Pousser le code sur GitHub

```bash
cd photoviewer/backend
git init
git add .
git commit -m "init backend"
gh repo create photo-gallery-backend --private --push
```

### Étape 3 — Générer le hash du mot de passe admin

```bash
cd backend
npm install  # installe bcryptjs localement
node -e "const b=require('bcryptjs'); console.log(b.hashSync('TON_MOT_DE_PASSE_ADMIN', 10))"
```
Copie le résultat (commence par `$2a$10$...`)

### Étape 4 — Variables d'environnement Railway

Dans Railway → ton service → **Variables**, ajoute :

| Variable | Valeur |
|---|---|
| `JWT_SECRET` | une longue chaîne aléatoire (ex: `openssl rand -hex 32`) |
| `ADMIN_PASSWORD_HASH` | le hash généré à l'étape 3 |
| `FRONTEND_URL` | ton URL Vercel (tu l'as après l'étape 2) |
| `NODE_ENV` | `production` |

### Étape 5 — Volume persistant (IMPORTANT)

Sans volume, les images sont perdues à chaque redémarrage.

Railway → ton service → **Volumes** → **Add Volume**
- Mount path: `/app/data`
- Size: selon ton besoin (512MB gratuit)

### Étape 6 — Obtenir l'URL du backend

Railway → ton service → **Settings** → **Generate Domain**
Note l'URL : `https://photo-gallery-backend-xxxx.railway.app`

---

## 2. Déployer le frontend sur Vercel

### Étape 1 — Variables d'environnement

Dans `frontend/`, créer `.env.local` :
```
REACT_APP_API_URL=https://photo-gallery-backend-xxxx.railway.app
REACT_APP_FRONTEND_URL=https://ton-app.vercel.app
```

### Étape 2 — Déployer

```bash
cd photoviewer/frontend
npm install
npm run build  # vérifie que ça compile

# Installe Vercel CLI
npm i -g vercel

vercel deploy --prod
```

Ou via GitHub :
1. Pousse le frontend sur GitHub
2. vercel.com → **Import Project** → sélectionne le repo
3. Add Environment Variables (REACT_APP_API_URL, REACT_APP_FRONTEND_URL)
4. Deploy

### Étape 3 — Mettre à jour FRONTEND_URL dans Railway

Après avoir obtenu l'URL Vercel, retourne dans Railway et mets à jour `FRONTEND_URL`.

---

## 3. Utilisation

### Interface admin
Accède à : `https://ton-app.vercel.app/admin`

**Workflow :**
1. Connexion avec ton mot de passe admin
2. Remplis : Nom de la cliente, Mot de passe du lien, Durée d'expiration
3. Upload le ZIP de photos
4. Copie le lien généré → envoie par email à la cliente
5. La cliente ouvre le lien, entre le mot de passe, voit ses photos

### Supprimer une galerie
Dans le tableau de bord admin → **Supprimer** → le lien devient immédiatement invalide.

---

## 4. Protections anti-screenshot

| Protection | Technique | Efficacité |
|---|---|---|
| **WebGL Canvas** | GPU hardware overlay = noir au screenshot | ★★★★★ sur Windows/Mac |
| **Blocage PrtSc** | `keydown` capture phase | ★★★★ |
| **Clic droit** | `contextmenu` preventDefault | ★★★★★ |
| **Drag & drop** | `dragstart` preventDefault | ★★★★★ |
| **Raccourcis** | Ctrl+S, Ctrl+U, Ctrl+P bloqués | ★★★★ |
| **Visibilité** | Écran noir si onglet/fenêtre hors focus | ★★★ |
| **CSS user-select** | Sélection texte/image impossible | ★★★★★ |
| **Watermark** | Nom cliente en transparence | Dissuasif |
| **Token JWT 2h** | Lien d'image expire après la session | ★★★★★ |
| **No cache** | Images non sauvegardées par le navigateur | ★★★★ |

**Limite connue :** un téléphone devant l'écran. Le watermark avec le nom de la cliente
est la meilleure protection contre ça — si la photo fuite, on sait qui.

---

## 5. Structure des fichiers

```
photoviewer/
├── backend/
│   ├── server.js          # API Express
│   ├── package.json
│   ├── railway.json       # Config Railway
│   └── data/              # Créé automatiquement
│       ├── db.json        # Base de données
│       └── archives/      # Images extraites
│           └── {uuid}/
│               ├── 0001.jpg
│               └── 0002.jpg
└── frontend/
    ├── src/
    │   ├── index.js
    │   ├── components/
    │   │   └── WebGLViewer.js    # Rendu WebGL anti-screenshot
    │   ├── hooks/
    │   │   └── useAntiScreenshot.js  # Protections clavier/focus
    │   └── pages/
    │       ├── AdminPage.js     # Dashboard photographe
    │       └── ViewerPage.js    # Galerie cliente
    └── public/
        └── index.html
```

---

## 6. Développement local

```bash
# Terminal 1 — Backend
cd backend
npm install
cp .env.example .env  # édite le fichier
node -e "const b=require('bcryptjs'); console.log(b.hashSync('admin123', 10))"
# Colle le hash dans .env comme ADMIN_PASSWORD_HASH
npm run dev

# Terminal 2 — Frontend
cd frontend
npm install
echo "REACT_APP_API_URL=http://localhost:3001" > .env.local
npm start
```

Admin : http://localhost:3000/admin  
Viewer : http://localhost:3000/view/{archiveId}

---

## 7. Coûts estimés

| Service | Plan | Coût |
|---|---|---|
| Railway | Starter ($5 crédit/mois offert) | ~0–5€/mois |
| Vercel | Hobby (gratuit) | 0€ |
| **Total** | | **0–5€/mois** |

Pour un usage léger (< 5 galeries actives, < 1GB de photos), le plan gratuit Railway suffit.

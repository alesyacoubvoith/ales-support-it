# 🪟 Installer et lancer la plateforme sur Windows

> Objectif : faire tourner l'application sur ton PC et la partager à tes collègues sur le réseau local.

---

## ÉTAPE 1 — Installer Node.js (une seule fois)

Télécharge et installe **Node.js (version LTS)** :
👉 https://nodejs.org/

*(Clique sur "Suivant / Next" partout. Python, MongoDB et Yarn ne sont plus nécessaires !)*

---

## ÉTAPE 2 — Lancer l'application

1. Place le dossier du projet sur ton PC (par exemple `C:\Users\Ales\Desktop\ales4`).
2. Double-clique simplement sur **`start-windows.bat`** à la racine du dossier.
   - Au 1er lancement, il installe automatiquement les paquets et compile l'interface (~1 minute).
   - Laisse la fenêtre noire ouverte pendant que tu utilises l'application.
3. Ouvre ton navigateur sur :
   ```
   http://localhost:3040
   ```

*(Alternative en ligne de commande dans le dossier du projet : `npm install`, puis `npm run build`, puis `set PORT=3040 && npm start`.)*

---

## ÉTAPE 3 — Partager à tes collègues (réseau local)

1. Trouve ton adresse IP : ouvre `cmd`, tape `ipconfig`, et note la ligne **Adresse IPv4** (ex: `192.168.1.42`).
2. Tes collègues (sur le même Wi-Fi / réseau) ouvrent dans leur navigateur :
   ```
   http://192.168.1.42:3040
   ```
3. Si Windows affiche une alerte Pare-feu au 1er lancement, clique sur **Autoriser l'accès**.

---

## 💾 Sauvegarde des données
Toutes les modifications (parc informatique, tickets, stock, comptes...) sont enregistrées automatiquement dans le dossier `data/` (`data/db.json` et `data/uploads/`).

---

## 🔑 Connexion (ID employé par défaut)
- **Admins** : `EMP-ALES` (Ales), `EMP-SAM` (Sam), `EMP-IT` (Admin IT)
- **Employés** : `EMP-001`, `EMP-002`, `EMP-003`

---

## ❓ En cas de blocage
- `"Node.js n'est pas installe"` → Installe Node.js LTS depuis https://nodejs.org/ puis redémarre ton terminal/explorateur.
- Si tu as modifié du code dans `frontend/`, supprime le dossier `frontend\build` (ou lance `npm run build`) avant de relancer `start-windows.bat`.

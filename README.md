# IT-NUM-Task-Manager

Mini-application de gestion de tâches internes. Ce projet intègre une API backend NestJS, une base de données PostgreSQL, un reverse proxy Nginx, un pipeline CI/CD complet avec analyse de sécurité et notifications par email, ainsi qu'une stack de monitoring (Prometheus, Grafana, cAdvisor).

---

## Table des matières

1. [Stack Technique](#stack-technique)
2. [Architecture](#architecture)
3. [Prérequis](#prérequis)
4. [Préparation du serveur (VM)](#préparation-du-serveur-vm)
5. [Installation & Lancement en Local](#installation--lancement-en-local)
6. [Accès aux Services](#accès-aux-services)
7. [CI/CD & Déploiement](#cicd--déploiement)
8. [Monitoring](#monitoring)
9. [Sécurité](#sécurité)
10. [Bonnes Pratiques Appliquées](#bonnes-pratiques-appliquées)
11. [Améliorations Possibles](#améliorations-possibles)

---

## Stack Technique

| Couche | Technologie |
| :--- | :--- |
| **Backend** | [NestJS](https://nestjs.com/) (Node.js 20, TypeScript) |
| **Base de données** | [PostgreSQL 15](https://hub.docker.com/_/postgres) |
| **Reverse Proxy** | [Nginx](https://nginx.org/) ([Docs config](https://docs.nginx.com/nginx/admin-guide/basic-functionality/managing-configuration-files/)) |
| **Conteneurisation** | Docker & Docker Compose v2 |
| **CI/CD** | GitHub Actions |
| **Registry** | GitHub Container Registry (GHCR) |
| **Monitoring** | Prometheus + Grafana + cAdvisor |
| **Sécurité** | Gitleaks + [Snyk](https://app.snyk.io) (SAST, SCA, Container) |
| **Notifications** | GitHub Actions + SMTP Gmail |
| **Images Docker** | [Docker Hub Official Images](https://hub.docker.com/u/library) |

---

## Architecture

```
                         ┌─────────────────────────────────────────┐
                         │              Serveur VPS                 │
                         │                                          │
  Internet               │   ┌─────────┐      ┌──────────────┐     │
──────────── :80 ──────► │   │  Nginx  │─────►│   Backend    │     │
                         │   │ (proxy) │      │   NestJS     │     │
                         │   └─────────┘      │   :3000      │     │
                         │                    └──────┬───────┘     │
                         │                           │             │
                         │                    ┌──────▼───────┐     │
                         │                    │  PostgreSQL  │     │
                         │                    │   :5432      │     │
                         │                    └──────────────┘     │
                         │                                          │
                         │   ┌──────────┐  ┌───────────┐           │
                         │   │Prometheus│  │ cAdvisor  │           │
                         │   │  :9090   │◄─│  :8080    │           │
                         │   └────┬─────┘  └───────────┘           │
                         │        │                                 │
                         │   ┌────▼─────┐                          │
                         │   │ Grafana  │                          │
                         │   │  :3001   │                          │
                         │   └──────────┘                          │
                         └─────────────────────────────────────────┘
```

---

## Prérequis

### Machine locale (développement)

- [Git](https://git-scm.com/)
- [Docker](https://docs.docker.com/get-docker/) avec Docker Compose v2 inclus
- *(Optionnel)* Node.js 20+ pour le développement hors conteneur

### Serveur de production (VM Ubuntu)

- Ubuntu 22.04+ LTS
- Accès root ou sudo
- Ports ouverts : `80`, `3001`, `8080`, `9090`

---

## Préparation du serveur (VM)

> Ces étapes sont à effectuer **une seule fois** lors de la première configuration du serveur.

### 1. Mise à jour du système

```bash
apt-get update && apt-get upgrade -y
```

### 2. Installation de Docker + plugin Docker Compose (Ubuntu)

> ⚠️ **Important :** Le plugin **Docker Compose v2** (`docker-compose-plugin`) doit impérativement être installé sur la VM. Sans lui, la commande `docker compose` utilisée par le pipeline CI/CD et les scripts de déploiement échouera.

Source officielle : [https://docs.docker.com/engine/install/ubuntu/](https://docs.docker.com/engine/install/ubuntu/)

```bash
# Supprimer les anciennes versions si présentes
apt-get remove -y docker docker-engine docker.io containerd runc

# Installer les dépendances
apt-get install -y ca-certificates curl gnupg lsb-release

# Ajouter la clé GPG officielle Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Ajouter le dépôt Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Installer Docker Engine + plugin Compose v2
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Vérifier l'installation (les deux commandes doivent répondre)
docker --version
docker compose version
```

> Si `docker compose version` renvoie une erreur de type `unknown command`, c'est que le plugin n'a pas été installé. Relancez `apt-get install -y docker-compose-plugin`.

### 3. Démarrer Docker au boot

```bash
systemctl enable docker
systemctl start docker
```

### 4. Créer le dossier de déploiement

```bash
mkdir -p /app
cd /app
git clone https://github.com/raymond-odounhitan2000/IT-NUM-Task-Manager.git
cd IT-NUM-Task-Manager
```

### 5. Générer la clé SSH pour GitHub Actions

Cette clé permet à GitHub Actions de se connecter au serveur **sans mot de passe**, de manière sécurisée.

```bash
# Générer la paire de clés RSA 4096 bits
ssh-keygen -t rsa -b 4096 -C "itnum-deploy" -f ~/.ssh/itnum_deploy -N ""

# Autoriser la clé publique sur le serveur
cat ~/.ssh/itnum_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Afficher la clé privée → à copier dans le secret GitHub SSH_PRIVATE_KEY
cat ~/.ssh/itnum_deploy
```

> Copiez **tout** le contenu affiché (de `-----BEGIN RSA PRIVATE KEY-----` jusqu'à `-----END RSA PRIVATE KEY-----`) et collez-le dans le secret GitHub `SSH_PRIVATE_KEY`.

---

## Installation & Lancement en Local

### 1. Cloner le projet

```bash
git clone https://github.com/raymond-odounhitan2000/IT-NUM-Task-Manager.git
cd IT-NUM-Task-Manager
git switch main
```

### 2. Configuration des variables d'environnement

Le fichier `.env` doit être placé **à la racine du projet** (et non dans le dossier `task-manager/`) pour que Docker Compose puisse l'injecter correctement dans tous les services.

```bash
cp .env.example .env
```

Éditez ensuite `.env` avec vos valeurs :

```env
# --- Application ---
PORT=3000
ALLOWED_ORIGINS=http://localhost

# --- JWT ---
JWT_ACCESS_SECRET=votre_secret_tres_complexe
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=votre_secret_refresh_tres_complexe
JWT_REFRESH_EXPIRES_IN=7d

# --- Base de Données ---
POSTGRES_USER=itnum_user
POSTGRES_PASSWORD=mot_de_passe_genere
POSTGRES_DB=itnum_db
POSTGRES_PORT=5432
POSTGRES_HOST=postgres
POSTGRES_SSL=false

# --- Monitoring ---
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin
```

> 💡 **Bonne pratique :** Utilisez [LastPass Password Generator](https://www.lastpass.com/fr/features/password-generator) pour générer des mots de passe robustes pour `POSTGRES_PASSWORD`, `GRAFANA_PASSWORD` et les secrets JWT.

### 3. Lancer les conteneurs en local

```bash
docker compose -f docker-compose.local.yml up -d --build
```

> ℹ️ Utilisez `docker compose` (avec espace, v2) et non `docker-compose` (v1 dépréciée).

### 4. Commandes utiles

```bash
# Voir les logs du backend en temps réel
docker compose -f docker-compose.local.yml logs -f backend

# Voir l'état de tous les conteneurs
docker compose -f docker-compose.local.yml ps

# Redémarrer un service spécifique
docker compose -f docker-compose.local.yml restart backend

# Arrêter l'environnement local
docker compose -f docker-compose.local.yml down

# Arrêter et supprimer les volumes (reset complet de la BDD)
docker compose -f docker-compose.local.yml down -v

# Supprimer les images inutilisées
docker image prune -af
```

---

## Accès aux Services

### En local

| Service | Rôle | URL |
| :--- | :--- | :--- |
| **API Backend** | Application NestJS via Nginx | `http://localhost/api` |
| **Swagger** | Documentation interactive de l'API | `http://localhost/docs` |
| **Grafana** | Tableaux de bord de monitoring | `http://localhost:3001` |
| **Prometheus** | Explorateur brut de métriques | `http://localhost:9090` |
| **cAdvisor** | Monitoring temps réel des conteneurs | `http://localhost:8080` |

### En production

Remplacez `VOTRE_IP` par l'adresse IP de votre serveur :

| Service | URL | Identifiants |
| :--- | :--- | :--- |
| **API Backend** | `http://VOTRE_IP/api` | — |
| **Grafana** | `http://VOTRE_IP:3001` | `GRAFANA_USER` / `GRAFANA_PASSWORD` |
| **Prometheus** | `http://VOTRE_IP:9090` | — |
| **cAdvisor** | `http://VOTRE_IP:8080` | — |

---

## CI/CD & Déploiement

Le pipeline GitHub Actions se déclenche automatiquement à chaque **push** ou **pull request** sur `main` et exécute 5 jobs dans l'ordre :

```
secrets-scan ──► snyk-security ──► build ──► deploy ──► notify
```

| Job | Outil | Ce qu'il fait |
| :--- | :--- | :--- |
| **Secrets Scan** | Gitleaks | Détecte les tokens/mots de passe dans le code |
| **Security** | Snyk | SAST, dépendances, IaC, image Docker |
| **Build & Test** | Docker + npm | Lint, tests, build image, push GHCR |
| **Deploy** | appleboy/ssh-action | SSH → git pull → .env → docker compose up |
| **Notify** | SMTP Gmail | Envoie un email de succès/échec en fin de pipeline |

### Configuration des secrets GitHub

#### Comment ajouter un secret sur GitHub (pas-à-pas)

1. Ouvrez votre dépôt sur GitHub : `https://github.com/raymond-odounhitan2000/IT-NUM-Task-Manager`
2. Cliquez sur l'onglet **Settings** (en haut à droite du dépôt).

   > ⚠️ Si vous ne voyez pas **Settings**, c'est que vous n'êtes pas propriétaire/admin du dépôt.

3. Dans le menu latéral gauche, déroulez **Secrets and variables** puis cliquez sur **Actions**.
4. Cliquez sur le bouton vert **New repository secret** (en haut à droite).
5. Renseignez les deux champs :
   - **Name** : le nom exact du secret (ex: `MAIL_PASSWORD`) — respectez la casse, pas d'espaces.
   - **Secret** : la valeur (mot de passe, token, clé…) — collez sans guillemets, sans espace en début/fin.
6. Cliquez sur **Add secret**.
7. Répétez l'opération pour chacun des secrets listés ci-dessous.

> 💡 Une fois créé, GitHub masque définitivement la valeur du secret : vous ne pourrez plus la relire, seulement la **mettre à jour** (bouton *Update*) ou la **supprimer** (bouton *Remove*). Conservez donc les valeurs sensibles dans un gestionnaire de mots de passe.

> ℹ️ Pour la clé privée SSH (`SSH_PRIVATE_KEY`), collez bien **l'intégralité** du contenu, y compris les lignes `-----BEGIN RSA PRIVATE KEY-----` et `-----END RSA PRIVATE KEY-----`, sans ligne vide en fin.

#### Comment générer le Personal Access Token GitHub (`GHCR_TOKEN`)

Ce token permet au pipeline CI/CD de **pousser l'image Docker** construite vers **GitHub Container Registry (GHCR)** et de la **tirer** depuis le serveur de déploiement.

1. Connectez-vous sur GitHub, puis cliquez sur votre **avatar** (en haut à droite) → **Settings**.
2. Dans le menu latéral gauche, descendez tout en bas et cliquez sur **Developer settings**.
3. Cliquez sur **Personal access tokens** → **Tokens (classic)**.

   > ⚠️ Utilisez bien **Tokens (classic)** et non **Fine-grained tokens** : GHCR ne supporte pas encore pleinement les fine-grained tokens pour l'écriture de packages.

4. Cliquez sur **Generate new token** → **Generate new token (classic)**.
5. Renseignez le formulaire :
   - **Note** : `GHCR_TOKEN - IT-NUM-Task-Manager` (pour savoir à quoi il sert plus tard).
   - **Expiration** : `90 days` minimum, ou `No expiration` si vous acceptez le risque (déconseillé).
   - **Select scopes** — cochez **uniquement** les permissions suivantes :
     - ✅ `write:packages` *(publier les images Docker sur GHCR)*
     - ✅ `read:packages` *(télécharger les images Docker depuis GHCR)*
     - ✅ `delete:packages` *(optionnel — permet de nettoyer les vieilles images)*
     - ✅ `repo` *(requis si votre dépôt est privé)*
6. Cliquez sur **Generate token** tout en bas de la page.
7. **Copiez immédiatement** le token affiché (il commence par `ghp_…`).

   > 🚨 **Attention :** GitHub ne vous montrera ce token **qu'une seule fois**. Si vous fermez la page sans le copier, il faudra en générer un nouveau.

8. Collez-le dans le secret GitHub `GHCR_TOKEN` (voir [Comment ajouter un secret sur GitHub](#comment-ajouter-un-secret-sur-github-pas-à-pas)).

##### Renouvellement du token

Avant la date d'expiration :

1. Retournez sur **Settings → Developer settings → Personal access tokens → Tokens (classic)**.
2. Cliquez sur le nom du token (`GHCR_TOKEN - IT-NUM-Task-Manager`).
3. Cliquez sur **Regenerate token**, choisissez une nouvelle expiration, puis **Regenerate token**.
4. Copiez la nouvelle valeur et **mettez à jour** le secret `GHCR_TOKEN` sur GitHub (bouton *Update*).

##### Test local du token (optionnel)

Pour vérifier que votre token fonctionne avant de le coller comme secret :

```bash
# Remplacez VOTRE_USER par votre username GitHub et collez le token au prompt
echo "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" | docker login ghcr.io -u VOTRE_USER --password-stdin
```

Si vous voyez `Login Succeeded`, le token est valide et a les bons scopes.

#### Accès & Sécurité (5 secrets)

| Secret | Description | Comment l'obtenir |
| :--- | :--- | :--- |
| `GHCR_TOKEN` | Personal Access Token GitHub | GitHub → Settings → Developer settings → Personal access tokens → droits `read:packages` + `write:packages` |
| `SNYK_TOKEN` | Token API Snyk | [app.snyk.io](https://app.snyk.io) → Account Settings → API Token |
| `SSH_HOST` | IP du serveur de production | Fournie par votre hébergeur |
| `SSH_USER` | Utilisateur SSH (ex: `root`) | Fourni par votre hébergeur |
| `SSH_PRIVATE_KEY` | Clé privée SSH RSA 4096 | Générée sur le serveur : `cat ~/.ssh/itnum_deploy` |

#### Notifications Email (3 secrets)

Ces secrets permettent au job `notify` d'envoyer un email à la fin du pipeline (succès ou échec).

| Secret | Valeur | Comment l'obtenir |
| :--- | :--- | :--- |
| `MAIL_USERNAME` | Ton adresse Gmail (ex: `toi@gmail.com`) | Ton compte Gmail |
| `MAIL_PASSWORD` | **Mot de passe d'application Gmail** | [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) |
| `MAIL_TO` | Adresse destinataire (peut être la même que `MAIL_USERNAME`) | Au choix |

> ⚠️ **Important :** Utilisez un **mot de passe d'application Gmail** et non votre vrai mot de passe de compte. Pour en générer un :
> 1. Activez la validation en deux étapes sur votre compte Google.
> 2. Allez sur [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
> 3. Créez un mot de passe d'application dédié (nom : `GitHub Actions IT-NUM`).
> 4. Copiez les 16 caractères générés dans le secret `MAIL_PASSWORD`.

#### Variables d'environnement de production (9 secrets)

| Secret | Exemple |
| :--- | :--- |
| `POSTGRES_DB` | `itnum_db` |
| `POSTGRES_USER` | `itnum_user` |
| `POSTGRES_PASSWORD` | *(mot de passe fort)* |
| `POSTGRES_HOST` | `postgres` |
| `POSTGRES_PORT` | `5432` |
| `POSTGRES_SSL` | `false` |
| `GRAFANA_USER` | `admin` |
| `GRAFANA_PASSWORD` | *(mot de passe fort)* |
| `PORT` | `3000` |
| `ALLOWED_ORIGINS` | `http://VOTRE_IP` |
| `JWT_ACCESS_SECRET` | *(secret fort)* |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_SECRET` | *(secret fort)* |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |

> **Total : 13+ secrets GitHub** à configurer avant le premier déploiement (5 accès + 3 mail + variables d'environnement).

---

## Monitoring

### Grafana

Accédez à Grafana via `http://VOTRE_IP:3001` avec les identifiants de votre `.env`.

Pour connecter Prometheus à Grafana :
1. **Configuration → Data Sources → Add data source**
2. Choisissez **Prometheus**
3. URL : `http://prometheus:9090`
4. Cliquez **Save & Test** ✅

Documentation officielle : [grafana.com/docs](https://grafana.com/docs/)

### cAdvisor

Accédez à `http://VOTRE_IP:8080` pour visualiser en temps réel le CPU, la RAM et le réseau de chaque conteneur Docker.

### Prometheus

Accédez à `http://VOTRE_IP:9090` pour explorer les métriques brutes. Prometheus scrape :
- Le **backend NestJS** sur `/metrics` toutes les 15 secondes
- **cAdvisor** sur `:8080` toutes les 15 secondes

---

## Sécurité

| Outil | Rôle |
| :--- | :--- |
| **Gitleaks** | Détection de secrets/tokens dans l'historique Git |
| **Snyk Code** | Analyse statique du code source (SAST) |
| **Snyk Open Source** | Vulnérabilités dans les dépendances npm |
| **Snyk IaC** | Mauvaises configurations docker-compose/nginx |
| **Snyk Container** | CVEs dans l'image Docker finale |

Les résultats Snyk sont automatiquement remontés dans **Security → Code scanning** de GitHub.

---

## Bonnes Pratiques Appliquées

1. **Multi-stage build Docker** — L'image de production ne contient ni `devDependencies` ni le code TypeScript source, réduisant significativement sa taille et sa surface d'attaque.
2. **Single Source of Truth** — Un seul fichier `.env` à la racine alimente tous les services Docker via `env_file`, évitant la duplication et les erreurs de synchronisation.
3. **Secrets jamais dans le code** — Le `Dockerfile` n'embarque aucun `.env` ni secret hardcodé. Les variables sont injectées en mémoire par Docker Compose au runtime.
4. **Clé SSH au lieu de mot de passe** — Le déploiement SSH utilise une paire de clés RSA 4096 bits, bien plus sécurisé qu'un mot de passe.
5. **Mot de passe d'application Gmail** — Le SMTP Gmail utilisé par le job `notify` s'appuie sur un *App Password* dédié, révocable indépendamment du compte principal.
6. **Mots de passe forts** — Tous les mots de passe sont générés via [LastPass Password Generator](https://www.lastpass.com/fr/features/password-generator).
7. **Images officielles et versionnées** — Toutes les images proviennent du [Docker Hub Official](https://hub.docker.com/u/library) avec des tags versionnés (`postgres:15-alpine`, `node:20-alpine`).
8. **Logs centralisés avec rotation** — Driver `json-file` configuré avec `max-size: 10m` et `max-file: 3` pour éviter la saturation du disque.
9. **Sécurité en amont du build** — Les jobs Gitleaks et Snyk s'exécutent **avant** le build Docker, bloquant tout déploiement si une vulnérabilité critique est détectée.
10. **Notifications automatiques** — Chaque exécution du pipeline (succès ou échec) déclenche un email, garantissant une remontée immédiate des incidents.
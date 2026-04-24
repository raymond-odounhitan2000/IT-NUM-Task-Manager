# IT-NUM-Task-Manager

**Mini-application de gestion de tâches internes**. Ce projet intègre une API backend NestJS, une base de données PostgreSQL, un reverse proxy Nginx, un pipeline CI/CD complet avec analyse de sécurité et notifications par email, ainsi qu'une stack de monitoring (Prometheus, Grafana, cAdvisor).
---

## Table des matières

1. [Stack Technique](#1-stack-technique)
2. [Architecture](#2-architecture)
3. [Prérequis](#3-prérequis)
4. [Quick Start — Développement local](#4-quick-start--développement-local)
5. [Configuration (variables d'environnement)](#5-configuration-variables-denvironnement)
6. [API Reference](#6-api-reference)
7. [Accès aux Services](#7-accès-aux-services)
8. [Tests](#8-tests)
9. [Observabilité](#9-observabilité)
10. [Préparation du serveur (VM)](#10-préparation-du-serveur-vm)
11. [CI/CD & Déploiement](#11-cicd--déploiement)
12. [Sécurité](#12-sécurité)
13. [Bonnes Pratiques Appliquées](#13-bonnes-pratiques-appliquées)
14. [Améliorations Possibles](#14-améliorations-possibles)
15. [Structure du projet](#15-structure-du-projet)

---

## 1. Stack Technique

| Couche | Technologie |
| :--- | :--- |
| **Backend** | [NestJS 11](https://nestjs.com/) (Node.js 20, TypeScript) |
| **Auth** | JWT double-secret (access + refresh) avec rotation, password hashé [argon2](https://github.com/ranisalt/node-argon2) |
| **ORM** | [TypeORM](https://typeorm.io/) (`synchronize: true`) |
| **Base de données** | [PostgreSQL 15 Alpine](https://hub.docker.com/_/postgres) |
| **Reverse Proxy** | [Nginx Alpine](https://nginx.org/) |
| **Conteneurisation** | Docker + Docker Compose v2 |
| **CI/CD** | GitHub Actions (6 jobs) |
| **Registry** | GitHub Container Registry (GHCR) |
| **Observabilité** | Prometheus + Grafana (auto-provisionné) + cAdvisor + `@willsoto/nestjs-prometheus` |
| **Sécurité** | Gitleaks + [Snyk](https://app.snyk.io) (Code / Open Source / IaC / Container) + Helmet + class-validator |
| **Notifications** | SMTP Gmail (via `dawidd6/action-send-mail`) |
| **Auto-réparation** | [willfarrell/autoheal](https://github.com/willfarrell/docker-autoheal) |

---

## 2. Architecture

```
                         ┌─────────────────────────────────────────┐
                         │              Serveur VPS                │
  Internet               │                                         │
──────────── :80 ──────► │   ┌─────────┐      ┌──────────────┐    │
                         │   │  Nginx  │─────►│   Backend    │    │
                         │   │ (proxy) │      │   NestJS     │    │
                         │   └─────────┘      │   :3000      │    │
                         │                    │  /api /docs  │    │
                         │                    │  /metrics    │    │
                         │                    └──────┬───────┘    │
                         │                           │            │
                         │                    ┌──────▼───────┐    │
                         │                    │  PostgreSQL  │    │
                         │                    │   :5432      │    │
                         │                    └──────────────┘    │
                         │                                        │
 Internet                │   ┌──────────┐  ┌───────────┐          │
──────────── :9090 ────► │   │Prometheus│◄─│ cAdvisor  │◄── :8080 │
                         │   │  :9090   │  └───────────┘          │
                         │   └────┬─────┘                         │
                         │        │        (scrape backend:3000)  │
                         │        │                               │
 Internet                │   ┌────▼─────┐                         │
──────────── :3001 ────► │   │ Grafana  │ (auto-provisionné)      │
                         │   │  :3001   │                         │
                         │   └──────────┘                         │
                         │                                        │
                         │   ┌──────────┐                         │
                         │   │ Autoheal │ (redémarre les          │
                         │   │          │  conteneurs unhealthy)  │
                         │   └──────────┘                         │
                         └─────────────────────────────────────────┘
```

---

## 3. Prérequis

### Machine locale (développement)

- [Git](https://git-scm.com/)
- [Docker](https://docs.docker.com/get-docker/) avec plugin Compose v2 (`docker compose`, pas `docker-compose`)
- *(Optionnel)* Node.js 20+ pour développement hors conteneur

### Serveur de production (VM Ubuntu)

- Ubuntu 22.04+ LTS
- Accès root ou sudo
- Ports ouverts : `80` (API + Swagger), `3001` (Grafana), `8080` (cAdvisor), `9090` (Prometheus)

> ℹ️ Le port `3000` du backend n'est **pas exposé directement** — il passe par Nginx. Même chose pour PostgreSQL sur `5432` (interne au réseau Docker).

---

## 4. Quick Start — Développement local

```bash
git clone https://github.com/raymond-odounhitan2000/IT-NUM-Task-Manager.git
cd IT-NUM-Task-Manager
cp .env.example .env        # éditer les secrets si besoin
docker compose -f docker-compose.local.yml up -d --build
```

Une fois les conteneurs prêts (30 s à 1 min au premier démarrage) :

- API : http://localhost/api
- Swagger : http://localhost/docs
- Grafana : http://localhost:3001 (`admin` / `admin`)
- Prometheus : http://localhost:9090
- cAdvisor : http://localhost:8080

Pour arrêter :

```bash
docker compose -f docker-compose.local.yml down        # garde les données
docker compose -f docker-compose.local.yml down -v     # reset BDD (supprime les volumes)
```

---

## 5. Configuration (variables d'environnement)

Le fichier `.env` doit être à la **racine du projet** (et non dans `task-manager/`). Exemple minimal (cf. [`.env.example`](./.env.example)) :

```env
# --- Application ---
PORT=3000
NODE_ENV=staging             # 'production' désactive Swagger + active CSP Helmet strict
HOST=localhost               # IP publique en prod → utilisée pour générer les liens Swagger

# --- Sécurité JWT ---
JWT_ACCESS_SECRET=<secret_aleatoire_fort>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<autre_secret_aleatoire_fort>
JWT_REFRESH_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost,http://localhost:3001

# --- Base de données ---
POSTGRES_USER=itnum_user
POSTGRES_PASSWORD=<mot_de_passe_fort>
POSTGRES_DB=itnum_db
POSTGRES_PORT=5432
POSTGRES_HOST=postgres       # nom du service Docker, pas 'localhost'
POSTGRES_SSL=false

# --- Monitoring ---
GRAFANA_USER=admin
GRAFANA_PASSWORD=<mot_de_passe_fort>
```

> ⚠️ **Les secrets JWT sont obligatoires.** Le code utilise `configService.getOrThrow(...)` → l'application **refuse de démarrer** si `JWT_ACCESS_SECRET` ou `JWT_REFRESH_SECRET` sont absents. Générer avec : `openssl rand -base64 64`.

> 💡 Pour les autres mots de passe, utilisez [LastPass Password Generator](https://www.lastpass.com/fr/features/password-generator) ou `openssl rand -base64 32`.

---

## 6. API Reference

Toutes les routes sont préfixées par `/api` (sauf `/docs` et `/metrics`). La documentation interactive **Swagger** est disponible sur `/docs` hors production.

### Flux d'authentification

```
register  ───►  accessToken + refreshToken
login     ───►  accessToken + refreshToken
            │
            ▼
    [utilise accessToken dans le header
     Authorization: Bearer <token>]
            │
    (15 min plus tard, 401)
            │
            ▼
refresh   ───►  nouveaux accessToken + refreshToken (rotation)
logout    ───►  invalide le refreshToken côté serveur
```

### `auth` — endpoints publics et protégés

| Méthode | Route | Guard | Body / Headers | Retour |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | — | `{ email, firstName, lastName?, password }` | `{ user, accessToken, refreshToken }` |
| `POST` | `/api/auth/login` | — | `{ email, password }` | `{ user, accessToken, refreshToken }` |
| `POST` | `/api/auth/logout` | Bearer access | — | `{ success: true }` |
| `POST` | `/api/auth/refresh` | Body refresh | `{ refreshToken }` | `{ accessToken, refreshToken }` |

**Exemple de flux complet avec curl :**

```bash
# Register
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","firstName":"John","password":"motdepasse123"}'

# Login (si user déjà créé)
TOKEN=$(curl -sX POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"motdepasse123"}' \
  | jq -r '.accessToken')

# Appel protégé
curl http://localhost/api/tasks -H "Authorization: Bearer $TOKEN"
```

### `users` — tous protégés par JWT

| Méthode | Route | Comportement |
| :--- | :--- | :--- |
| `GET` | `/api/user` | Liste tous les utilisateurs (champs `password` et `hashedRefreshToken` exclus de la réponse JSON) |
| `GET` | `/api/user/:id` | **Self-only** : `403 Forbidden` si `id ≠ currentUser.id` |
| `PATCH` | `/api/user/:id` | Self-only. Re-hash du password si fourni. `409 Conflict` si l'email change pour un email déjà pris |
| `DELETE` | `/api/user/:id` | Self-only |

### `tasks` — tous protégés par JWT, scopés par propriétaire

| Méthode | Route | Comportement |
| :--- | :--- | :--- |
| `POST` | `/api/tasks` | Crée une tâche, `createdBy` = user courant, valide `startDate ≤ dueDate` |
| `GET` | `/api/tasks` | Liste paginée des tâches du user courant (cf. [paramètres de query](#paramètres-de-filtrage-et-pagination-sur-gettasks)) |
| `GET` | `/api/tasks/:id` | `404 Not Found` si la tâche n'existe pas **ou** n'appartient pas au user courant |
| `PATCH` | `/api/tasks/:id` | Idem scoping. Le champ `userId` dans le body est **ignoré** (anti-privilege-escalation) |
| `DELETE` | `/api/tasks/:id` | Idem scoping |

#### Paramètres de filtrage et pagination sur `GET /tasks`

| Param | Type | Défaut | Description |
| :--- | :--- | :--- | :--- |
| `status` | `pending \| in_progress \| done` | — | Filtre par statut |
| `priority` | `low \| medium \| high` | — | Filtre par priorité |
| `completed` | `boolean` | — | Tâches terminées / non-terminées |
| `dueBefore` | ISO date | — | Tâches avec `dueDate <= dueBefore` |
| `dueAfter` | ISO date | — | Tâches avec `dueDate >= dueAfter` |
| `search` | `string` | — | Recherche `ILIKE` sur `title` ou `description` |
| `page` | `number` | `1` | Numéro de page (min 1) |
| `limit` | `number` | `20` | Taille de page (max 100) |
| `sortBy` | `createdAt \| dueDate \| priority \| status` | `createdAt` | Champ de tri |
| `sortOrder` | `ASC \| DESC` | `DESC` | Sens de tri |

**Exemple :**

```
GET /api/tasks?status=in_progress&priority=high&dueBefore=2026-05-01&search=auth&page=1&limit=10&sortBy=dueDate&sortOrder=ASC
```

**Réponse :**

```json
{
  "data": [ /* tasks[] */ ],
  "meta": { "total": 42, "page": 1, "limit": 10, "totalPages": 5 }
}
```

### Routes techniques

| Route | Description |
| :--- | :--- |
| `GET /api/health` | Healthcheck applicatif (utilisé par autoheal) |
| `GET /docs` | Swagger UI (désactivé si `NODE_ENV=production`) |
| `GET /metrics` | Exposition des métriques pour Prometheus (hors préfixe `/api`) |

---

## 7. Accès aux Services

### En local

| Service | URL |
| :--- | :--- |
| **API Backend** | http://localhost/api |
| **Swagger UI** | http://localhost/docs |
| **Prometheus `/metrics`** | http://localhost/metrics |
| **Grafana** | http://localhost:3001 |
| **Prometheus** | http://localhost:9090 |
| **cAdvisor** | http://localhost:8080 |

### En production

Remplacez `VOTRE_IP` par l'adresse de votre serveur (= la variable `HOST`).

| Service | URL | Identifiants |
| :--- | :--- | :--- |
| **API Backend** | `http://VOTRE_IP/api` | JWT obtenu via `/api/auth/login` |
| **Grafana** | `http://VOTRE_IP:3001` | `GRAFANA_USER` / `GRAFANA_PASSWORD` |
| **Prometheus** | `http://VOTRE_IP:9090` | — |
| **cAdvisor** | `http://VOTRE_IP:8080` | — |

> ℹ️ Swagger est **volontairement désactivé** en production (`NODE_ENV=production`).

---

## 8. Tests

Le projet expose **53 tests unitaires** répartis en 6 suites, couvrant le flux d'auth, l'ownership scoping, la sérialisation (non-fuite du password) et la pagination.

```bash
# Depuis task-manager/
cd task-manager

npm install           # installer les dépendances
npm run test          # lance toutes les suites jest
npm run test:watch    # mode watch
npm run test:cov      # couverture → ../coverage/
npm run test:e2e      # e2e (nécessite DB ; actuellement obsolète)
```

### Dev hors Docker

```bash
cd task-manager
npm run start:dev     # watch mode — nécessite Postgres accessible selon .env
```

---

## 9. Observabilité

### Prometheus

Scrape configuré dans [`prometheus.yml`](./prometheus.yml) toutes les 15 s :

- **`backend:3000/metrics`** — métriques Node.js par défaut exposées par [`@willsoto/nestjs-prometheus`](https://github.com/willsoto/nestjs-prometheus) (CPU, RSS, heap, event-loop lag, GC, handles actifs)
- **`cadvisor:8080`** — métriques des conteneurs Docker (CPU, RAM, réseau, I/O par container)

### Grafana — auto-provisionné

Au démarrage, Grafana **charge automatiquement** :

- La **datasource Prometheus** (pointant sur `http://prometheus:9090`) via [`grafana/provisioning/datasources/datasource.yml`](./grafana/provisioning/datasources/datasource.yml)
- Le **dashboard "ITNUM Backend"** via [`grafana/dashboards/itnum-backend.json`](./grafana/dashboards/itnum-backend.json) — panels Up, Uptime, Memory RSS, CPU %, Node.js Heap, Event Loop Lag, Active Handles/Requests, Garbage Collection Rate

**Aucune configuration manuelle n'est nécessaire.** Connectez-vous avec `GRAFANA_USER` / `GRAFANA_PASSWORD` et le dashboard est déjà là.

### cAdvisor

http://VOTRE_IP:8080 — visualisation en temps réel de CPU, RAM, réseau et I/O pour chaque conteneur.

---

## 10. Préparation du serveur (VM)

> Ces étapes sont à effectuer **une seule fois** lors de la première configuration du serveur.

### 1. Mise à jour du système

```bash
apt-get update && apt-get upgrade -y
```

### 2. Installation de Docker + plugin Compose v2

> ⚠️ Le plugin **Docker Compose v2** (`docker-compose-plugin`) est **obligatoire** : le pipeline CI/CD utilise `docker compose` (avec espace), pas `docker-compose` (v1 dépréciée).

```bash
# Supprimer les anciennes versions si présentes
apt-get remove -y docker docker-engine docker.io containerd runc

# Dépendances
apt-get install -y ca-certificates curl gnupg lsb-release

# Clé GPG + repo Docker officiel
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Vérification
docker --version
docker compose version
```

### 3. Activer Docker au boot

```bash
systemctl enable docker
systemctl start docker
```

### 4. Cloner le projet

```bash
mkdir -p /app && cd /app
git clone https://github.com/raymond-odounhitan2000/IT-NUM-Task-Manager.git
cd IT-NUM-Task-Manager
```

### 5. Générer la clé SSH pour GitHub Actions

Cette clé permet à GitHub Actions de se connecter en SSH au serveur sans mot de passe lors du déploiement.

```bash
ssh-keygen -t rsa -b 4096 -C "itnum-deploy" -f ~/.ssh/itnum_deploy -N ""
cat ~/.ssh/itnum_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Afficher la clé privée → à copier dans le secret GitHub SSH_PRIVATE_KEY
cat ~/.ssh/itnum_deploy
```

> Copiez **tout** le contenu affiché (de `-----BEGIN RSA PRIVATE KEY-----` à `-----END RSA PRIVATE KEY-----`, sans ligne vide) et collez-le dans le secret GitHub `SSH_PRIVATE_KEY`.

---

## 11. CI/CD & Déploiement

Le pipeline [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) se déclenche à chaque **push** ou **pull request** sur `main` et exécute **6 jobs** :

```
secrets-scan ──► snyk-security ──► build ──► deploy
                                            │
                                            ├──► notify-success (si OK)
                                            └──► notify-failure (si KO)
```

| Job | Outil | Action |
| :--- | :--- | :--- |
| `secrets-scan` | Gitleaks | Détecte secrets/tokens dans l'historique Git |
| `snyk-security` | Snyk | SAST (Code), dépendances (Open Source), IaC (docker-compose/nginx), Container |
| `build` | Docker Buildx + npm | Lint, tests, build multi-tag, push GHCR + attestation de provenance |
| `deploy` | `appleboy/ssh-action` | SSH → git pull → regénère `.env` depuis les secrets → `docker compose down && pull && up -d` |
| `notify-success` | SMTP Gmail | Email de succès avec liens |
| `notify-failure` | SMTP Gmail | Email d'échec avec lien vers les logs |

### Configuration des secrets GitHub

#### Comment ajouter un secret

1. Ouvrez le dépôt sur GitHub → **Settings** (onglet en haut à droite).
2. Menu latéral → **Secrets and variables** → **Actions**.
3. Cliquez **New repository secret**.
4. **Name** : nom exact du secret (casse respectée), **Secret** : valeur sans guillemets.
5. **Add secret**.

> 💡 Une fois créé, GitHub masque définitivement la valeur : impossible de la relire, seulement de la **mettre à jour** ou la **supprimer**. Gardez une copie dans un gestionnaire de mots de passe.

#### Générer le Personal Access Token GitHub (`GHCR_TOKEN`)

Permet au pipeline de pousser l'image Docker sur GHCR et au serveur de la tirer.

1. GitHub → **avatar** → **Settings** → **Developer settings**.
2. **Personal access tokens** → **Tokens (classic)**.

   > ⚠️ Utilisez **Tokens (classic)**, pas **Fine-grained** : GHCR ne gère pas encore ces derniers pour l'écriture de packages.

3. **Generate new token (classic)**.
4. **Note** : `GHCR_TOKEN - IT-NUM-Task-Manager` — **Expiration** : 90 j minimum.
5. Cochez **uniquement** :
   - ✅ `write:packages` (publier les images)
   - ✅ `read:packages` (tirer les images)
   - ✅ `repo` (si le dépôt est privé)
6. **Generate token** puis copiez **immédiatement** la valeur (`ghp_...`) — elle n'est affichée qu'une seule fois.
7. Collez-la dans le secret GitHub `GHCR_TOKEN`.

### Tableau complet des secrets requis

Le pipeline reconstruit le `.env` sur la VM à chaque déploiement via heredoc. **15 secrets + le token GHCR + les 3 secrets mail + les 3 secrets SSH** :

#### Accès & Infrastructure (5)

| Secret | Description |
| :--- | :--- |
| `GHCR_TOKEN` | Personal Access Token GitHub (`write:packages`, `read:packages`, `repo`) |
| `SNYK_TOKEN` | Token API Snyk ([app.snyk.io](https://app.snyk.io) → Account Settings → API Token) |
| `SSH_HOST` | IP publique du serveur (utilisée comme `HOST` dans le `.env`) |
| `SSH_USER` | Utilisateur SSH (ex: `root`) |
| `SSH_PRIVATE_KEY` | Clé privée RSA 4096 générée à l'étape 5 de la [préparation VM](#5-générer-la-clé-ssh-pour-github-actions) |

#### Notifications Email (3)

| Secret | Description |
| :--- | :--- |
| `MAIL_USERNAME` | Adresse Gmail émettrice |
| `MAIL_PASSWORD` | **Mot de passe d'application Gmail** (pas le mot de passe principal) — généré sur [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) après activation de la validation en deux étapes |
| `MAIL_TO` | Adresse destinataire |

#### Variables d'environnement injectées dans le `.env` de la VM (15)

| Secret | Exemple | Obligatoire |
| :--- | :--- | :---: |
| `NODE_ENV` | `production` ou `staging` | ✅ |
| `PORT` | `3000` | ✅ |
| `ALLOWED_ORIGINS` | `http://VOTRE_IP,http://VOTRE_IP:3001` | ✅ |
| `JWT_ACCESS_SECRET` | *(secret fort, 64 chars min)* | ✅ |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | ✅ |
| `JWT_REFRESH_SECRET` | *(secret fort, 64 chars min)* | ✅ |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | ✅ |
| `POSTGRES_DB` | `itnum_db` | ✅ |
| `POSTGRES_USER` | `itnum_user` | ✅ |
| `POSTGRES_PASSWORD` | *(mot de passe fort)* | ✅ |
| `POSTGRES_HOST` | `postgres` | ✅ |
| `POSTGRES_PORT` | `5432` | ✅ |
| `POSTGRES_SSL` | `false` (ou `true` pour Postgres managé) | ✅ |
| `GRAFANA_USER` | `admin` | ✅ |
| `GRAFANA_PASSWORD` | *(mot de passe fort)* | ✅ |

> **Total : 23 secrets** à configurer avant le premier déploiement.
>
> Note : `HOST` (utilisé par Swagger pour générer les liens) est **dérivé de `SSH_HOST`** par le pipeline ([deploy.yml:173](./.github/workflows/deploy.yml#L173)) — pas besoin d'un secret dédié.

---

## 12. Sécurité

### Sécurité applicative (couche NestJS)

- **Passwords hashés avec [argon2](https://github.com/ranisalt/node-argon2)** — algorithme vainqueur du Password Hashing Competition, recommandé par l'OWASP.
- **JWT double-secret** : accès court (`15m`) + refresh long (`7d`), avec **rotation du refresh token** à chaque appel à `/auth/refresh` (l'ancien est invalidé).
- **Fail-fast au bootstrap** : `configService.getOrThrow` sur `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — impossible de démarrer sans secrets définis.
- **`@Exclude({ toPlainOnly: true })`** sur `password` et `hashedRefreshToken` dans [`user.entity.ts`](./task-manager/src/user/entities/user.entity.ts), renforcé par un `ClassSerializerInterceptor` global → **jamais exposés** dans les réponses JSON.
- **Ownership scoping** sur toutes les routes `tasks` : `where userId = currentUser.id` côté query, renvoie `404` (pas `403`) pour ne pas révéler l'existence d'une ressource d'un autre utilisateur.
- **Self-only** sur `GET/PATCH/DELETE /user/:id` : `ForbiddenException` si `id ≠ currentUser.id`.
- **Anti privilege-escalation** : le champ `userId` est **strippé** du DTO d'update task pour éviter la réaffectation par payload injection.
- **Validation stricte** via `class-validator` avec pipe global `{ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: true }`.
- **Helmet** activé (CSP désactivé uniquement hors production pour permettre Swagger UI).
- **CORS** limité aux origines listées dans `ALLOWED_ORIGINS`.

### Sécurité CI/CD

| Outil | Rôle |
| :--- | :--- |
| **Gitleaks** | Détection de secrets dans l'historique Git |
| **Snyk Code** | Analyse statique du code source (SAST) |
| **Snyk Open Source** | CVE dans les dépendances npm (`snyk monitor`) |
| **Snyk IaC** | Mauvaises configurations Docker Compose / Nginx |
| **Snyk Container** | CVE dans l'image Docker finale |

Les résultats Snyk remontent dans **Security → Code scanning** de GitHub (via upload SARIF).

### Sécurité infrastructure

- **Déploiement par clé SSH** (RSA 4096) et non par mot de passe.
- **Mot de passe d'application Gmail** (révocable indépendamment) pour le SMTP de notification.
- **Attestation de provenance** sur les images Docker poussées (`actions/attest-build-provenance`).
- **Healthchecks** sur tous les conteneurs + label `autoheal=true` → redémarrage automatique si un service devient unhealthy.
- **Logs Docker** en `json-file` avec rotation (`max-size: 10m`, `max-file: 3`) pour éviter de saturer le disque.

---

## 13. Bonnes Pratiques Appliquées

1. **Multi-stage Docker build** — l'image de prod ne contient ni `devDependencies` ni les sources TypeScript.
2. **`.env` unique à la racine** — alimente tous les services via `env_file`, pas de duplication.
3. **Aucun secret dans le code** — `.env` exclu par `.gitignore`, `.env.example` sans valeurs réelles.
4. **Secrets reconstruits à chaque deploy** — le pipeline regénère `.env` depuis les GitHub Secrets plutôt que de l'envoyer par SCP.
5. **Images officielles versionnées** — `postgres:15-alpine`, `nginx:alpine`, etc.
6. **Rotation du refresh token** — chaque `/refresh` invalide l'ancien côté serveur.
7. **Pagination bornée** — `limit` plafonné à 100 pour éviter les scans massifs.
8. **Sérialisation sûre** — `@Exclude` + interceptor global évite toute fuite accidentelle.
9. **Indexes DB composites** — les 4 indexes `(userId, X)` couvrent tous les filtres scopés par owner.
10. **Observabilité zéro-config** — Grafana auto-provisionne datasource et dashboard au démarrage.

---

## 14. Améliorations Possibles

**Sécurité / robustesse**

- Activer le `ThrottlerGuard` globalement (`ThrottlerModule` est importé mais aucun guard n'est branché → pas de rate limit effectif sur `/auth/login` et `/auth/register`).
- Remplacer `TypeORM synchronize: true` par des migrations avant la vraie prod.
- Utiliser le `TerminusModule` pour que `/api/health` vérifie aussi l'état de PostgreSQL (actuellement payload statique).
- Bloquer les tests et lint CI (`continue-on-error: true` les rend non-bloquants).
- Scanner avec Snyk Container **l'image qui sera réellement déployée** (actuellement un rebuild séparé).
- Échapper les méta-caractères `%` et `_` du paramètre `search` pour éviter les full-scan `ILIKE`.
- Restreindre l'accès externe à `/metrics` (actuellement proxyfié par Nginx → public).

**Dev experience**

- Ajouter un `.dockerignore` au dossier `task-manager/` (actuellement absent → build context inutilement lourd).
- Aligner `docker-compose.local.yml` avec `docker-compose.yml` (provisioning Grafana, healthchecks, autoheal).
- Corriger le test e2e [`task-manager/test/app.e2e-spec.ts`](./task-manager/test/app.e2e-spec.ts) (cible un endpoint qui n'existe plus).
- Remplacer le template `SECURITY.md` par une vraie politique de divulgation.
- Remplacer `task-manager/README.md` (actuellement le template NestJS vanille).

**Features**

- Ajouter un système de rôles (admin) pour des endpoints `/admin/*` capables de voir toutes les tâches/users.
- Soft delete sur tasks (colonne `deletedBy` existe déjà, pas encore utilisée).
- Instrumenter les routes HTTP avec un `Histogram` custom `prom-client` (latence par route, codes statut) pour alimenter un dashboard "API Performance".
- HTTPS via Nginx + Let's Encrypt (actuellement HTTP uniquement — les JWT transitent en clair).
- Backup automatique Postgres (pas de cron / snapshot en place).

---

## 15. Structure du projet

```
IT-NUM-Task-Manager/
├── README.md                            # ce fichier
├── SECURITY.md                          # policy de divulgation (à compléter)
├── docker-compose.yml                   # prod — pull image GHCR + provisioning Grafana
├── docker-compose.local.yml             # dev — build local
├── nginx.conf                           # reverse proxy :80 → backend:3000
├── prometheus.yml                       # scrape backend + cAdvisor
├── .env.example                         # template variables d'environnement
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/datasource.yml   # datasource Prometheus auto
│   │   └── dashboards/default.yml       # provider de dashboards
│   └── dashboards/
│       └── itnum-backend.json           # dashboard Node.js du backend
├── .github/workflows/
│   └── deploy.yml                       # pipeline CI/CD (6 jobs)
└── task-manager/
    ├── Dockerfile                       # multi-stage (node:20)
    ├── package.json
    ├── tsconfig*.json
    ├── src/
    │   ├── main.ts                      # bootstrap Nest (helmet, CORS, Swagger, ValidationPipe)
    │   ├── app.module.ts                # ConfigModule, TypeOrm, Throttler, Prometheus
    │   ├── app.controller.ts            # GET /api/health
    │   ├── auth/                        # register / login / logout / refresh
    │   │   ├── strategies/              # JwtStrategy + JwtRefreshStrategy
    │   │   ├── guards/                  # JwtAuthGuard + JwtRefreshGuard
    │   │   └── decorators/              # @CurrentUser()
    │   ├── user/                        # CRUD self-only + @Exclude password
    │   └── task/                        # CRUD scopé par owner + filtres/pagination
    └── test/
        └── app.e2e-spec.ts              # e2e (obsolète)
```

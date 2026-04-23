
# IT-NUM-Task-Manager

Mini-application de gestion de tâches internes. Ce projet intègre une API backend, une base de données relationnelle, un reverse proxy, ainsi qu'une stack complète de monitoring et d'analyse de sécurité.

## Stack Technique & Outils

* **Backend :** NestJS
* **Base de données :** PostgreSQL
* **Reverse Proxy :** [Nginx](https://nginx.org/) ([Documentation de configuration](https://docs.nginx.com/nginx/admin-guide/basic-functionality/managing-configuration-files/))
* **Monitoring & Métriques :** * [Prometheus](https://prometheus.io/) (Collecte des métriques)
    * [cAdvisor](https://github.com/google/cadvisor) (Monitoring des ressources conteneurs)
    * [Grafana](https://grafana.com/docs/) (Tableaux de bord et visualisation)
* **Conteneurisation :** Docker & Docker Compose v2 (Images officielles sécurisées issues du [Docker Hub](https://hub.docker.com/u/library))
* **Sécurité & CI/CD :** GitHub Actions, Gitleaks (Détection de secrets), [Snyk](https://app.snyk.io) (Analyse SAST, SCA & Container Scanning)

---

## Prérequis

Avant de lancer le projet, assurez-vous d'avoir installé les outils suivants sur votre machine :
* [Git](https://git-scm.com/)
* [Docker](https://docs.docker.com/get-docker/) (avec Docker Compose v2 inclus)
* *(Optionnel)* Node.js 20+ pour le développement local hors conteneur.

---

## Installation & Lancement en Local

Le projet utilise une configuration Docker spécifique pour le développement local (`docker-compose.local.yml`) afin de simuler l'environnement de production tout en facilitant le debug.

### 1. Cloner le projet
```bash
git clone [https://github.com/raymond-odounhitan2000/IT-NUM-Task-Manager.git](https://github.com/raymond-odounhitan2000/IT-NUM-Task-Manager.git)
cd IT-NUM-Task-Manager
git switch main
```

### 2. Configuration des variables d'environnement
Le fichier de configuration `.env` doit être placé **à la racine du projet** (et non dans le dossier du backend) pour que Docker Compose puisse injecter les variables correctement dans tous les services.

Créez un fichier `.env` à la racine à partir de l'exemple :
```bash
cp .env.example .env
```

Éditez ensuite le fichier `.env` avec vos valeurs. 
>  **Bonne pratique de sécurité :** Utilisez un générateur de mots de passe robuste comme [LastPass Password Generator](https://www.lastpass.com/fr/features/password-generator) pour définir vos variables `POSTGRES_PASSWORD`, `GRAFANA_PASSWORD` et vos secrets JWT.

**Exemple de configuration locale (`.env`) :**
```env
# --- Application & Sécurité ---
PORT=3000
JWT_ACCESS_SECRET=votre_secret_tres_complexe
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=votre_secret_refresh_tres_complexe
JWT_REFRESH_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost

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

### 3. Lancer les conteneurs (Environnement Local)
Utilisez le fichier de configuration local pour démarrer toute l'infrastructure en arrière-plan :

```bash
docker compose -f docker-compose.local.yml up -d --build
```
*(Note : Utilisez bien `docker compose` avec un espace, et non `docker-compose`, pour utiliser la version v2 de l'outil).*

---

## Accès aux Services Locaux

Une fois les conteneurs démarrés, les différents services de l'infrastructure sont accessibles via les URLs suivantes :

| Service | Rôle | URL Locale | Identifiants par défaut |
| :--- | :--- | :--- | :--- |
| **API Backend** | L'application NestJS (via Nginx) | `http://localhost/api` | - |
| **Swagger** | Documentation interactive de l'API | `http://localhost/docs` | - |
| **Grafana** | Tableaux de bord de monitoring | `http://localhost:3001` | Voir `.env` (`GRAFANA_USER`) |
| **Prometheus** | Explorateur brut de métriques | `http://localhost:9090` | - |
| **cAdvisor** | Monitoring temps réel des conteneurs | `http://localhost:8080` | - |

**Commandes utiles :**
* Voir les logs du backend en temps réel : `docker compose -f docker-compose.local.yml logs -f backend`
* Arrêter l'environnement local : `docker compose -f docker-compose.local.yml down`

---

## CI/CD & Déploiement

Le projet intègre un pipeline CI/CD automatisé et sécurisé via GitHub Actions. Lors d'un *push* ou d'une *pull request* sur la branche `main`, le pipeline exécute les étapes suivantes :
1.  **Recherche de fuites de secrets** (Gitleaks).
2.  **Analyse de sécurité du code et de l'image Docker** (Snyk SAST & Container Scan).
3.  **Build et exécution des tests automatiques**.
4.  **Déploiement continu** sur le serveur de production via SSH (Pull de l'image depuis GHCR).

### Configuration des Secrets sur GitHub
Pour que le pipeline de déploiement fonctionne, configurez les secrets suivants dans votre dépôt GitHub (*Settings > Secrets and variables > Actions > New repository secret*) :

**Accès & Sécurité externes :**
* `GHCR_TOKEN` : Personal Access Token GitHub avec les droits `read:packages` et `write:packages`.
* `SNYK_TOKEN` : Token d'API de votre compte Snyk.
* `SSH_HOST` : Adresse IP du serveur de production.
* `SSH_USER` : Nom d'utilisateur SSH du serveur.
* `SSH_PASSWORD` : Mot de passe SSH (ou clé privée si reconfiguré dans le workflow).

**Variables d'environnement de Production :**
*(Ces valeurs seront injectées dynamiquement dans le `.env` sur le serveur)*
* `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_SSL`
* `GRAFANA_USER`, `GRAFANA_PASSWORD`
* `PORT`
* `ALLOWED_ORIGINS`
* `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`

---

## Architecture & Bonnes Pratiques Appliquées

1.  **Single Source of Truth :** Un seul fichier `.env` à la racine alimente à la fois la configuration des conteneurs Docker (via l'instruction `env_file`) et l'application NestJS, évitant la duplication et les erreurs de synchronisation.
2.  **Sécurité des Images Docker :** Le `Dockerfile` n'embarque **jamais** de fichier `.env` ou de secrets hardcodés. Les variables sont injectées en mémoire par Docker Compose au runtime.
3.  **Validation et Throttling :** L'API NestJS utilise des `ValidationPipe` stricts pour éviter l'injection de données, et un `ThrottlerGuard` global pour se protéger contre les attaques par force brute.
4.  **Graceful Shutdown :** NestJS est configuré pour écouter les signaux d'arrêt de Docker, permettant de terminer les requêtes en cours et de fermer proprement les connexions à la base de données lors des redéploiements.

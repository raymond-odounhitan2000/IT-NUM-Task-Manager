# IT-NUM-Task-Manager
Mini application de gestion de tâches internes
![License](./LICENSE)

## Clone projet

```bash
git clone https://github.com/raymond-odounhitan2000/IT-NUM-Task-Manager
```
## Installation
```bash
cd IT-NUM-Task-Manager/task-manager
npm install
cp .env.example .env
git switch dev
git pull
```

## Mettre a jours les variable du .env 

## Lancer le serveur

```bash
npm run start 
```
### creer une image docker

```bash
docker build -t task-manager:v1 .

```
### lancer le container

```bash
docker run -p 3000:3000 task-manager:v1
```

## Deploy avec Mau

```bash
npm install -g @nestjs/mau
mau deploy
```

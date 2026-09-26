COMPOSE := docker compose -f docker-compose.dev.yml

.DEFAULT_GOAL := help
.PHONY: help env up upd down build rebuild restart logs ps sh-server sh-client adb clean

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

env: ## Create server/.env with a random JWT secret and admin password if missing
	@if [ ! -f server/.env ]; then \
		pass=$$(openssl rand -hex 8); \
		sed -e "s/^JWT_SECRET=.*/JWT_SECRET=$$(openssl rand -hex 32)/" \
		    -e "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$$pass/" \
		    server/.env.example > server/.env; \
		echo "Created server/.env - log in as admin / $$pass"; \
	fi
	@if grep -q '^ADMIN_PASSWORD=change-me$$' server/.env; then \
		echo "ADMIN_PASSWORD in server/.env is still 'change-me' - set a real one (or delete the file and rerun)"; \
		exit 1; \
	fi

up: env ## Start dev stack in foreground (UI :5173, API :3000)
	$(COMPOSE) up --build

upd: env ## Start dev stack in background
	$(COMPOSE) up --build -d

down: ## Stop dev stack (keeps adb keys)
	$(COMPOSE) down

build: ## Build dev images
	$(COMPOSE) build

rebuild: ## Rebuild images and fresh node_modules (after package.json changes)
	$(COMPOSE) up --build -d --renew-anon-volumes

restart: ## Restart containers
	$(COMPOSE) restart

logs: ## Follow logs
	$(COMPOSE) logs -f

ps: ## Show container status
	$(COMPOSE) ps

sh-server: ## Shell in server container
	$(COMPOSE) exec server bash

sh-client: ## Shell in client container
	$(COMPOSE) exec client bash

adb: ## Run adb in server container, e.g. make adb ARGS="devices"
	$(COMPOSE) exec server adb $(ARGS)

clean: ## Stop and remove containers, volumes (incl. adb keys) and images
	$(COMPOSE) down -v --rmi local

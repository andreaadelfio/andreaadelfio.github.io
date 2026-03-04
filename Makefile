PORT ?= 8000
HOST ?= 127.0.0.1
SITE_DIR ?= .
DEV_PID_FILE ?= /tmp/andrea_site_dev.pid
DEV_LOG_FILE ?= /tmp/andrea_site_dev.log


all: git

git:
	git add --all
	git commit -m "Updated website at $(shell date)"
	git push

dev:
	@if [ -f "$(DEV_PID_FILE)" ] && kill -0 "$$(cat "$(DEV_PID_FILE)")" 2>/dev/null; then \
		echo "Dev server gia' attivo (PID $$(cat "$(DEV_PID_FILE)")) su http://$(HOST):$(PORT)/index.html"; \
	else \
		nohup python3 -m http.server "$(PORT)" --bind "$(HOST)" --directory "$(SITE_DIR)" >"$(DEV_LOG_FILE)" 2>&1 & \
		echo $$! >"$(DEV_PID_FILE)"; \
		sleep 1; \
		if kill -0 "$$(cat "$(DEV_PID_FILE)")" 2>/dev/null; then \
			echo "Dev server avviato su http://$(HOST):$(PORT)/index.html"; \
			echo "Log: $(DEV_LOG_FILE)"; \
		else \
			echo "Errore: avvio server fallito"; \
			[ -f "$(DEV_LOG_FILE)" ] && tail -n 20 "$(DEV_LOG_FILE)"; \
			rm -f "$(DEV_PID_FILE)"; \
			exit 1; \
		fi; \
	fi

stop:
	@if [ -f "$(DEV_PID_FILE)" ]; then \
		PID="$$(cat "$(DEV_PID_FILE)")"; \
		if kill -0 "$$PID" 2>/dev/null; then \
			kill "$$PID"; \
			echo "Dev server fermato (PID $$PID)"; \
		else \
			echo "PID $$PID non attivo; pulisco solo il file PID"; \
		fi; \
		rm -f "$(DEV_PID_FILE)"; \
	else \
		echo "Nessun dev server attivo"; \
	fi

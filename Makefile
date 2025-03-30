NAME=floatpanes
DOMAIN=angelsen.github.com
UUID=$(NAME)@$(DOMAIN)
EXTENSION_PATH=~/.local/share/gnome-shell/extensions/$(UUID)
SRC_FILES=$(wildcard lib/*.ts) extension.ts prefs.ts
DIST_FILES=$(SRC_FILES:%.ts=dist/%.js)

.PHONY: all pack install clean schemas lint typecheck dev help uninstall

all: schemas dist

help:
	@echo "Available commands:"
	@echo "  make all         - Build all files (default)"
	@echo "  make install     - Install extension to GNOME Shell"
	@echo "  make pack        - Create installable zip file"
	@echo "  make clean       - Remove build files"
	@echo "  make schemas     - Compile GSettings schemas"
	@echo "  make lint        - Run ESLint"
	@echo "  make typecheck   - Run TypeScript type checking"
	@echo "  make uninstall   - Remove installed extension"
	@echo "  make dev         - Install and restart GNOME Shell (X11 only)"
	@echo "  make help        - Show this help message"

node_modules: package.json
	@echo "Installing dependencies..."
	@npm install

dist: node_modules $(DIST_FILES) dist/resources

$(DIST_FILES): dist/%.js: %.ts node_modules
	@mkdir -p $(@D)
	@echo "Compiling TypeScript files..."
	@npx tsc

dist/resources:
	@mkdir -p dist/resources

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.$(NAME).gschema.xml
	@echo "Compiling schemas..."
	@glib-compile-schemas schemas

schemas: schemas/gschemas.compiled

$(NAME).zip: dist schemas
	@echo "Creating installable zip package..."
	@cp -r schemas dist/
	@cp metadata.json dist/
	@cp webkit-app.js dist/
	@chmod +x dist/webkit-app.js
	@mkdir -p dist/resources
	@(cd dist && zip ../$(NAME).zip -9r .)
	@echo "Package created: $(NAME).zip"

pack: $(NAME).zip

lint: node_modules
	@echo "Running ESLint..."
	@npx eslint --ext .ts .

typecheck: node_modules
	@echo "Running TypeScript type checking..."
	@npx tsc --noEmit

install: dist schemas
	@echo "Installing extension to $(EXTENSION_PATH)..."
	@mkdir -p $(EXTENSION_PATH)
	@cp -r dist/. $(EXTENSION_PATH)/
	@cp -r schemas $(EXTENSION_PATH)/
	@cp metadata.json $(EXTENSION_PATH)/
	@cp webkit-app.js $(EXTENSION_PATH)/
	@chmod +x $(EXTENSION_PATH)/webkit-app.js
	@mkdir -p $(EXTENSION_PATH)/resources
	@glib-compile-schemas $(EXTENSION_PATH)/schemas/
	@echo "Extension installed to $(EXTENSION_PATH)/"

uninstall:
	@echo "Uninstalling extension from $(EXTENSION_PATH)..."
	@rm -rf $(EXTENSION_PATH)
	@echo "Extension uninstalled."

dev: install
	@if [ "$(XDG_SESSION_TYPE)" = "x11" ]; then \
		echo "Restarting GNOME Shell (X11 session)..."; \
		dbus-send --session --type=method_call --dest=org.gnome.Shell /org/gnome/Shell org.gnome.Shell.Eval string:"global.reexec_self()"; \
	else \
		echo "You are using Wayland. Please log out and back in for changes to take effect."; \
	fi

clean:
	@echo "Cleaning build files..."
	@rm -rf dist $(NAME).zip
	@rm -f schemas/gschemas.compiled
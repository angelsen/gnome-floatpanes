NAME=floatpanes
DOMAIN=angelsen.github.com

.PHONY: all pack install clean

all: dist/extension.js

node_modules: package.json
	npm install

dist/extension.js dist/prefs.js: node_modules
	mkdir -p dist
	tsc

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.$(NAME).gschema.xml
	glib-compile-schemas schemas

$(NAME).zip: dist/extension.js dist/prefs.js schemas/gschemas.compiled
	@cp -r schemas dist/
	@cp metadata.json dist/
	@mkdir -p dist/resources
	@(cd dist && zip ../$(NAME).zip -9r .)

pack: $(NAME).zip

install: dist/extension.js dist/prefs.js schemas/gschemas.compiled
	@mkdir -p ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)
	@cp -r dist/. ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)/
	@cp -r schemas ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)/
	@cp metadata.json ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)/
	@mkdir -p ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)/resources
	@glib-compile-schemas ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)/schemas/
	@echo "Extension installed to ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)/"

clean:
	@rm -rf dist node_modules $(NAME).zip
	@rm -f schemas/gschemas.compiled
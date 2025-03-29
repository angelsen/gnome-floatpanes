# 🪟 GNOME FloatPanes

Create persistent floating application panes for quick access to your favorite tools.

![License](https://img.shields.io/github/license/angelsen/gnome-floatpanes)
![GNOME](https://img.shields.io/badge/GNOME-48-blue)
![Status](https://img.shields.io/badge/status-development-orange)

## 🔍 Overview

GNOME FloatPanes lets you launch applications in floating windows that can be toggled on/off while maintaining their state. These panes float above your workspace, enabling quick access to frequently used tools without disrupting your main workflow.

## ✨ Features

- 📌 **Persistent Floating Windows**: Create floating windows that persist across toggling
- 🔄 **State Preservation**: Maintain application state when hidden
- 📐 **Position Memory**: Remember position, size, and z-order
- 📱 **Application Support**: Web apps, native GNOME applications, terminal instances
- 📚 **Stacking & Management**: Stack multiple panes and rotate through them
- ⌨️ **Keyboard Shortcuts**: Toggle panes quickly with customizable shortcuts

## 🛠️ Installation

### Development Version

```bash
# Clone the repository
git clone https://github.com/angelsen/gnome-floatpanes.git
cd gnome-floatpanes

# Install dependencies
npm install --save-dev eslint eslint-plugin-jsdoc typescript
npm install @girs/gjs @girs/gnome-shell

# Build and install
make install

# Compile schemas (if needed)
glib-compile-schemas ~/.local/share/gnome-shell/extensions/floatpanes@angelsen.github.com/schemas/

# Enable the extension
gnome-extensions enable floatpanes@angelsen.github.com
```

After installation, log out and log back in, or restart GNOME Shell with <kbd>Alt</kbd>+<kbd>F2</kbd>, type `r`, and press <kbd>Enter</kbd>.

## 🧪 Development

Test in a nested GNOME Shell:

```bash
dbus-run-session -- gnome-shell --nested --wayland
```

In a terminal within the nested session:

```bash
gnome-extensions enable floatpanes@angelsen.github.com
```

Monitor logs:

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

## 📅 Roadmap

- [x] Project setup and TypeScript configuration
- [ ] Basic window management (create, position, hide, show)
- [ ] Panel indicator with dropdown menu
- [ ] Persistence mechanism (remember window state)
- [ ] Applications integration (web, native, terminal)
- [ ] Pane stacking and advanced features

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.
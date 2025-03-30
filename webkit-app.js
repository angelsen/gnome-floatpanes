#!/usr/bin/env gjs

imports.gi.versions.Gtk = '4.0';
imports.gi.versions.WebKit = '6.0';

const {Gtk, WebKit, GLib} = imports.gi;

// Parse command line args
let args = ARGV;
let url = args[0] || "https://claude.ai/new";
let title = args[1] || url.split("//")[1];

// Disable accessibility bridge to reduce D-Bus errors
GLib.setenv('NO_AT_BRIDGE', '1', true);

// Initialize GTK
Gtk.init();

// Create application with a valid application ID
// Following GTK4 requirements: reverse DNS format, only a-z, 0-9, and underscore
const app = new Gtk.Application({
    application_id: 'com.angelsen.floatpanes.webapp'
});

app.connect('activate', () => {
    // Create window with appropriate size/position
    const window = new Gtk.ApplicationWindow({
        application: app,
        title: title,
        default_width: 800,
        default_height: 600,
        // Needed for Wayland - specify initial size using allocation
        halign: Gtk.Align.FILL,
        valign: Gtk.Align.FILL,
        hexpand: true,
        vexpand: true
    });
    
    // Set app ID for better window tracking
    window.set_name('FloatPanesWebApp');
    
    // Create WebKit view with app-specific settings
    const webView = new WebKit.WebView();
    const settings = webView.get_settings();
    
    // App mode settings
    settings.set_enable_javascript(true);
    settings.set_hardware_acceleration_policy(WebKit.HardwareAccelerationPolicy.ALWAYS);
    settings.set_enable_developer_extras(false);
    settings.set_user_agent("Mozilla/5.0 (X11; Linux x86_64) FloatPanes/1.0");
    
    // Load the URL
    webView.load_uri(url);
    
    // Set up the WebView to fill the window
    webView.set_vexpand(true);
    webView.set_hexpand(true);
    
    // Create a container for the WebView
    const box = new Gtk.Box();
    box.append(webView);
    
    // Set the box as the window's child
    window.set_child(box);
    
    // Add custom class to make tracking easier
    window.add_css_class('floatpanes-webapp');
    
    // Show window and webview
    window.present();
});

// Run the application
app.run([]);
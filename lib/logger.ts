import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

export class Logger {
    private _settings: Gio.Settings;
    private _extension: any;
    private _prefix: string;
    private _logLevel: LogLevel;

    constructor(extension: any) {
        this._extension = extension;
        this._settings = extension.getSettings();
        this._prefix = `[${extension.metadata.name}]`;
        this._logLevel = LogLevel.INFO; // Default log level
        
        // Add debug setting to GSettings if it's not already there
        this._initSettings();
    }

    /**
     * Log a debug message (only visible when debug mode is enabled)
     */
    debug(message: string, ...args: any[]): void {
        if (this._logLevel <= LogLevel.DEBUG) {
            console.debug(`${this._prefix} ${message}`, ...args);
        }
    }

    /**
     * Log an informational message
     */
    info(message: string, ...args: any[]): void {
        if (this._logLevel <= LogLevel.INFO) {
            console.log(`${this._prefix} ${message}`, ...args);
        }
    }

    /**
     * Log a warning message
     */
    warn(message: string, ...args: any[]): void {
        if (this._logLevel <= LogLevel.WARN) {
            console.warn(`${this._prefix} ${message}`, ...args);
        }
    }

    /**
     * Log an error message
     */
    error(message: string, ...args: any[]): void {
        if (this._logLevel <= LogLevel.ERROR) {
            console.error(`${this._prefix} ${message}`, ...args);
        }
    }

    /**
     * Update the log level based on settings
     */
    updateLogLevel(): void {
        try {
            if (this._settings.get_boolean('debug-mode')) {
                this._logLevel = LogLevel.DEBUG;
            } else {
                this._logLevel = LogLevel.INFO;
            }
        } catch (e) {
            // Fallback to INFO if we can't read the setting
            this._logLevel = LogLevel.INFO;
            console.error(`${this._prefix} Error reading debug setting:`, e);
        }
    }

    /**
     * Initialize GSettings schema if needed
     */
    private _initSettings(): void {
        try {
            // Check if debug mode setting exists
            this._settings.get_boolean('debug-mode');
        } catch (e) {
            // Setting doesn't exist yet, we'll need to add it to the schema
            console.warn(`${this._prefix} Debug mode setting not found in schema. Add it to org.gnome.shell.extensions.floatpanes.gschema.xml`);
        }

        // Update log level based on settings
        this.updateLogLevel();
        
        // Connect to settings change to update log level when debug mode changes
        this._settings.connect('changed::debug-mode', () => {
            this.updateLogLevel();
            if (this._logLevel <= LogLevel.DEBUG) {
                console.debug(`${this._prefix} Debug mode changed: ${this._settings.get_boolean('debug-mode')}`);
            }
        });
    }
}
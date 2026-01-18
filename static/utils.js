/**
 * Shared Utility Functions for Aquarium Timelapse
 */

// Notification System
class Notifier {
    static show(message, type = 'info', duration = 4000) {
        const container = document.getElementById('notification-container');
        if (!container) {
            console.warn('Notification container not found');
            return;
        }

        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.textContent = message;

        container.appendChild(notif);

        if (duration > 0) {
            setTimeout(() => {
                notif.style.animation = 'slideIn 0.2s ease reverse';
                setTimeout(() => notif.remove(), 200);
            }, duration);
        }

        return notif;
    }

    static success(message, duration = 4000) {
        return this.show(message, 'success', duration);
    }

    static error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    static info(message, duration = 4000) {
        return this.show(message, 'info', duration);
    }
}

// Modal Management
class Modal {
    static open(modalId, data = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.warn(`Modal ${modalId} not found`);
            return;
        }

        // Populate modal with data if needed
        if (data.title) {
            const titleEl = modal.querySelector('[data-modal-title]');
            if (titleEl) titleEl.textContent = data.title;
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    static close(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    static closeAll() {
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        document.body.style.overflow = 'auto';
    }
}

// Status Pill Updates
class StatusPill {
    static update(element, isActive, label = '') {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }

        if (!element) return;

        // Use daisyUI badge classes instead of custom status-pill classes
        element.className = `badge badge-lg ${isActive ? 'badge-success' : 'badge-error'}`;
        const statusText = element.querySelector('span:last-child');
        if (statusText) {
            statusText.textContent = label || (isActive ? 'Active' : 'Inactive');
        }
    }
}

// API Helper
class API {
    static async request(endpoint, options = {}) {
        const defaults = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const config = { ...defaults, ...options };

        try {
            const response = await fetch(endpoint, config);
            const data = await response.json();

            if (!response.ok && !data.success) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    static post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    static put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    }
}

// Section Navigation
class SectionNav {
    static init() {
        document.querySelectorAll('[data-section]').forEach(el => {
            el.addEventListener('click', (e) => {
                this.show(el.dataset.section);
            });
        });
    }

    static show(sectionName) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

        // Show target section
        const section = document.getElementById(`${sectionName}-section`);
        if (section) {
            section.classList.add('active');

            // Update dock active state (daisyUI uses dock-active)
            document.querySelectorAll('[data-section]').forEach(el => {
                el.classList.toggle('dock-active', el.dataset.section === sectionName);
            });

            // Load section data if callback exists
            const callback = window[`load${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}`];
            if (typeof callback === 'function') {
                callback();
            }
        }
    }
}

// Auto-refresh utility
class AutoRefresh {
    constructor(callback, interval = 30000) {
        this.callback = callback;
        this.interval = interval;
        this.isActive = false;
        this.timerId = null;
    }

    toggle() {
        if (this.isActive) {
            this.stop();
        } else {
            this.start();
        }
        return this.isActive;
    }

    start() {
        if (this.isActive) return;
        this.isActive = true;
        this.callback();
        this.timerId = setInterval(() => this.callback(), this.interval);
    }

    stop() {
        if (!this.isActive) return;
        this.isActive = false;
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }
}

// JSON Editor with validation
class JSONEditor {
    constructor(textareaId, validateFn = null) {
        this.textarea = document.getElementById(textareaId);
        this.validateFn = validateFn;
    }

    setValue(obj) {
        if (this.textarea) {
            this.textarea.value = JSON.stringify(obj, null, 2);
        }
    }

    getValue() {
        try {
            return JSON.parse(this.textarea.value);
        } catch (e) {
            throw new Error(`Invalid JSON: ${e.message}`);
        }
    }

    validate() {
        const obj = this.getValue();
        if (this.validateFn) {
            return this.validateFn(obj);
        }
        return { valid: true };
    }
}

// Keyboard shortcuts
class KeyboardShortcuts {
    static register(key, callback, options = {}) {
        document.addEventListener('keydown', (e) => {
            const match = e.key === key || e.code === key;
            if (match) {
                if (options.requireShift && !e.shiftKey) return;
                if (options.requireCtrl && !e.ctrlKey && !e.metaKey) return;
                if (options.requireAlt && !e.altKey) return;

                // Skip if in input/textarea unless specified
                if (!options.allowInInput) {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                }

                e.preventDefault();
                callback(e);
            }
        });
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    SectionNav.init();

    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            Modal.closeAll();
        }
    });
});

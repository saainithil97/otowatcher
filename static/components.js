/**
 * Component-specific utilities and helpers
 */

// Gallery Component
class GalleryComponent {
    static async load(containerId = 'gallery-grid', count = 20) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const data = await API.get(`/api/gallery?count=${count}`);

            if (data.success && data.images.length > 0) {
                container.innerHTML = data.images.map(img => `
                    <div class="card bg-base-100 shadow-xl cursor-pointer hover:shadow-2xl transition-shadow"
                         onclick="GalleryComponent.openImage('${img.path}', '${img.timestamp_display}', '${img.size_mb}')">
                        <figure>
                            <img src="/image/${img.path}"
                                 alt="${img.filename}"
                                 class="w-full aspect-video object-cover"
                                 loading="lazy">
                        </figure>
                        <div class="card-body p-3">
                            <div class="font-medium text-sm">${img.time_only}</div>
                            <div class="text-base-content/60 text-xs">${img.date_only}</div>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<div class="col-span-full text-center p-12 text-base-content/60">No images found</div>';
            }
        } catch (error) {
            console.error('Gallery load error:', error);
            container.innerHTML = `<div class="col-span-full text-center text-base-content/60">Error: ${error.message}</div>`;
            Notifier.error('Failed to load gallery');
        }
    }

    static openImage(path, timestamp, size) {
        window.open(`/image/${path}`, '_blank');
    }
}

// Config Component
class ConfigComponent {
    static async load() {
        try {
            const data = await API.get('/api/config');
            if (data.success) {
                const editor = new JSONEditor('config-json');
                editor.setValue(data.config);
            } else {
                Notifier.error('Failed to load config');
            }
        } catch (error) {
            console.error('Config load error:', error);
            Notifier.error('Failed to load configuration');
        }
    }

    static async save() {
        try {
            const editor = new JSONEditor('config-json');
            const config = editor.getValue();

            const data = await API.post('/api/config', config);
            if (data.success) {
                Notifier.success('Configuration saved successfully');
            } else {
                Notifier.error(`Save failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Config save error:', error);
            Notifier.error(`Error: ${error.message}`);
        }
    }

    static reload() {
        this.load();
        Notifier.info('Configuration reloaded');
    }
}

// Service Component
class ServiceComponent {
    static async loadStatus() {
        try {
            const data = await API.get('/api/service/status');
            if (data.success) {
                this.updateStatus('capture', data.services.capture);
                this.updateStatus('sync', data.services.sync_timer);
                this.updateStatus('cleanup', data.services.cleanup_timer);
            }

            const healthData = await API.get('/api/health');
            if (healthData.success) {
                this.updateHealth(healthData.health);
            }
        } catch (error) {
            console.error('Service status error:', error);
            Notifier.error('Failed to load service status');
        }
    }

    static updateStatus(name, status) {
        const el = document.getElementById(`${name}-status`);
        if (el) {
            const isActive = status && status.active;
            StatusPill.update(el, isActive, isActive ? 'Active' : 'Inactive');
        }
    }

    static updateHealth(health) {
        const el = document.getElementById('health-info');
        if (!el) return;

        let html = `
            <div class="mb-2">Disk: ${health.disk_free_gb} GB free / ${health.disk_total_gb} GB total (${health.disk_usage_percent}% used)</div>
            <div>Last sync: ${health.last_sync || 'Unknown'}</div>
        `;

        if (health.warnings && health.warnings.length > 0) {
            html += `
                <div role="alert" class="alert alert-error mt-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>${health.warnings.join(', ')}</span>
                </div>
            `;
        }

        el.innerHTML = html;
    }

    static async control(action, service) {
        try {
            const data = await API.post(`/api/service/${action}`, { service });
            if (data.success) {
                Notifier.success(`Service ${action} completed`);
                setTimeout(() => this.loadStatus(), 500);
            } else {
                Notifier.error(`Failed to ${action} service: ${data.error}`);
            }
        } catch (error) {
            console.error('Service control error:', error);
            Notifier.error(`Error: ${error.message}`);
        }
    }
}

// Stream Component
class StreamComponent {
    static async start() {
        const btn = document.getElementById('start-stream-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Starting...';
        }

        try {
            const data = await API.post('/api/stream/start', {});
            if (data.success) {
                this.show();
                Notifier.success('Stream started');
            } else {
                Notifier.error(data.error || 'Failed to start stream');
            }
        } catch (error) {
            console.error('Stream start error:', error);
            Notifier.error(`Error: ${error.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Start Stream';
            }
        }
    }

    static async stop() {
        try {
            const data = await API.post('/api/stream/stop', {});
            if (data.success) {
                this.hide();
                Notifier.success('Stream stopped');
            } else {
                Notifier.error('Failed to stop stream');
            }
        } catch (error) {
            console.error('Stream stop error:', error);
            Notifier.error(`Error: ${error.message}`);
        }
    }

    static async checkStatus() {
        try {
            const data = await API.get('/api/stream/status');
            if (data.success && data.active) {
                this.show();
            }
        } catch (error) {
            console.error('Stream status error:', error);
        }
    }

    static show() {
        const feed = document.getElementById('stream-feed');
        const placeholder = document.getElementById('stream-placeholder');
        const startBtn = document.getElementById('start-stream-btn');
        const stopBtn = document.getElementById('stop-stream-btn');

        if (feed) feed.src = `/video_feed?t=${new Date().getTime()}`;
        if (feed) feed.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');
        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'block';

        const pill = document.getElementById('stream-status-pill');
        StatusPill.update(pill, true, 'Active');
    }

    static hide() {
        const feed = document.getElementById('stream-feed');
        const placeholder = document.getElementById('stream-placeholder');
        const startBtn = document.getElementById('start-stream-btn');
        const stopBtn = document.getElementById('stop-stream-btn');

        if (feed) feed.src = '';
        if (feed) feed.classList.add('hidden');
        if (placeholder) placeholder.classList.remove('hidden');
        if (startBtn) startBtn.style.display = 'block';
        if (stopBtn) stopBtn.style.display = 'none';

        const pill = document.getElementById('stream-status-pill');
        StatusPill.update(pill, false, 'Inactive');
    }
}

// Latest Image Component
class LatestImageComponent {
    constructor() {
        this.autoRefresh = new AutoRefresh(() => this.refresh(), 30000);
    }

    refresh() {
        const img = document.getElementById('latest-image');
        if (img) {
            img.src = `/latest.jpg?t=${new Date().getTime()}`;
        }
    }

    toggleAutoRefresh() {
        const isActive = this.autoRefresh.toggle();
        const btn = document.getElementById('auto-refresh-btn');
        const text = document.getElementById('auto-refresh-text');

        if (btn) {
            btn.classList.toggle('btn-primary', isActive);
            text.textContent = isActive ? 'Stop Auto-Refresh' : 'Auto-Refresh (30s)';
        }
    }

    download() {
        window.open('/latest.jpg', '_blank');
    }

    async capture() {
        const btn = document.getElementById('capture-btn');
        const originalText = btn.textContent;
        
        try {
            btn.disabled = true;
            btn.textContent = 'Capturing...';
            
            const response = await API.post('/api/capture');
            
            if (response.success) {
                Notifier.success(`✓ Image captured successfully (${response.size_mb} MB)`);
                // Refresh the latest image
                setTimeout(() => this.refresh(), 500);
            } else {
                const errorMsg = response.error || 'Failed to capture image';
                const suggestion = response.suggestion ? `\n${response.suggestion}` : '';
                Notifier.error(`✗ ${errorMsg}${suggestion}`);
            }
        } catch (error) {
            Notifier.error(`✗ Error: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
}

// Export for global use
const latestImage = new LatestImageComponent();

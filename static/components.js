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

// Calendar Component
class CalendarComponent {
    static currentMonth = new Date().getMonth();
    static currentYear = new Date().getFullYear();
    static daysWithImages = new Set();
    static selectedDate = null;

    static async load() {
        const today = new Date();
        this.currentMonth = today.getMonth();
        this.currentYear = today.getFullYear();

        await this.loadDaysWithImages();
        this.renderCalendar();
    }

    static async loadDaysWithImages() {
        try {
            const data = await API.get(`/api/calendar/days?year=${this.currentYear}&month=${this.currentMonth + 1}`);
            if (data.success) {
                this.daysWithImages = new Set(data.days);
            }
        } catch (error) {
            console.error('Failed to load calendar days:', error);
            Notifier.error('Failed to load calendar data');
        }
    }

    static renderCalendar() {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];

        document.getElementById('calendar-month-year').textContent =
            `${monthNames[this.currentMonth]} ${this.currentYear}`;

        const calendarGrid = document.getElementById('calendar-grid');

        // Keep the header row
        const headerRow = Array.from(calendarGrid.children).slice(0, 7);
        calendarGrid.innerHTML = '';
        headerRow.forEach(header => calendarGrid.appendChild(header));

        const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

        // Add empty cells for days before the 1st
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            calendarGrid.appendChild(emptyCell);
        }

        // Add day cells
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasImages = this.daysWithImages.has(dateStr);

            dayCell.className = `btn btn-sm ${hasImages ? 'btn-primary' : 'btn-ghost'} ${this.selectedDate === dateStr ? 'btn-active' : ''}`;
            dayCell.textContent = day;

            if (hasImages) {
                dayCell.onclick = () => this.selectDate(dateStr);
            } else {
                dayCell.disabled = true;
            }

            calendarGrid.appendChild(dayCell);
        }
    }

    static async selectDate(dateStr) {
        this.selectedDate = dateStr;
        this.renderCalendar();

        document.getElementById('calendar-date-info').textContent = `Loading images for ${dateStr}...`;

        try {
            const data = await API.get(`/api/calendar/images?date=${dateStr}`);
            if (data.success && data.images.length > 0) {
                document.getElementById('calendar-date-info').textContent =
                    `${data.images.length} images captured on ${dateStr}`;

                const container = document.getElementById('calendar-images');
                container.innerHTML = data.images.map(img => `
                    <div class="card bg-base-100 shadow-xl cursor-pointer hover:shadow-2xl transition-shadow"
                         onclick="window.open('/image/${img.path}', '_blank')">
                        <figure>
                            <img src="/image/${img.path}"
                                 alt="${img.filename}"
                                 class="w-full aspect-video object-cover"
                                 loading="lazy">
                        </figure>
                        <div class="card-body p-3">
                            <div class="font-medium text-sm">${img.time_only}</div>
                            <div class="text-base-content/60 text-xs">${img.size_mb} MB</div>
                        </div>
                    </div>
                `).join('');
            } else {
                document.getElementById('calendar-date-info').textContent = `No images found for ${dateStr}`;
                document.getElementById('calendar-images').innerHTML = '';
            }
        } catch (error) {
            console.error('Failed to load images:', error);
            Notifier.error('Failed to load images for selected date');
        }
    }

    static async previousMonth() {
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        await this.loadDaysWithImages();
        this.renderCalendar();
    }

    static async nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        await this.loadDaysWithImages();
        this.renderCalendar();
    }
}

// Comparison Component
class CompareComponent {
    static mode = 'side-by-side';
    static img1Data = null;
    static img2Data = null;

    static load() {
        // Initialize slider functionality
        const slider = document.getElementById('comparison-slider');
        if (slider) {
            slider.addEventListener('input', (e) => {
                const percentage = e.target.value;
                document.getElementById('slider-img2-container').style.width = percentage + '%';
            });
        }
    }

    static setMode(mode) {
        this.mode = mode;

        // Update button states
        document.getElementById('mode-side-by-side').classList.toggle('btn-active', mode === 'side-by-side');
        document.getElementById('mode-slider').classList.toggle('btn-active', mode === 'slider');

        // Show/hide views
        document.getElementById('side-by-side-view').classList.toggle('hidden', mode !== 'side-by-side');
        document.getElementById('slider-view').classList.toggle('hidden', mode !== 'slider');

        // If we have images loaded, update the display
        if (this.img1Data && this.img2Data) {
            this.displayImages();
        }
    }

    static async quickCompare(daysAgo) {
        try {
            const data = await API.get(`/api/compare/quick?days_ago=${daysAgo}`);

            if (data.success) {
                this.img1Data = data.img1;
                this.img2Data = data.img2;
                this.displayImages();
                Notifier.success(`Comparing with image from ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`);
            } else {
                Notifier.error(data.error || 'No comparison image found');
            }
        } catch (error) {
            console.error('Comparison error:', error);
            Notifier.error(`Failed to load comparison: ${error.message}`);
        }
    }

    static displayImages() {
        if (!this.img1Data || !this.img2Data) return;

        if (this.mode === 'side-by-side') {
            // Display in side-by-side mode
            document.getElementById('compare-img1-container').innerHTML =
                `<img src="/image/${this.img1Data.path}" alt="Latest" class="w-full rounded-lg">`;
            document.getElementById('compare-img1-info').textContent =
                `${this.img1Data.timestamp} (${this.img1Data.size_mb} MB)`;

            document.getElementById('compare-img2-container').innerHTML =
                `<img src="/image/${this.img2Data.path}" alt="Comparison" class="w-full rounded-lg">`;
            document.getElementById('compare-img2-info').textContent =
                `${this.img2Data.timestamp} (${this.img2Data.size_mb} MB)`;
        } else {
            // Display in slider mode
            document.getElementById('slider-img1').src = `/image/${this.img1Data.path}`;
            document.getElementById('slider-img2').src = `/image/${this.img2Data.path}`;

            document.getElementById('slider-img1-info').textContent =
                `${this.img1Data.timestamp} (${this.img1Data.size_mb} MB)`;
            document.getElementById('slider-img2-info').textContent =
                `${this.img2Data.timestamp} (${this.img2Data.size_mb} MB)`;

            // Reset slider to 50%
            document.getElementById('comparison-slider').value = 50;
            document.getElementById('slider-img2-container').style.width = '50%';
        }
    }
}

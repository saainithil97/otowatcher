import axios from 'axios';
import type {
  ApiResponse,
  Stats,
  ImageInfo,
  ServiceStatusResponse,
  HealthInfo,
  Config,
  ComparisonData,
} from '../types';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.DEV ? 'http://localhost:5000' : '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// API Client
export const apiClient = {
  // Stats
  async getStats(): Promise<Stats> {
    const { data } = await api.get<Stats>('/api/stats');
    return data;
  },

  // Gallery
  async getGallery(count = 20): Promise<ImageInfo[]> {
    const { data } = await api.get<ApiResponse>(`/api/gallery?count=${count}`);
    return data.images || [];
  },

  // Config
  async getConfig(): Promise<Config> {
    const { data } = await api.get<ApiResponse>('/api/config');
    return data.config;
  },

  async saveConfig(config: Config): Promise<void> {
    await api.post('/api/config', config);
  },

  // Services
  async getServiceStatus(): Promise<ServiceStatusResponse> {
    const { data } = await api.get<ApiResponse>('/api/service/status');
    return data.services;
  },

  async controlService(action: 'start' | 'stop' | 'restart', service: string): Promise<void> {
    await api.post(`/api/service/${action}`, { service });
  },

  // Health
  async getHealth(): Promise<HealthInfo> {
    const { data } = await api.get<ApiResponse>('/api/health');
    return data.health;
  },

  // Stream
  async startStream(): Promise<void> {
    await api.post('/api/stream/start', {});
  },

  async stopStream(): Promise<void> {
    await api.post('/api/stream/stop', {});
  },

  async getStreamStatus(): Promise<{ active: boolean }> {
    const { data } = await api.get<ApiResponse>('/api/stream/status');
    return { active: data.active };
  },

  // Capture
  async captureNow(): Promise<ApiResponse> {
    const { data } = await api.post<ApiResponse>('/api/capture');
    return data;
  },

  // Calendar
  async getCalendarDays(year: number, month: number): Promise<{ days: string[]; year: number; month: number }> {
    const { data } = await api.get<ApiResponse>(`/api/calendar/days?year=${year}&month=${month}`);
    return {
      days: data.days || [],
      year: data.year,
      month: data.month,
    };
  },

  async getCalendarImages(date: string): Promise<ImageInfo[]> {
    const { data } = await api.get<ApiResponse>(`/api/calendar/images?date=${date}`);
    return data.images || [];
  },

  // Comparison
  async quickCompare(daysAgo: number): Promise<ComparisonData> {
    const { data } = await api.get<ApiResponse>(`/api/compare/quick?days_ago=${daysAgo}`);
    if (!data.success) {
      throw new Error(data.error || 'Comparison failed');
    }
    return {
      img1: data.img1,
      img2: data.img2,
      days_difference: data.days_difference,
    };
  },
};

export default apiClient;

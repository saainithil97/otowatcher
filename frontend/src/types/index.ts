// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  [key: string]: any;
}

// Stats Types
export interface Stats {
  total_images: number;
  today_images: number;
  disk_usage_gb: number;
  latest_time: string | null;
}

// Image Types
export interface ImageInfo {
  filename: string;
  path: string;
  timestamp: string;
  time_only: string;
  date_only: string;
  timestamp_display?: string;
  size_mb: number;
}

// Service Types
export interface ServiceStatus {
  active: boolean;
  name: string;
}

export interface ServiceStatusResponse {
  capture: ServiceStatus;
  sync_timer: ServiceStatus;
  cleanup_timer: ServiceStatus;
}

// Health Types
export interface HealthInfo {
  disk_free_gb: number;
  disk_total_gb: number;
  disk_usage_percent: number;
  last_sync: string | null;
  warnings: string[];
}

// Config Types
export interface Config {
  capture_interval_seconds: number;
  lights_only_mode: boolean;
  light_threshold: number;
  keep_days: number;
  image_quality: number;
  resolution: {
    width: number;
    height: number;
  };
  [key: string]: any;
}

// Calendar Types
export interface CalendarDay {
  date: string;
  hasImages: boolean;
}

// Comparison Types
export interface ComparisonData {
  img1: ImageInfo;
  img2: ImageInfo;
  days_difference: number;
}

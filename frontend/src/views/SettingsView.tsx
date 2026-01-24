import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '../api/client';
import type { Config } from '../types';

export default function SettingsView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'config' | 'services'>('config');

  // Fetch config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['config'],
    queryFn: apiClient.getConfig,
  });

  // Fetch services status
  const { data: services, refetch: refetchServices } = useQuery({
    queryKey: ['services'],
    queryFn: apiClient.getServiceStatus,
    refetchInterval: 5000,
  });

  // Config state
  const [editedConfig, setEditedConfig] = useState<Config | null>(null);

  // Update config when loaded
  if (config && !editedConfig) {
    setEditedConfig(config);
  }

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: (newConfig: Config) => apiClient.saveConfig(newConfig),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      alert('Configuration saved successfully!');
    },
    onError: (error) => {
      alert(`Failed to save configuration: ${error}`);
    },
  });

  // Service control mutation
  const controlServiceMutation = useMutation({
    mutationFn: ({ action, service }: { action: 'start' | 'stop' | 'restart'; service: string }) =>
      apiClient.controlService(action, service),
    onSuccess: () => {
      refetchServices();
    },
    onError: (error) => {
      alert(`Service control failed: ${error}`);
    },
  });

  const handleConfigChange = (path: string, value: any) => {
    if (!editedConfig) return;

    const newConfig = { ...editedConfig };
    const keys = path.split('.');
    let current: any = newConfig;

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    setEditedConfig(newConfig);
  };

  const handleSaveConfig = () => {
    if (editedConfig) {
      saveConfigMutation.mutate(editedConfig);
    }
  };

  if (configLoading || !editedConfig) {
    return (
      <div className="text-center py-12">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="mt-4 text-base-content/60">Loading settings...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Settings</h2>

      {/* Tabs */}
      <div className="tabs bg-base-100 tabs-boxed mb-6">
        <button
          className={`tab ${activeTab === 'config' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          Configuration
        </button>
        <button
          className={`tab ${activeTab === 'services' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          Services
        </button>
      </div>

      {/* Configuration Form */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Basic Settings */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Basic Settings</h3>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Capture Interval (seconds)</span>
                </label>
                <input
                  type="number"
                  min="60"
                  max="86400"
                  value={editedConfig.capture_interval_seconds}
                  onChange={(e) => handleConfigChange('capture_interval_seconds', Number(e.target.value))}
                  className="input input-bordered"
                />
                <label className="label">
                  <span className="label-text-alt">Time between automatic captures (60-86400)</span>
                </label>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Keep Days</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={editedConfig.keep_days}
                  onChange={(e) => handleConfigChange('keep_days', Number(e.target.value))}
                  className="input input-bordered"
                />
                <label className="label">
                  <span className="label-text-alt">Days to keep images locally before cleanup</span>
                </label>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Image Quality</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editedConfig.image_quality}
                  onChange={(e) => handleConfigChange('image_quality', Number(e.target.value))}
                  className="input input-bordered"
                />
                <label className="label">
                  <span className="label-text-alt">JPEG quality (1-100, higher = better quality)</span>
                </label>
              </div>

              <div className="form-control">
                <label className="cursor-pointer label">
                  <span className="label-text">Lights Only Mode</span>
                  <input
                    type="checkbox"
                    checked={editedConfig.lights_only_mode}
                    onChange={(e) => handleConfigChange('lights_only_mode', e.target.checked)}
                    className="checkbox checkbox-primary"
                  />
                </label>
                <label className="label">
                  <span className="label-text-alt">Only capture when aquarium lights are detected</span>
                </label>
              </div>

              {editedConfig.lights_only_mode && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Light Threshold</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editedConfig.light_threshold}
                    onChange={(e) => handleConfigChange('light_threshold', Number(e.target.value))}
                    className="input input-bordered"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Capture Window */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Capture Window</h3>

              <div className="form-control">
                <label className="cursor-pointer label">
                  <span className="label-text">Enable Time Window</span>
                  <input
                    type="checkbox"
                    checked={editedConfig.capture_window?.enabled || false}
                    onChange={(e) => handleConfigChange('capture_window.enabled', e.target.checked)}
                    className="checkbox checkbox-primary"
                  />
                </label>
                <label className="label">
                  <span className="label-text-alt">Only capture during specific hours</span>
                </label>
              </div>

              {editedConfig.capture_window?.enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Start Time</span>
                    </label>
                    <input
                      type="time"
                      value={editedConfig.capture_window.start_time}
                      onChange={(e) => handleConfigChange('capture_window.start_time', e.target.value)}
                      className="input input-bordered"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">End Time</span>
                    </label>
                    <input
                      type="time"
                      value={editedConfig.capture_window.end_time}
                      onChange={(e) => handleConfigChange('capture_window.end_time', e.target.value)}
                      className="input input-bordered"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resolution */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Resolution</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Width</span>
                  </label>
                  <input
                    type="number"
                    value={editedConfig.resolution.width}
                    onChange={(e) => handleConfigChange('resolution.width', Number(e.target.value))}
                    className="input input-bordered"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Height</span>
                  </label>
                  <input
                    type="number"
                    value={editedConfig.resolution.height}
                    onChange={(e) => handleConfigChange('resolution.height', Number(e.target.value))}
                    className="input input-bordered"
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap mt-2">
                <button onClick={() => { handleConfigChange('resolution.width', 2560); handleConfigChange('resolution.height', 1440); }} className="btn btn-xs">2560x1440</button>
                <button onClick={() => { handleConfigChange('resolution.width', 3840); handleConfigChange('resolution.height', 2160); }} className="btn btn-xs">3840x2160</button>
                <button onClick={() => { handleConfigChange('resolution.width', 1920); handleConfigChange('resolution.height', 1080); }} className="btn btn-xs">1920x1080</button>
              </div>
            </div>
          </div>

          {/* Camera Settings */}
          {editedConfig.camera_settings && (
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title">Camera Settings (v3)</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Sharpness</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={editedConfig.camera_settings.sharpness}
                      onChange={(e) => handleConfigChange('camera_settings.sharpness', Number(e.target.value))}
                      className="input input-bordered"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Contrast</span>
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="2"
                      value={editedConfig.camera_settings.contrast}
                      onChange={(e) => handleConfigChange('camera_settings.contrast', Number(e.target.value))}
                      className="input input-bordered"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Saturation</span>
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="2"
                      value={editedConfig.camera_settings.saturation}
                      onChange={(e) => handleConfigChange('camera_settings.saturation', Number(e.target.value))}
                      className="input input-bordered"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Exposure Compensation</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="-2"
                      max="2"
                      value={editedConfig.camera_settings.exposure_compensation}
                      onChange={(e) => handleConfigChange('camera_settings.exposure_compensation', Number(e.target.value))}
                      className="input input-bordered"
                    />
                  </div>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Metering Mode</span>
                  </label>
                  <select
                    value={editedConfig.camera_settings.metering_mode}
                    onChange={(e) => handleConfigChange('camera_settings.metering_mode', e.target.value)}
                    className="select select-bordered"
                  >
                    <option value="CentreWeighted">Centre Weighted</option>
                    <option value="Spot">Spot</option>
                    <option value="Matrix">Matrix</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Noise Reduction</span>
                  </label>
                  <select
                    value={editedConfig.camera_settings.noise_reduction_mode}
                    onChange={(e) => handleConfigChange('camera_settings.noise_reduction_mode', e.target.value)}
                    className="select select-bordered"
                  >
                    <option value="HighQuality">High Quality</option>
                    <option value="Fast">Fast</option>
                    <option value="Minimal">Minimal</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <button
                onClick={handleSaveConfig}
                disabled={saveConfigMutation.isPending}
                className="btn btn-primary btn-lg w-full"
              >
                {saveConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
              </button>
              <p className="text-sm text-base-content/60 mt-2">
                Note: Capture service will need to be restarted for changes to take effect.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Services Management */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          {services && Object.entries(services).map(([key, service]) => (
            <div key={key} className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="card-title">{service.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <div className={`badge ${service.active ? 'badge-success' : 'badge-error'}`}>
                        {service.active ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => controlServiceMutation.mutate({ action: 'start', service: key })}
                      disabled={service.active || controlServiceMutation.isPending}
                      className="btn btn-sm btn-success"
                    >
                      Start
                    </button>
                    <button
                      onClick={() => controlServiceMutation.mutate({ action: 'stop', service: key })}
                      disabled={!service.active || controlServiceMutation.isPending}
                      className="btn btn-sm btn-error"
                    >
                      Stop
                    </button>
                    <button
                      onClick={() => controlServiceMutation.mutate({ action: 'restart', service: key })}
                      disabled={controlServiceMutation.isPending}
                      className="btn btn-sm"
                    >
                      Restart
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {!services && (
            <div className="text-center py-12">
              <span className="loading loading-spinner loading-lg"></span>
              <p className="mt-4 text-base-content/60">Loading services...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

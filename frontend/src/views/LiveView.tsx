import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

type ViewMode = 'image' | 'stream';

export default function LiveView() {
  const [viewMode, setViewMode] = useState<ViewMode>('image');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [imageKey, setImageKey] = useState(Date.now());
  const [streamActive, setStreamActive] = useState(false);

  // Fetch stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['stats'],
    queryFn: apiClient.getStats,
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Fetch stream status
  const { data: streamStatus } = useQuery({
    queryKey: ['stream-status'],
    queryFn: apiClient.getStreamStatus,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (streamStatus) {
      setStreamActive(streamStatus.active);
    }
  }, [streamStatus]);

  // Capture mutation
  const captureMutation = useMutation({
    mutationFn: apiClient.captureNow,
    onSuccess: () => {
      setImageKey(Date.now());
      refetchStats();
    },
  });

  // Stream mutations
  const startStreamMutation = useMutation({
    mutationFn: apiClient.startStream,
    onSuccess: () => {
      setStreamActive(true);
    },
  });

  const stopStreamMutation = useMutation({
    mutationFn: apiClient.stopStream,
    onSuccess: () => {
      setStreamActive(false);
    },
  });

  // Auto-refresh effect for image view
  useEffect(() => {
    if (autoRefresh && viewMode === 'image') {
      const interval = setInterval(() => {
        setImageKey(Date.now());
        refetchStats();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, viewMode, refetchStats]);

  return (
    <div>
      {/* Stats Dashboard */}
      <div className="stats stats-vertical lg:stats-horizontal shadow mb-6 w-full">
        <div className="stat">
          <div className="stat-title">Total Images</div>
          <div className="stat-value text-primary">{stats?.total_images ?? 0}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Today</div>
          <div className="stat-value text-primary">{stats?.today_images ?? 0}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Disk Usage</div>
          <div className="stat-value text-primary">{stats?.disk_usage_gb?.toFixed(2) ?? 0} GB</div>
        </div>
        <div className="stat">
          <div className="stat-title">Latest Capture</div>
          <div className="stat-value text-sm">
            {stats?.latest_time ? new Date(stats.latest_time).toLocaleTimeString() : 'N/A'}
          </div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="tabs tabs-boxed mb-4">
        <button
          className={`tab ${viewMode === 'image' ? 'tab-active' : ''}`}
          onClick={() => setViewMode('image')}
        >
          Capture Image
        </button>
        <button
          className={`tab ${viewMode === 'stream' ? 'tab-active' : ''}`}
          onClick={() => setViewMode('stream')}
        >
          Live Stream
        </button>
      </div>

      {/* Image Capture View */}
      {viewMode === 'image' && (
        <>          
          {/*           
          <div className="flex gap-2 mb-4 flex-wrap">            
            <a href="/latest.jpg" download className="btn btn-ghost">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Download
            </a>
          </div> */}

          {/* Latest Image Display */}
          <div className="card bg-base-100 shadow-xl">
            { imageKey && 
              <figure className="p-4">
                <img
                  key={imageKey}
                  src={`/latest.jpg?t=${imageKey}`}
                  alt="Latest capture"
                  className="rounded-xl w-full"
                />
                {/* Control Buttons */}
                  <ul className="menu menu-vertical lg:menu-horizontal backdrop-blur-md rounded-box absolute top-8 left-1/2 -translate-x-1/2">
                    <li>
                      <button
                        onClick={() => captureMutation.mutate()}
                        disabled={captureMutation.isPending}
                        className="btn btn-ghost"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                        {captureMutation.isPending ? 'Capturing...' : 'Capture Now'}
                      </button>
                    </li>
                    <li>
                      <button onClick={() => setImageKey(Date.now())} className="btn btn-ghost">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                        </svg>
                        Refresh
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`btn ${autoRefresh ? 'btn-active' : 'btn-ghost'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        Auto-Refresh (30s)
                      </button>
                    </li>
                  </ul>
              </figure>
            }
          </div>
        </>
      )}

      {/* Live Stream View */}
      {viewMode === 'stream' && (
        <>
          {/* Stream Controls */}
          <div className="flex gap-2 mb-4">
            {!streamActive ? (
              <button
                onClick={() => startStreamMutation.mutate()}
                disabled={startStreamMutation.isPending}
                className="btn btn-outline btn-primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                {startStreamMutation.isPending ? 'Starting...' : 'Start Stream'}
              </button>
            ) : (
              <button
                onClick={() => stopStreamMutation.mutate()}
                disabled={stopStreamMutation.isPending}
                className="btn btn-outline btn-error"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                {stopStreamMutation.isPending ? 'Stopping...' : 'Stop Stream'}
              </button>
            )}

            
          </div>

          {/* Stream Display */}
          <div className="card bg-base-100 shadow-xl">
            {streamActive ? (
              <figure className="px-4 pt-4">
                <img
                  src="/video_feed"
                  alt="Live stream"
                  className="rounded-xl w-full"
                />
                <div className="badge badge-success absolute top-4 right-4 ">
                  <span className="animate-pulse">●</span>
                  live
                </div>
              </figure>
            ) : (
              <div className="card-body">
                <div className="text-center py-12">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mx-auto text-base-content/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-base-content/60">Stream is not active. Click "Start Stream" to begin.</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

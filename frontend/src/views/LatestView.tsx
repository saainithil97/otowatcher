import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import apiClient from '../api/client';

export default function LatestView() {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [imageKey, setImageKey] = useState(Date.now());

  // Fetch stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['stats'],
    queryFn: apiClient.getStats,
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Capture mutation
  const captureMutation = useMutation({
    mutationFn: apiClient.captureNow,
    onSuccess: () => {
      setImageKey(Date.now());
      refetchStats();
    },
  });

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setImageKey(Date.now());
        refetchStats();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refetchStats]);

  const refreshImage = () => {
    setImageKey(Date.now());
    refetchStats();
  };

  const downloadImage = () => {
    window.open(`/latest.jpg?t=${Date.now()}`, '_blank');
  };

  const hasImage = stats && stats.total_images > 0;

  return (
    <div>
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Latest Capture</h2>
        <p className="text-base-content/60">Real-time view of your aquarium</p>
      </div>

      {/* Stats */}
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
          <div className="stat-title">Storage</div>
          <div className="stat-value text-primary">{stats?.disk_usage_gb ?? 0} GB</div>
        </div>
        <div className="stat">
          <div className="stat-title">Last Capture</div>
          <div className="stat-value text-primary">
            {stats?.latest_time
              ? new Date(stats.latest_time).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '--:--'}
          </div>
          {stats?.latest_time && (
            <div className="stat-desc">
              {new Date(stats.latest_time).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </div>
          )}
        </div>
      </div>

      {hasImage ? (
        <>
          {/* Controls Menu */}
          <ul className="menu menu-horizontal bg-base-200 rounded-box mb-4 p-2">
            <li>
              <button
                onClick={() => captureMutation.mutate()}
                disabled={captureMutation.isPending}
                className="btn btn-primary btn-sm"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {captureMutation.isPending ? 'Capturing...' : 'Capture Now'}
              </button>
            </li>
            <li>
              <button onClick={refreshImage}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </li>
            <li>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? 'btn-active' : ''}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {autoRefresh ? 'Stop Auto-Refresh' : 'Auto-Refresh (30s)'}
              </button>
            </li>
            <li>
              <button onClick={downloadImage}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download
              </button>
            </li>
          </ul>

          {/* Image */}
          <div className="card bg-base-100 shadow-xl mb-4">
            <figure className="px-4 pt-4">
              <img
                key={imageKey}
                src={`/latest.jpg?t=${imageKey}`}
                alt="Latest aquarium photo"
                className="rounded-lg"
                style={{ maxHeight: '70vh', objectFit: 'contain' }}
              />
            </figure>
          </div>
        </>
      ) : (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body items-center text-center">
            <p className="text-base-content/60">No images captured yet</p>
          </div>
        </div>
      )}
    </div>
  );
}

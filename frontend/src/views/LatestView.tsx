import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

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


  // Auto-refresh effect for image view
  useEffect(() => {
    if (autoRefresh ) {
      const interval = setInterval(() => {
        setImageKey(Date.now());
        refetchStats();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refetchStats]);

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
              <ul className="menu menu-vertical lg:menu-horizontal bg-base-100 rounded-box absolute bottom-8 left-1/2 -translate-x-1/2">
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
    </div>
  );
}

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';


export default function LiveView() {
  const [streamActive, setStreamActive] = useState(false);

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

  return (
    <div>
      
    {/* Live Stream View */}
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
      <div className="card bg-base-100 border-base-300 shadow-xl">
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
    </div>
  );
}

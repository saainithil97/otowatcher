import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';

export default function GalleryView() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [currentFlipbookIndex, setCurrentFlipbookIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [preloadProgress, setPreloadProgress] = useState(0);

  const flipbookIntervalRef = useRef<number | null>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const controlsTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch images for selected date
  const { data: images = [], isLoading } = useQuery({
    queryKey: ['calendar-images', selectedDate],
    queryFn: () => apiClient.getCalendarImages(selectedDate),
  });

  const sortedImages = [...images].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  // Pre-load images with progress tracking
  useEffect(() => {
    if (sortedImages.length === 0) return;

    imageCache.current.clear();
    setPreloadProgress(0);

    let loaded = 0;
    sortedImages.forEach((image) => {
      const img = new Image();
      img.onload = () => {
        loaded++;
        setPreloadProgress(Math.round((loaded / sortedImages.length) * 100));
      };
      img.src = `/image/${image.path}`;
      imageCache.current.set(image.path, img);
    });
  }, [sortedImages]);

  useEffect(() => {
    setCurrentFlipbookIndex(0);
  }, [selectedDate]);

  // Auto-play with variable speed
  useEffect(() => {
    if (isPlaying && sortedImages.length > 0) {
      const intervalMs = 100 / playbackSpeed; // Base 10 fps
      const intervalId = setInterval(() => {
        setCurrentFlipbookIndex((prevIndex) => {
          if (prevIndex >= sortedImages.length - 1) {
            return 0;
          }
          return prevIndex + 1;
        });
      }, intervalMs);

      flipbookIntervalRef.current = intervalId;
      return () => clearInterval(intervalId);
    } else {
      if (flipbookIntervalRef.current) {
        clearInterval(flipbookIntervalRef.current);
        flipbookIntervalRef.current = null;
      }
    }
  }, [isPlaying, sortedImages.length, playbackSpeed]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentFlipbookIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentFlipbookIndex((prev) => Math.min(sortedImages.length - 1, prev + 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedImages.length]);

  // Auto-hide controls in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const togglePlayPause = () => setIsPlaying((prev) => !prev);
  const previousImage = () => {
    setIsPlaying(false);
    setCurrentFlipbookIndex((prev) => Math.max(0, prev - 1));
  };
  const nextImage = () => {
    setIsPlaying(false);
    setCurrentFlipbookIndex((prev) => Math.min(sortedImages.length - 1, prev + 1));
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPlaying(false);
    setCurrentFlipbookIndex(parseInt(e.target.value));
  };

  const getDateOptions = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : date.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' });
      dates.push({ value: dateStr, label });
    }
    return dates;
  };

  const dateOptions = getDateOptions();
  const currentImage = sortedImages[currentFlipbookIndex];

  return (
    <div className="min-h-screen">
      {/* Modern Date Tabs */}
      <div className="mb-6">
        <div className="flex gap-1 p-1 bg-base-100 backdrop-blur-sm rounded-xl">
          {dateOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedDate(option.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedDate === option.value
                  ? 'bg-primary text-primary-content shadow-lg'
                  : 'text-base-content/60 hover:text-base-content hover:bg-base-100/50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="text-base-content/60">Loading images...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && sortedImages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-24 h-24 rounded-full bg-base-200 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-base-content/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-medium text-base-content/80">No images for {selectedDate}</p>
            <p className="text-sm text-base-content/50">Try selecting a different date or check your capture settings</p>
          </div>
        </div>
      )}

      {/* Video Player-style Flipbook */}
      {!isLoading && sortedImages.length > 0 && (
        <div
          ref={containerRef}
          className={`relative group ${isFullscreen ? 'h-screen bg-black' : ''}`}
        >
          {/* Preload Progress Banner */}
          {/* {preloadProgress < 100 && (
            <div className="mb-4 px-4 py-2 bg-info/10 border border-info/20 rounded-lg flex items-center gap-3">
              <div className="loading loading-spinner loading-sm text-info"></div>
              <span className="text-sm text-base-content/70">
                Pre-loading images... {preloadProgress}%
              </span>
            </div>
          )} */}

          {/* Image Container */}
          <div className={`relative bg-black rounded-xl overflow-hidden ${isFullscreen ? 'h-full' : 'aspect-video'}`}>
            {/* Main Image */}
            <img
              key={currentFlipbookIndex}
              src={`/image/${currentImage.path}`}
              alt={`Frame ${currentFlipbookIndex + 1}`}
              className="w-full h-full object-contain"
            />

            {/* Overlays */}
            <div
              className={`absolute inset-0 transition-opacity duration-300 ${
                showControls || !isFullscreen ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {/* Top Bar - Info */}
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-white/90 text-sm font-medium">
                    {currentImage.time_only}
                  </span>
                  <div className={`badge badge-sm ${isPlaying ? 'badge-success' : 'badge-ghost'} gap-1`}>
                    {isPlaying && <span className="animate-pulse">●</span>}
                    {isPlaying ? `${playbackSpeed}x` : 'Paused'}
                  </div>
                </div>
                {preloadProgress === 100 && (
                  <div className="badge badge-sm badge-success gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Ready
                  </div>
                )}
              </div>

              {/* Bottom Controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 space-y-3">
                {/* Progress Slider */}
                <input
                  type="range"
                  min="0"
                  max={sortedImages.length - 1}
                  value={currentFlipbookIndex}
                  onChange={handleScrub}
                  className="range range-primary range-xs w-full"
                />

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Previous */}
                    <button
                      onClick={previousImage}
                      disabled={currentFlipbookIndex === 0}
                      className="btn btn-sm btn-circle btn-ghost text-white hover:bg-white/20 disabled:opacity-30"
                      title="Previous (←)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
                      </svg>
                    </button>

                    {/* Play/Pause */}
                    <button
                      onClick={togglePlayPause}
                      className="btn btn-circle btn-primary shadow-lg"
                      title="Play/Pause (Space)"
                    >
                      {isPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    {/* Next */}
                    <button
                      onClick={nextImage}
                      disabled={currentFlipbookIndex === sortedImages.length - 1}
                      className="btn btn-sm btn-circle btn-ghost text-white hover:bg-white/20 disabled:opacity-30"
                      title="Next (→)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
                      </svg>
                    </button>

                    {/* Frame Counter */}
                    <span className="text-white/80 text-sm font-medium ml-2">
                      {currentFlipbookIndex + 1} / {sortedImages.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Speed Control */}
                    <div className="dropdown dropdown-top">
                      <label tabIndex={0} className="btn btn-sm btn-ghost text-white hover:bg-white/20">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                        {playbackSpeed}x
                      </label>
                      <ul tabIndex={0} className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-32 mb-2">
                        {[0.25, 0.5, 1, 2, 4].map((speed) => (
                          <li key={speed}>
                            <a
                              onClick={() => setPlaybackSpeed(speed)}
                              className={playbackSpeed === speed ? 'active' : ''}
                            >
                              {speed}x
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Fullscreen */}
                    <button
                      onClick={toggleFullscreen}
                      className="btn btn-sm btn-ghost text-white hover:bg-white/20"
                      title="Fullscreen (F)"
                    >
                      {isFullscreen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Keyboard Hints */}
          {!isFullscreen && (
            <div className="mt-4 flex items-center justify-center gap-6 text-xs text-base-content/50">
              <span className="flex items-center gap-1">
                <kbd className="kbd kbd-xs">Space</kbd>
                <span>Play/Pause</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="kbd kbd-xs">←</kbd>
                <kbd className="kbd kbd-xs">→</kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="kbd kbd-xs">F</kbd>
                <span>Fullscreen</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

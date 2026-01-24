import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';

export default function GalleryView() {
  // State
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Default to today
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [currentFlipbookIndex, setCurrentFlipbookIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false); // Auto-play by default
  const flipbookIntervalRef = useRef<number | null>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Fetch images for selected date
  const { data: images = [], isLoading } = useQuery({
    queryKey: ['calendar-images', selectedDate],
    queryFn: () => apiClient.getCalendarImages(selectedDate),
  });

  // Sort images chronologically (oldest → newest)
  const sortedImages = [...images].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  // Pre-load images for smooth playback
  useEffect(() => {
    if (sortedImages.length === 0) return;

    // Clear old cache
    imageCache.current.clear();

    // Pre-load all images
    sortedImages.forEach((image) => {
      const img = new Image();
      img.src = `/image/${image.path}`;
      imageCache.current.set(image.path, img);
    });
  }, [sortedImages]);

  // Reset index when date changes
  useEffect(() => {
    setCurrentFlipbookIndex(0);
  }, [selectedDate]);

  // Flipbook: Auto-play at 10 fps (100ms interval)
  useEffect(() => {
    if (isPlaying && sortedImages.length > 0) {
      const intervalId = setInterval(() => {
        setCurrentFlipbookIndex((prevIndex) => {
          if (prevIndex >= sortedImages.length - 1) {
            return 0; // Loop back to start
          }
          return prevIndex + 1;
        });
      }, 100); // 10 fps = 100ms per frame

      flipbookIntervalRef.current = intervalId;

      return () => {
        clearInterval(intervalId);
        flipbookIntervalRef.current = null;
      };
    } else {
      if (flipbookIntervalRef.current) {
        clearInterval(flipbookIntervalRef.current);
        flipbookIntervalRef.current = null;
      }
    }
  }, [isPlaying, sortedImages.length]);

  // Keyboard controls (ESC to stop, arrow keys to navigate, Space to play/pause)
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedImages.length]);

  // Control functions
  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const previousImage = () => {
    setIsPlaying(false);
    setCurrentFlipbookIndex((prev) => Math.max(0, prev - 1));
  };

  const nextImage = () => {
    setIsPlaying(false);
    setCurrentFlipbookIndex((prev) => Math.min(sortedImages.length - 1, prev + 1));
  };

  // Generate date options (last 7 days)
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

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Timelapse Gallery</h2>

      {/* Date Selector */}
      <div className="card bg-base-100 shadow-xl mb-4">
        <div className="card-body p-4">
          <h3 className="text-sm font-semibold mb-2">Select Date</h3>
          <div className="flex gap-2 flex-wrap">
            {dateOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedDate(option.value)}
                className={`btn btn-sm ${selectedDate === option.value ? 'btn-primary' : 'btn-ghost'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {/* No Images */}
      {!isLoading && sortedImages.length === 0 && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body text-center py-12">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mx-auto text-base-content/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-base-content/60">No images found for {selectedDate}</p>
            <p className="text-sm text-base-content/40 mt-2">Try selecting a different date</p>
          </div>
        </div>
      )}

      {/* Flipbook View */}
      {!isLoading && sortedImages.length > 0 && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-4">
            {/* Image Display */}
            <div
              className="relative w-full bg-base-300 rounded-lg overflow-hidden"
              style={{ paddingBottom: '56.25%' }}
            >
              <img
                key={currentFlipbookIndex}
                src={`/image/${sortedImages[currentFlipbookIndex].path}`}
                alt={`Frame ${currentFlipbookIndex + 1}`}
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>

            {/* Progress Bar */}
            <progress
              className="progress progress-primary w-full mt-2"
              value={currentFlipbookIndex}
              max={sortedImages.length - 1}
            ></progress>

            {/* Controls */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                <button
                  onClick={previousImage}
                  disabled={currentFlipbookIndex === 0}
                  className="btn btn-sm btn-circle"
                  title="Previous (Left Arrow)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={togglePlayPause}
                  className="btn btn-sm btn-circle btn-primary"
                  title="Play/Pause (Space)"
                >
                  {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={nextImage}
                  disabled={currentFlipbookIndex === sortedImages.length - 1}
                  className="btn btn-sm btn-circle"
                  title="Next (Right Arrow)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div className="text-sm text-base-content/60">
                {currentFlipbookIndex + 1} / {sortedImages.length}
                <span className="ml-2 text-xs">
                  ({sortedImages[currentFlipbookIndex].time_only})
                </span>
              </div>

              <div className="text-xs text-base-content/60">
                {isPlaying ? '10 fps' : 'Paused'}
              </div>
            </div>

            <div className="text-xs text-center text-base-content/60 mt-2">
              Keyboard: Space = Play/Pause • Arrows = Navigate
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

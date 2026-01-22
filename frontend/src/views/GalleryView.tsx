import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import type { ImageInfo } from '../types';

type CompareMode = 'side-by-side' | 'slider' | null;

export default function GalleryView() {
  // State
  const [galleryCount, setGalleryCount] = useState(20);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [daysWithImages, setDaysWithImages] = useState<string[]>([]);

  // Comparison state
  const [compareMode, setCompareMode] = useState<CompareMode>(null);
  const [selectedImages, setSelectedImages] = useState<ImageInfo[]>([]);
  const [compareImg1, setCompareImg1] = useState<ImageInfo | null>(null);
  const [compareImg2, setCompareImg2] = useState<ImageInfo | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);

  // Flipbook state
  const [isFlipbookMode, setIsFlipbookMode] = useState(false);
  const [flipbookImages, setFlipbookImages] = useState<ImageInfo[]>([]);
  const [currentFlipbookIndex, setCurrentFlipbookIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const flipbookIntervalRef = useRef<number | null>(null);

  // Fetch gallery images (for grid view - limited to 20)
  const { data: galleryImages = [], refetch: refetchGallery } = useQuery({
    queryKey: ['gallery', galleryCount, selectedDate],
    queryFn: async () => {
      if (selectedDate) {
        return apiClient.getCalendarImages(selectedDate);
      }
      return apiClient.getGallery(galleryCount);
    },
  });

  // Fetch ALL images for flipbook (no limit)
  const { data: allImages = [] } = useQuery({
    queryKey: ['all-images', selectedDate],
    queryFn: async () => {
      if (selectedDate) {
        return apiClient.getCalendarImages(selectedDate);
      }
      // For all images, we'll use a very high count
      return apiClient.getGallery(10000);
    },
    enabled: isFlipbookMode,
  });

  // Fetch calendar days
  const { data: calendarData } = useQuery({
    queryKey: ['calendar-days', currentMonth.getFullYear(), currentMonth.getMonth() + 1],
    queryFn: () => apiClient.getCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
  });

  useEffect(() => {
    if (calendarData?.days) {
      setDaysWithImages(calendarData.days);
    }
  }, [calendarData]);

  // Flipbook: Load images in chronological order (oldest → newest)
  useEffect(() => {
    if (isFlipbookMode && allImages.length > 0) {
      // Sort images chronologically (oldest first)
      const sortedImages = [...allImages].sort((a, b) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
      setFlipbookImages(sortedImages);
      setCurrentFlipbookIndex(0);
    }
  }, [isFlipbookMode, allImages]);

  // Flipbook: Auto-play at 10 fps (100ms interval)
  useEffect(() => {
    // Clear any existing interval first
    if (flipbookIntervalRef.current) {
      clearInterval(flipbookIntervalRef.current);
      flipbookIntervalRef.current = null;
    }

    if (isFlipbookMode && isPlaying && flipbookImages.length > 0) {
      flipbookIntervalRef.current = setInterval(() => {
        setCurrentFlipbookIndex((prevIndex) => {
          if (prevIndex >= flipbookImages.length - 1) {
            // Loop back to start
            return 0;
          }
          return prevIndex + 1;
        });
      }, 100); // 10 fps = 100ms per frame
    }

    return () => {
      if (flipbookIntervalRef.current) {
        clearInterval(flipbookIntervalRef.current);
        flipbookIntervalRef.current = null;
      }
    };
  }, [isFlipbookMode, isPlaying, flipbookImages.length]);

  // Flipbook: Keyboard controls (ESC to exit, arrow keys to navigate)
  useEffect(() => {
    if (!isFlipbookMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitFlipbook();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentFlipbookIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentFlipbookIndex((prev) => Math.min(flipbookImages.length - 1, prev + 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipbookMode, flipbookImages.length]);

  // Quick compare functions
  const handleQuickCompare = async (daysAgo: number) => {
    try {
      const data = await apiClient.quickCompare(daysAgo);
      setCompareImg1(data.img1);
      setCompareImg2(data.img2);
      setCompareMode('side-by-side');
    } catch (error) {
      console.error('Compare failed:', error);
    }
  };

  // Manual image selection for compare
  const toggleImageSelection = (image: ImageInfo) => {
    if (selectedImages.find(img => img.path === image.path)) {
      setSelectedImages(selectedImages.filter(img => img.path !== image.path));
    } else if (selectedImages.length < 2) {
      const newSelection = [...selectedImages, image];
      setSelectedImages(newSelection);
      if (newSelection.length === 2) {
        // Second image selected, start comparison
        setCompareImg1(newSelection[0]);
        setCompareImg2(newSelection[1]);
        setCompareMode('side-by-side');
      }
    }
  };

  const clearComparison = () => {
    setCompareMode(null);
    setSelectedImages([]);
    setCompareImg1(null);
    setCompareImg2(null);
  };

  // Calendar navigation
  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    setSelectedDate(null);
  };

  const selectDate = (dateStr: string) => {
    setSelectedDate(selectedDate === dateStr ? null : dateStr);
    clearComparison();
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
    refetchGallery();
  };

  // Flipbook controls
  const startFlipbook = () => {
    setIsFlipbookMode(true);
    setIsPlaying(true);
    setCompareMode(null);
    setSelectedImages([]);
  };

  const exitFlipbook = () => {
    setIsFlipbookMode(false);
    setIsPlaying(false);
    setCurrentFlipbookIndex(0);
    setFlipbookImages([]);
  };

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const previousImage = () => {
    setIsPlaying(false);
    setCurrentFlipbookIndex((prev) => Math.max(0, prev - 1));
  };

  const nextImage = () => {
    setIsPlaying(false);
    setCurrentFlipbookIndex((prev) => Math.min(flipbookImages.length - 1, prev + 1));
  };

  // Render calendar grid
  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasImages = daysWithImages.includes(dateStr);
      const isSelected = selectedDate === dateStr;

      days.push(
        <button
          key={day}
          onClick={() => hasImages && selectDate(dateStr)}
          disabled={!hasImages}
          className={`
            p-2 text-center rounded-lg transition-colors text-sm
            ${hasImages ? 'hover:bg-primary/10 cursor-pointer' : 'opacity-30 cursor-not-allowed'}
            ${isSelected ? 'bg-primary text-primary-content font-bold' : ''}
            ${hasImages && !isSelected ? 'bg-base-200' : ''}
          `}
        >
          {day}
        </button>
      );
    }

    return (
      <div className="card bg-base-100 shadow-xl mb-4">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <button onClick={previousMonth} className="btn btn-sm btn-ghost">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <h3 className="text-lg font-bold">{monthName}</h3>
            <button onClick={nextMonth} className="btn btn-sm btn-ghost">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-semibold text-xs text-base-content/60">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days}
          </div>
          {selectedDate && (
            <button onClick={clearDateFilter} className="btn btn-sm btn-ghost mt-2">
              Clear Date Filter
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Gallery</h2>
        {!isFlipbookMode && (
          <button onClick={startFlipbook} className="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Start Flipbook
          </button>
        )}
      </div>

      {/* Calendar Filter - Hide in flipbook mode */}
      {!isFlipbookMode && (
        <div className="collapse collapse-arrow bg-base-200 mb-4">
          <input type="checkbox" />
          <div className="collapse-title text-lg font-medium">
            📅 Filter by Date
            {selectedDate && <span className="badge badge-primary ml-2">{selectedDate}</span>}
          </div>
          <div className="collapse-content">
            {renderCalendar()}
          </div>
        </div>
      )}

      {/* Flipbook View */}
      {isFlipbookMode && flipbookImages.length > 0 && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-4">
            {/* Flipbook Image Display */}
            <div
              className="relative w-full bg-base-300 rounded-lg overflow-hidden cursor-pointer"
              style={{ paddingBottom: '56.25%' }}
              onClick={exitFlipbook}
            >
              <img
                src={`/image/${flipbookImages[currentFlipbookIndex].path}`}
                alt={`Frame ${currentFlipbookIndex + 1}`}
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>

            {/* Progress Bar */}
            <progress
              className="progress progress-primary w-full mt-2"
              value={currentFlipbookIndex}
              max={flipbookImages.length - 1}
            ></progress>

            {/* Flipbook Controls */}
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
                  disabled={currentFlipbookIndex === flipbookImages.length - 1}
                  className="btn btn-sm btn-circle"
                  title="Next (Right Arrow)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div className="text-sm text-base-content/60">
                {currentFlipbookIndex + 1} / {flipbookImages.length}
              </div>

              <button onClick={exitFlipbook} className="btn btn-sm btn-ghost" title="Exit (ESC)">
                Exit Flipbook
              </button>
            </div>

            <div className="text-xs text-center text-base-content/60 mt-2">
              Keyboard: Space = Play/Pause • Arrows = Navigate • ESC = Exit • Click Image = Exit
            </div>
          </div>
        </div>
      )}

      {/* Quick Compare - Hide in flipbook mode */}
      {!isFlipbookMode && (
        <div className="card bg-base-100 shadow-xl mb-4">
          <div className="card-body">
            <h3 className="card-title text-sm">Quick Compare</h3>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => handleQuickCompare(1)} className="btn btn-sm">
                vs 1 Day Ago
              </button>
              <button onClick={() => handleQuickCompare(7)} className="btn btn-sm">
                vs 1 Week Ago
              </button>
              <button onClick={() => handleQuickCompare(30)} className="btn btn-sm">
                vs 1 Month Ago
              </button>
              <button onClick={() => handleQuickCompare(90)} className="btn btn-sm">
                vs 3 Months Ago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Mode UI - Hide in flipbook mode */}
      {!isFlipbookMode && compareMode && compareImg1 && compareImg2 && (
        <div className="card bg-base-100 shadow-xl mb-4">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h3 className="card-title">Comparison</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setCompareMode('side-by-side')}
                  className={`btn btn-sm ${compareMode === 'side-by-side' ? 'btn-active' : ''}`}
                >
                  Side by Side
                </button>
                <button
                  onClick={() => setCompareMode('slider')}
                  className={`btn btn-sm ${compareMode === 'slider' ? 'btn-active' : ''}`}
                >
                  Slider
                </button>
                <button onClick={clearComparison} className="btn btn-sm btn-ghost">
                  Clear
                </button>
              </div>
            </div>

            {compareMode === 'side-by-side' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold mb-2">{compareImg1.timestamp}</p>
                  <img src={`/image/${compareImg1.path}`} alt="Compare 1" className="rounded-lg w-full" />
                  <p className="text-xs text-base-content/60 mt-1">{compareImg1.size_mb} MB</p>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-2">{compareImg2.timestamp}</p>
                  <img src={`/image/${compareImg2.path}`} alt="Compare 2" className="rounded-lg w-full" />
                  <p className="text-xs text-base-content/60 mt-1">{compareImg2.size_mb} MB</p>
                </div>
              </div>
            ) : (
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <div className="absolute inset-0">
                  <img
                    src={`/image/${compareImg1.path}`}
                    alt="Compare 1"
                    className="absolute inset-0 w-full h-full object-cover rounded-lg"
                  />
                  <div
                    className="absolute inset-0 overflow-hidden rounded-lg"
                    style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                  >
                    <img
                      src={`/image/${compareImg2.path}`}
                      alt="Compare 2"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sliderPosition}
                    onChange={(e) => setSliderPosition(Number(e.target.value))}
                    className="range range-primary absolute top-1/2 left-0 right-0 z-10"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selection Hint - Hide in flipbook mode */}
      {!isFlipbookMode && !compareMode && (
        <div className="alert alert-info mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>Click on images to select up to 2 for comparison. Selected: {selectedImages.length}/2</span>
        </div>
      )}

      {/* Gallery Grid - Hide in flipbook mode */}
      {!isFlipbookMode && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        {galleryImages.map((image) => {
          const isSelected = selectedImages.find(img => img.path === image.path);
          return (
            <div
              key={image.path}
              onClick={() => toggleImageSelection(image)}
              className={`
                card bg-base-100 shadow-xl cursor-pointer hover:shadow-2xl transition-all
                ${isSelected ? 'ring-4 ring-primary' : ''}
              `}
            >
              <figure className="relative">
                <img src={`/image/${image.path}`} alt={image.filename} className="w-full aspect-video object-cover" />
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className="badge badge-primary">✓ {selectedImages.findIndex(img => img.path === image.path) + 1}</div>
                  </div>
                )}
              </figure>
              <div className="card-body p-2">
                <p className="text-xs font-semibold truncate">{image.time_only}</p>
                <p className="text-xs text-base-content/60">{image.size_mb} MB</p>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* No images message - Hide in flipbook mode */}
      {!isFlipbookMode && galleryImages.length === 0 && (
        <div className="text-center py-12">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mx-auto text-base-content/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-base-content/60">No images found{selectedDate ? ` for ${selectedDate}` : ''}.</p>
        </div>
      )}

      {/* Load More - Hide in flipbook mode */}
      {!isFlipbookMode && !selectedDate && galleryImages.length > 0 && galleryImages.length === galleryCount && (
        <div className="text-center mt-6">
          <button
            onClick={() => setGalleryCount(galleryCount + 20)}
            className="btn btn-primary"
          >
            Load More Images
          </button>
        </div>
      )}
    </div>
  );
}

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { ImageInfo } from '../types';

type ViewMode = 'latest' | 'gallery';
type CompareMode = 'side-by-side' | 'slider' | null;

export default function LiveView() {
  const [viewMode, setViewMode] = useState<ViewMode>('latest');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [imageKey, setImageKey] = useState(Date.now());
  const [galleryCount, setGalleryCount] = useState(20);

  // Calendar filter state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [daysWithImages, setDaysWithImages] = useState<string[]>([]);

  // Compare state
  const [compareMode, setCompareMode] = useState<CompareMode>(null);
  const [selectedImages, setSelectedImages] = useState<ImageInfo[]>([]);
  const [compareImg1, setCompareImg1] = useState<ImageInfo | null>(null);
  const [compareImg2, setCompareImg2] = useState<ImageInfo | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);

  // Fetch stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['stats'],
    queryFn: apiClient.getStats,
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Fetch gallery images
  const { data: galleryImages = [], refetch: refetchGallery } = useQuery({
    queryKey: ['gallery', galleryCount, selectedDate],
    queryFn: async () => {
      if (selectedDate) {
        const data = await apiClient.getCalendarImages(selectedDate);
        return data;
      }
      return apiClient.getGallery(galleryCount);
    },
    enabled: viewMode === 'gallery',
  });

  // Fetch calendar days
  const { data: calendarData } = useQuery({
    queryKey: ['calendar-days', currentMonth.getFullYear(), currentMonth.getMonth() + 1],
    queryFn: () => apiClient.getCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
    enabled: viewMode === 'gallery',
  });

  useEffect(() => {
    if (calendarData?.days) {
      setDaysWithImages(calendarData.days);
    }
  }, [calendarData]);

  // Capture mutation
  const captureMutation = useMutation({
    mutationFn: apiClient.captureNow,
    onSuccess: () => {
      setImageKey(Date.now());
      refetchStats();
      refetchGallery();
    },
  });

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && viewMode === 'latest') {
      const interval = setInterval(() => {
        setImageKey(Date.now());
        refetchStats();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, viewMode, refetchStats]);

  // Quick compare functions
  const handleQuickCompare = async (daysAgo: number) => {
    try {
      const data = await apiClient.quickCompare(daysAgo);
      setCompareImg1(data.img1);
      setCompareImg2(data.img2);
      setCompareMode('side-by-side');
      setViewMode('gallery');
    } catch (error) {
      console.error('Compare failed:', error);
    }
  };

  // Manual image selection for compare
  const toggleImageSelection = (image: ImageInfo) => {
    if (selectedImages.find(img => img.path === image.path)) {
      setSelectedImages(selectedImages.filter(img => img.path !== image.path));
    } else if (selectedImages.length < 2) {
      setSelectedImages([...selectedImages, image]);
      if (selectedImages.length === 1) {
        // Second image selected, start comparison
        setCompareImg1(selectedImages[0]);
        setCompareImg2(image);
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
            p-2 text-center rounded-lg transition-colors
            ${hasImages ? 'hover:bg-primary/10 cursor-pointer' : 'opacity-30 cursor-not-allowed'}
            ${isSelected ? 'bg-primary text-primary-content' : ''}
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
              <div key={day} className="text-center font-semibold text-sm text-base-content/60">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
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
          <div className="stat-title">Disk Usage</div>
          <div className="stat-value text-primary">{stats?.disk_usage_gb?.toFixed(2) ?? 0} GB</div>
        </div>
        <div className="stat">
          <div className="stat-title">Latest Capture</div>
          <div className="stat-value text-sm">{stats?.latest_time ? new Date(stats.latest_time).toLocaleTimeString() : 'N/A'}</div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="tabs tabs-boxed mb-4">
        <button
          className={`tab ${viewMode === 'latest' ? 'tab-active' : ''}`}
          onClick={() => { setViewMode('latest'); clearComparison(); }}
        >
          Latest Image
        </button>
        <button
          className={`tab ${viewMode === 'gallery' ? 'tab-active' : ''}`}
          onClick={() => setViewMode('gallery')}
        >
          Gallery
        </button>
      </div>

      {/* Latest View */}
      {viewMode === 'latest' && (
        <>
          {/* Control Menu */}
          <ul className="menu menu-horizontal bg-base-200 rounded-box mb-4 p-2 gap-2">
            <li>
              <button
                onClick={() => captureMutation.mutate()}
                disabled={captureMutation.isPending}
                className="btn btn-primary btn-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                {captureMutation.isPending ? 'Capturing...' : 'Capture Now'}
              </button>
            </li>
            <li>
              <button onClick={() => setImageKey(Date.now())} className="btn btn-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Refresh
              </button>
            </li>
            <li>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`btn btn-sm ${autoRefresh ? 'btn-active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                Auto (30s)
              </button>
            </li>
            <li>
              <a href="/latest.jpg" download className="btn btn-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download
              </a>
            </li>
          </ul>

          {/* Quick Compare Buttons */}
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

          {/* Latest Image */}
          <div className="card bg-base-100 shadow-xl">
            <figure className="px-4 pt-4">
              <img
                key={imageKey}
                src={`/latest.jpg?t=${imageKey}`}
                alt="Latest capture"
                className="rounded-xl w-full"
              />
            </figure>
            <div className="card-body">
              <p className="text-base-content/60 text-sm">
                Last updated: {new Date(imageKey).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Gallery View */}
      {viewMode === 'gallery' && (
        <>
          {/* Calendar Filter */}
          {renderCalendar()}

          {/* Compare Mode Toggle */}
          {compareMode && (
            <div className="card bg-base-100 shadow-xl mb-4">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <h3 className="card-title text-sm">Compare Mode</h3>
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
              </div>
            </div>
          )}

          {/* Comparison View */}
          {compareMode && compareImg1 && compareImg2 && (
            <div className="card bg-base-100 shadow-xl mb-4">
              <div className="card-body">
                {compareMode === 'side-by-side' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-semibold mb-2">{compareImg1.timestamp}</p>
                      <img src={`/image/${compareImg1.path}`} alt="Compare 1" className="rounded-lg w-full" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-2">{compareImg2.timestamp}</p>
                      <img src={`/image/${compareImg2.path}`} alt="Compare 2" className="rounded-lg w-full" />
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <div className="absolute inset-0">
                      <img src={`/image/${compareImg1.path}`} alt="Compare 1" className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                      <div
                        className="absolute inset-0 overflow-hidden rounded-lg"
                        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                      >
                        <img src={`/image/${compareImg2.path}`} alt="Compare 2" className="absolute inset-0 w-full h-full object-cover" />
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

          {/* Selection Hint */}
          {!compareMode && (
            <div className="alert alert-info mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Click on images to select up to 2 for comparison. Selected: {selectedImages.length}/2</span>
            </div>
          )}

          {/* Gallery Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {galleryImages.map((image) => {
              const isSelected = selectedImages.find(img => img.path === image.path);
              return (
                <div
                  key={image.path}
                  onClick={() => toggleImageSelection(image)}
                  className={`
                    card bg-base-100 shadow-xl cursor-pointer hover:shadow-2xl transition-shadow
                    ${isSelected ? 'ring-4 ring-primary' : ''}
                  `}
                >
                  <figure>
                    <img src={`/image/${image.path}`} alt={image.filename} className="w-full" />
                  </figure>
                  <div className="card-body p-3">
                    <p className="text-xs text-base-content/60">{image.time_only}</p>
                    <p className="text-xs text-base-content/40">{image.size_mb} MB</p>
                    {isSelected && (
                      <div className="badge badge-primary badge-sm">Selected</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More */}
          {!selectedDate && (
            <div className="text-center mt-6">
              <button
                onClick={() => setGalleryCount(galleryCount + 20)}
                className="btn btn-primary"
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

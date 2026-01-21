"""
Image Service
Handles image file operations and metadata
"""

import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional


class ImageService:
    """Service for managing timelapse images"""

    def __init__(self, images_dir: str):
        self.images_dir = Path(images_dir)

    def get_latest_image(self) -> Optional[Path]:
        """Find the most recent image"""
        try:
            all_images = []
            for date_dir in self.images_dir.iterdir():
                if date_dir.is_dir():
                    for img in date_dir.glob("*.jpg"):
                        all_images.append(img)

            if not all_images:
                return None

            # Sort by modification time
            latest = max(all_images, key=lambda p: p.stat().st_mtime)
            return latest
        except Exception as e:
            print(f"Error finding latest image: {e}")
            return None

    def get_recent_images(self, count: int = 10) -> List[Path]:
        """Get the most recent N images"""
        try:
            all_images = []
            for date_dir in self.images_dir.iterdir():
                if date_dir.is_dir():
                    for img in date_dir.glob("*.jpg"):
                        all_images.append(img)

            if not all_images:
                return []

            # Sort by modification time and get latest N
            recent = sorted(all_images, key=lambda p: p.stat().st_mtime, reverse=True)[:count]
            return recent
        except Exception as e:
            print(f"Error finding recent images: {e}")
            return []

    def get_image_stats(self) -> Dict:
        """Get statistics about images"""
        try:
            total_images = sum(1 for p in self.images_dir.rglob("*.jpg"))
            disk_usage = sum(p.stat().st_size for p in self.images_dir.rglob("*.jpg")) / (1024**3)  # GB

            # Count images today
            today = datetime.now().strftime("%Y-%m-%d")
            today_path = self.images_dir / today
            today_images = len(list(today_path.glob("*.jpg"))) if today_path.exists() else 0

            latest = self.get_latest_image()
            if latest:
                latest_time = datetime.fromtimestamp(latest.stat().st_mtime)
            else:
                latest_time = None

            return {
                "total_images": total_images,
                "today_images": today_images,
                "disk_usage_gb": round(disk_usage, 2),
                "latest_time": latest_time
            }
        except Exception as e:
            return {"error": str(e)}

    def get_image_info(self, img: Path) -> Dict:
        """Get metadata for a single image"""
        try:
            return {
                'filename': img.name,
                'path': str(img.relative_to(self.images_dir)),
                'timestamp': datetime.fromtimestamp(img.stat().st_mtime).isoformat(),
                'timestamp_display': datetime.fromtimestamp(img.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                'time_only': datetime.fromtimestamp(img.stat().st_mtime).strftime('%H:%M:%S'),
                'date_only': datetime.fromtimestamp(img.stat().st_mtime).strftime('%b %d, %Y'),
                'size_mb': round(img.stat().st_size / (1024**2), 2)
            }
        except Exception as e:
            print(f"Error getting image info: {e}")
            return {}

    def get_calendar_days(self, year: int, month: int) -> List[str]:
        """Get days in a month that have images"""
        try:
            days_with_images = []
            if self.images_dir.exists():
                for folder in os.listdir(self.images_dir):
                    try:
                        # Parse folder name (YYYY-MM-DD format)
                        folder_date = datetime.strptime(folder, '%Y-%m-%d')
                        if folder_date.year == year and folder_date.month == month:
                            folder_path = self.images_dir / folder
                            # Check if folder has images
                            if folder_path.is_dir():
                                images = [f for f in os.listdir(folder_path) if f.endswith('.jpg')]
                                if images:
                                    days_with_images.append(folder)
                    except (ValueError, OSError):
                        continue

            return sorted(days_with_images)
        except Exception as e:
            print(f"Error getting calendar days: {e}")
            return []

    def get_images_for_date(self, date_str: str) -> List[Dict]:
        """Get all images for a specific date"""
        try:
            folder_path = self.images_dir / date_str
            if not folder_path.exists():
                return []

            images = []
            for filename in sorted(os.listdir(folder_path)):
                if filename.endswith('.jpg'):
                    file_path = folder_path / filename
                    file_size = file_path.stat().st_size / (1024 * 1024)  # MB

                    # Parse timestamp from filename (YYYYMMdd_HHMMSS.jpg)
                    try:
                        timestamp = datetime.strptime(filename[:-4], '%Y%m%d_%H%M%S')
                        images.append({
                            'filename': filename,
                            'path': f"{date_str}/{filename}",
                            'timestamp': timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                            'time_only': timestamp.strftime('%H:%M:%S'),
                            'date_only': timestamp.strftime('%b %d, %Y'),
                            'size_mb': round(file_size, 2)
                        })
                    except (ValueError, OSError):
                        continue

            return images
        except Exception as e:
            print(f"Error getting images for date: {e}")
            return []

    def get_latest_image_info(self) -> Optional[Dict]:
        """Get info about the latest image"""
        try:
            # Get all date folders sorted
            date_folders = sorted([d for d in os.listdir(self.images_dir)
                                  if (self.images_dir / d).is_dir()], reverse=True)

            for date_folder in date_folders:
                folder_path = self.images_dir / date_folder
                images = sorted([f for f in os.listdir(folder_path) if f.endswith('.jpg')], reverse=True)

                if images:
                    latest_file = images[0]
                    file_path = folder_path / latest_file
                    file_size = file_path.stat().st_size / (1024 * 1024)  # MB

                    timestamp = datetime.strptime(latest_file[:-4], '%Y%m%d_%H%M%S')
                    return {
                        'filename': latest_file,
                        'path': f"{date_folder}/{latest_file}",
                        'timestamp': timestamp.isoformat(),
                        'size_mb': round(file_size, 2)
                    }
            return None
        except Exception as e:
            print(f"Error getting latest image: {e}")
            return None

    def find_closest_image(self, target_date: datetime, target_time) -> Optional[Dict]:
        """Find image closest to target date and time"""
        try:
            target_date_str = target_date.strftime('%Y-%m-%d')
            folder_path = self.images_dir / target_date_str

            if not folder_path.exists():
                # Try adjacent days if exact date doesn't exist
                for offset in [-1, 1, -2, 2]:
                    alt_date = target_date + timedelta(days=offset)
                    alt_date_str = alt_date.strftime('%Y-%m-%d')
                    folder_path = self.images_dir / alt_date_str
                    if folder_path.exists():
                        target_date_str = alt_date_str
                        break
                else:
                    return None

            images = [f for f in os.listdir(folder_path) if f.endswith('.jpg')]
            if not images:
                return None

            # Find image closest to target time
            target_seconds = target_time.hour * 3600 + target_time.minute * 60 + target_time.second
            closest_img = None
            closest_diff = float('inf')

            for img_file in images:
                try:
                    img_time = datetime.strptime(img_file[:-4], '%Y%m%d_%H%M%S')
                    img_seconds = img_time.hour * 3600 + img_time.minute * 60 + img_time.second
                    diff = abs(img_seconds - target_seconds)

                    if diff < closest_diff:
                        closest_diff = diff
                        closest_img = img_file
                except (ValueError, OSError):
                    continue

            if closest_img:
                file_path = folder_path / closest_img
                file_size = file_path.stat().st_size / (1024 * 1024)  # MB
                timestamp = datetime.strptime(closest_img[:-4], '%Y%m%d_%H%M%S')

                return {
                    'filename': closest_img,
                    'path': f"{target_date_str}/{closest_img}",
                    'timestamp': timestamp.isoformat(),
                    'size_mb': round(file_size, 2)
                }
            return None
        except Exception as e:
            print(f"Error finding closest image: {e}")
            return None

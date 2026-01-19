# Aquarium Timelapse - React Frontend

Modern React + TypeScript frontend for the Aquarium Timelapse system.

## 🚀 Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TanStack Query (React Query)** - Server state management
- **Axios** - HTTP client
- **Tailwind CSS** - Utility-first CSS
- **DaisyUI** - Component library

## 📦 Installation

```bash
# Install dependencies
npm install
```

## 🛠️ Development

```bash
# Start dev server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Development with Flask Backend

The Vite dev server is configured to proxy API requests to the Flask backend:

```
Frontend: http://localhost:3000  (Vite dev server)
Backend:  http://localhost:5000  (Flask API)
```

All `/api/*`, `/image/*`, `/latest.jpg`, and `/video_feed` requests are automatically proxied to the Flask backend.

## 🚢 Deployment to Raspberry Pi

### Option 1: Automated Deploy Script

```bash
# Configure (optional, defaults shown)
export PI_HOST="pi@otowatcher"
export PI_PATH="/home/saainithil97/projects/timelapse/static"

# Deploy
./deploy.sh
```

The script will:
1. Build the React app (`npm run build`)
2. Copy `dist/` contents to Pi via rsync
3. Restart the Flask service

### Option 2: Manual Deployment

```bash
# Build
npm run build

# Copy to Pi
scp -r dist/* pi@otowatcher:/home/saainithil97/projects/timelapse/static/

# Restart Flask
ssh pi@otowatcher "systemctl --user restart timelapse-viewer"
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts          # API client (axios)
│   ├── components/
│   │   └── Dock.tsx            # Bottom navigation
│   ├── hooks/                  # Custom React hooks (future)
│   ├── types/
│   │   └── index.ts            # TypeScript types
│   ├── views/
│   │   └── LatestView.tsx      # Latest image view
│   ├── App.tsx                 # Main app component
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles
├── public/                     # Static assets
├── index.html                  # HTML template
├── vite.config.ts              # Vite configuration
├── tailwind.config.js          # Tailwind configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies
└── deploy.sh                   # Deployment script
```

## 🎨 Adding New Views

1. Create view component in `src/views/`:
```tsx
// src/views/GalleryView.tsx
export default function GalleryView() {
  return <div>Gallery content</div>;
}
```

2. Update `App.tsx` to include the new view:
```tsx
import GalleryView from './views/GalleryView';

// In renderSection():
case 'gallery':
  return <GalleryView />;
```

3. View automatically gets access to the dock navigation!

## 🔌 API Client Usage

```tsx
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

function MyComponent() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: apiClient.getStats,
  });

  if (isLoading) return <div>Loading...</div>;

  return <div>{data.total_images} images</div>;
}
```

## 🎯 Current Status

### ✅ Implemented
- Project setup with Vite + TypeScript
- Tailwind CSS + DaisyUI configuration
- API client with TypeScript types
- React Query integration
- Bottom dock navigation
- Latest view with:
  - Stats display
  - Image viewer
  - Capture button
  - Auto-refresh
  - Download

### 🚧 To Be Implemented
- Live Stream view
- Gallery view
- Calendar view
- Compare view
- Settings view
- Services control view

## 🐛 Troubleshooting

### Port 3000 already in use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- --port 3001
```

### API requests failing
1. Make sure Flask backend is running on port 5000
2. Check Vite proxy configuration in `vite.config.ts`
3. Check browser console for CORS errors

### Build errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 📝 Environment Variables

Create `.env` file (optional):
```env
# API URL (defaults to http://localhost:5000 in dev, empty in prod)
VITE_API_URL=http://your-pi.local:5000
```

## 🔄 Migration from Flask Templates

To fully migrate from Flask templates to React:

1. **Keep both running** during development
   - React dev: `http://localhost:3000`
   - Flask app: `http://localhost:5000`

2. **Port views one by one**
   - Each view is independent
   - Test thoroughly before moving to next

3. **Deploy when ready**
   - Run `./deploy.sh`
   - Pi serves static React build from Flask

4. **Remove Flask templates** (optional)
   - Keep Flask as pure API
   - React handles all UI

## 📚 Resources

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [TanStack Query](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com/)
- [DaisyUI](https://daisyui.com/)

## 🤝 Contributing

1. Create a feature branch
2. Make changes
3. Test locally (`npm run dev`)
4. Build to verify (`npm run build`)
5. Deploy to Pi (`./deploy.sh`)
6. Create pull request

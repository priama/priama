import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppLayout } from './App'
import { ImageViewerRoot } from './ImageViewerRoot'
import { DevicePreviewWindow } from './components/DevicePreview/DevicePreviewWindow'
import { ErrorBoundary } from './components/UI/ErrorBoundary'
import { isDevicePreviewWindow, isImageViewerWindow } from './lib/hashParams'
import './index.css'

function Root(): React.JSX.Element {
  if (isDevicePreviewWindow()) return <DevicePreviewWindow />
  if (isImageViewerWindow()) return <ImageViewerRoot />
  return <AppLayout />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary region="Application" fallbackClassName="h-screen">
      <Root />
    </ErrorBoundary>
  </StrictMode>
)

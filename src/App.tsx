import React from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { ToastProvider } from './components/common/Toast';

export function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}

export default App;

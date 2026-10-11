import React from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { ToastProvider } from './components/common/Toast';
import { DataProvider } from './context/DataContext';

export function App() {
  return (
    <ToastProvider>
      <DataProvider>
        <RouterProvider router={router} />
      </DataProvider>
    </ToastProvider>
  );
}

export default App;

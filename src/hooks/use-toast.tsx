import { useState, useCallback } from 'react';

interface ToastData {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  
  const toast = useCallback((data: ToastData) => {
    console.log('[Toast]', data.title, data.description);
    setToasts(prev => [...prev, data]);
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 3000);
  }, []);
  
  return { toast, toasts };
};
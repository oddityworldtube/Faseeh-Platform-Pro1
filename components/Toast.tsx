import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { ToastNotification } from '../types';

interface ToastProps {
  notifications: ToastNotification[];
  removeToast: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ notifications, removeToast }) => {
  return (
    <div className="fixed bottom-4 left-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {notifications.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastNotification; onRemove: () => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />
  };

  const styles = {
    success: "bg-white border-green-100 shadow-green-100/50",
    error: "bg-white border-red-100 shadow-red-100/50",
    info: "bg-white border-blue-100 shadow-blue-100/50"
  };

  return (
    <div className={`pointer-events-auto flex items-center gap-3 p-4 rounded-xl border shadow-lg min-w-[300px] animate-in slide-in-from-left duration-300 ${styles[toast.type]}`}>
      {icons[toast.type]}
      <p className="flex-1 text-sm font-medium text-gray-700">{toast.message}</p>
      <button onClick={onRemove} className="text-gray-400 hover:text-gray-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Toast;
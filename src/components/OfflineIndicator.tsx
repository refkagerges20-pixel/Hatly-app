import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-16 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900 shadow-lg">
      <WifiOff className="h-4 w-4 shrink-0 text-amber-700" />
      <span>لا يوجد اتصال بالإنترنت حالياً — يتم عرض البيانات المحفوظة مؤقتاً.</span>
    </div>
  );
};

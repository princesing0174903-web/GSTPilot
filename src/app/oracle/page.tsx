'use client';

import { OracleChat } from '@/components/oracle/OracleChat';
import { Toaster } from 'sonner';

export default function OraclePage() {
  return (
    <div className="min-h-screen bg-[#070707]">
      <OracleChat />
      {/* Toast notifications for Oracle errors / upload status. Mounted here so
          the dark theme of Oracle is preserved without touching the global
          layout. */}
      <Toaster
        position="top-center"
        theme="dark"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: 'rgba(15, 15, 15, 0.95)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            color: '#fff',
          },
        }}
      />
    </div>
  );
}

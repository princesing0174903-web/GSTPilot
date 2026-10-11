'use client';

import React from 'react';
import PublicInfoPage from '@/components/landing/PublicInfoPage';
import { useRouter } from 'next/navigation';

export default function LegalPage() {
  const router = useRouter();

  return (
    <PublicInfoPage
      page="legal"
      onBack={() => router.push('/')}
      onGetStarted={() => {
        window.location.href = '/#login';
      }}
      onNavigatePage={(p) => {
        router.push(`/${p}`);
      }}
    />
  );
}

'use client';
import { useRouter } from 'next/navigation';
import { TwoFactorEnroll } from '@/components/TwoFactorEnroll';

export function SetupTwoFactorClient() {
  const router = useRouter();
  return <TwoFactorEnroll onDone={() => { router.replace('/dashboard'); router.refresh(); }} />;
}

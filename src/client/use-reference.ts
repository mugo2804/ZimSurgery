'use client';
import { useEffect, useState } from 'react';
import { cachedGet } from './offline/outbox';

export type Reference = {
  medicalAids: { id: string; name: string }[];
  doctors: { id: string; name: string; title: string | null }[];
};

const EMPTY: Reference = { medicalAids: [], doctors: [] };
let memo: Reference | null = null;

// Lookup lists (medical aids, doctors), cached for offline use
export function useReference(): Reference {
  const [ref, setRef] = useState<Reference>(memo ?? EMPTY);
  useEffect(() => {
    let alive = true;
    cachedGet<Reference>('/api/reference').then((r) => { memo = r.data; if (alive) setRef(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return ref;
}

export const doctorLabel = (d: { name: string; title: string | null } | undefined) => (d ? [d.title ?? 'Dr', d.name].join(' ') : 'Next available');

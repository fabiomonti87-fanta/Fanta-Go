'use client';

import dynamic from 'next/dynamic';

const FantacalcioManager = dynamic(
  () => import('../components/FantacalcioManager'),
  { ssr: false }
);

export default function Page() {
  return <FantacalcioManager />;
}

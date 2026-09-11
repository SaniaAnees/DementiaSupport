import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { metaRepo } from '@/src/db/repos';

export default function Index() {
  const [to, setTo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const seen = await metaRepo.get('disclaimer_seen');
      setTo(seen === '1' ? '/(caregiver)/home' : '/disclaimer');
    })();
  }, []);

  if (!to) return null;
  return <Redirect href={to as any} />;
}

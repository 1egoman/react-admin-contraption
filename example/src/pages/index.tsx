import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Web() {
  const router = useRouter();

  useEffect(() => {
    const newPath = '/admin';
    console.warn(`Note: redirecting to new url at ${newPath}`)
    router.replace(newPath);
  }, []);

  return (
    <div>Redirecting to /admin...</div>
  );
}

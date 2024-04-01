import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Web() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const baseUrl = params.get("baseurl") || "https://api.rapbattleapp.com";
    const battleId = params.get("battleid");

    const newPath = `/new/battles/${battleId}?baseurl=${baseUrl}`;
    console.warn(`Note: redirecting to new url at ${newPath}`)
    router.replace(newPath);
  }, []);

  return (
    <div>Redirecting...</div>
  );
}

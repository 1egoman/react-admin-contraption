import { useRouter } from 'next/router';

import AllDataModels from '@/datamodels';

import { BattleWithParticipants } from '@/types';
import { Detail } from '@/admin';

export default function Page() {
  const router = useRouter();
  const id = router.query.id ? `${router.query.id}` : null;
  if (!id) {
    return null;
  }

  return (
    <AllDataModels>
      <Detail<BattleWithParticipants>
        name="battle"
        itemKey={id === 'new' ? undefined : id}
      />
    </AllDataModels>
  );
}

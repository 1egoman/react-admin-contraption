import { useRouter } from 'next/router';

import AllDataModels, { BattleWithParticipants } from '@/datamodels/barz';
import { Detail, DetailFields } from '@/admin';

export default function Page() {
  const router = useRouter();
  const id = router.query.id ? `${router.query.id}` : null;
  if (!id) {
    return null;
  }

  return (
    <AllDataModels>
      <Detail<BattleWithParticipants>
        name="battleParticipant"
        itemKey={id === 'new' ? undefined : id}
      >
        <DetailFields />
      </Detail>
    </AllDataModels>
  );
}

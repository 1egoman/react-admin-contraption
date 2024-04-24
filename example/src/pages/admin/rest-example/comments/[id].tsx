import { useRouter } from 'next/router';

import AllDataModels, { Comment } from '@/datamodels/rest-example';
import { Detail } from '@/admin';

export default function Page() {
  const router = useRouter();
  const id = router.query.id ? `${router.query.id}` : null;
  if (!id) {
    return null;
  }

  return (
    <AllDataModels>
      <Detail<Comment>
        name="comment"
        itemKey={id === 'new' ? undefined : id}
      />
    </AllDataModels>
  );
}

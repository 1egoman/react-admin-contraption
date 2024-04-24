import { useRouter } from 'next/router';

import AllDataModels, { Post } from '@/datamodels/rest-example';

import { Detail } from '@/admin';

export default function Page() {
  const router = useRouter();
  const id = router.query.id ? `${router.query.id}` : null;
  if (!id) {
    return null;
  }

  return (
    <AllDataModels>
      <Detail<Post>
        name="post"
        itemKey={id === 'new' ? undefined : id}
      />
    </AllDataModels>
  );
}

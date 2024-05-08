import { useRouter } from 'next/router';

import AllDataModels, { User } from '@/datamodels/filteroff';

import { ListDetailRenderer } from '@/admin';

export default function Page() {
  const router = useRouter();
  const path = router.query.path ? router.query.path as Array<string> : null;
  if (!path) {
    return null;
  }

  return (
    <AllDataModels>
      <ListDetailRenderer
        basePath="/admin/filteroff"
        name={path[0]}
        view={path.length > 1 ? 'detail' : 'list'}
        itemKey={path[1] === 'new' ? undefined : path[1]}
      />
    </AllDataModels>
  );
}

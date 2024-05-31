# Next.js + TRPC + Prisma

### Client Setup
1. Make sure you've [installed the library](./initial.md) first!

2. Create a file to configure your data models - put this in `src/datamodels.tsx`:
```typescript
import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';

import {
  DataModels,
  AdminContextProvider,
  queryParameterStateCache,
  RemoteDataModels,
} from 'react-admin-contraption-unstable';
import {
  useGenerateRemoteDataModelsTRPCClient,
} from "react-admin-contraption-unstable/remote-data-model-adapters/protocols/trpc";

import { api } from "@/utils/api";

export default function AllDataModels({ children }: { children: React.ReactNode}) {
  // 1. Set up a "remote data model client" that communicates with the server over trpc.
  const { fetchRemoteDataModels } = useGenerateRemoteDataModelsTRPCClient(
    api,

    // NOTE: for older versions of trpc, this should be `api.useContext()`
    api.useUtils(),

    // NOTE: This is a path to the place the corresponding trpc router is mounted.
    // This default value matches with what will be configured later in this guide.
    // `api.foo.bar.baz.(mounted router)` would be represented as `['foo', 'bar', 'baz']`
    ['admin'],
  );

  return (
    <div style={{ padding: 8 }}>
      <AdminContextProvider stateCache={queryParameterStateCache} nextRouter={useRouter()}>
        {/* 2. Give the data models provider the way to get remote data models */}
        <DataModels fetchRemoteDataModels={fetchRemoteDataModels}>
          {/* 3. Include all remote data models in the admin interface */}
          <RemoteDataModels />

          {children}
        </DataModels>
      </AdminContextProvider>
    </div>
  );
}
```

3. Create a new directory `src/pages/admin` and put a file named `[...path].tsx` inside containing:
```typescript
import { useRouter } from 'next/router';
import { ListDetailRenderer } from 'react-admin-contraption-unstable';
import AllDataModels from '@/datamodels';

// If no other route matches, this component will render a default / "fallback" list or detail page
// To customize an individual list or detail page, define a custom implementation for it:
// - https://bread-1.gitbook.io/react-admin-contraption/pages/list
// - https://bread-1.gitbook.io/react-admin-contraption/pages/detail
export default function Page() {
  const router = useRouter();
  const path = router.query.path ? router.query.path as Array<string> : null;
  if (!path) {
    return null;
  }

  return (
    <AllDataModels>
      <div style={{ padding: 8 }}>
        <ListDetailRenderer
          basePath="/admin"
          name={path[0]}
          view={path.length > 1 ? 'detail' : 'list'}
          itemKey={path[1] === 'new' ? undefined : path[1]}
        />
      </div>
    </AllDataModels>
  );
}
```

4. Create a new file `index.tsx` inside `src/pages/admin` containing:
```typescript
import { Launcher } from "react-admin-contraption-unstable";
import AllDataModels from "@/datamodels";

export default function Page() {
  return (
    <AllDataModels>
      <Launcher />
    </AllDataModels>
  );
}
```

5. Wherever you add global css files, make sure to include `react-admin-contraption-unstable/styles.css`:
```typescript
import "@admin/styles.css";
// import "../../node_modules/react-admin-contraption-unstable/styles.css";
```

### Server Setup
4. Add the `admin` router into `server/api/root.ts`:
```typescript
import prisma from "@prisma/client";

import { generateRemoteDataModelsTRPCRouter } from "react-admin-contraption-unstable/remote-data-model-adapters/protocols/trpc";
import PrismaRemoteDataModelProvider from "react-admin-contraption-unstable/remote-data-model-adapters/datastores/prisma";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const appRouter = createTRPCRouter({
  /* NOTE: preexisting trpc routers go here! */

  // This custom router backs the admin interface and allows CRUD interactions
  // to be performed on all database tables.
  admin: createTRPCRouter(
    generateRemoteDataModelsTRPCRouter(
      // NOTE: this default value is not handling auth currently, which means any user can make
      // arbitrary changes to your database! THIS IS INSECURE! DO NOT DEPLOY THIS INTO PRODUCTION!
      publicProcedure,
      // To handle auth, do something like this:
      // publicProcedure.use(({ next, ctx }) => {
      //   // Check `ctx` here, and throw a `TRPCError` if the user shouldn't be given access.
      // }),

      // Connect over this interface to prisma!
      // Note that if you were using a different ORM tool, this is where you'd plug that in!
      PrismaRemoteDataModelProvider(prisma),
    ),
  ),
});

// export type definition of API
export type AppRouter = typeof appRouter;
```


### Try it out!
Start your app, and go to `/admin`. You should see the admin interface.

Clicking on a model should go to the list view for it, showing a column per model field.

Clicking on a row should go to the detail page, where the model can be viewed, updated, or deleted.

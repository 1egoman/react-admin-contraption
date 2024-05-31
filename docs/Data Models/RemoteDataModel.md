# RemoteDataModel

The simplest way to define a data model is by [defining it locally](./DataModel.md). However, this
isn't always desirable - sometimes, you want the admin view to be auto-generated, and you don't
really care that much about how it looks / what it contains, at least initially. If so, remote data
models may be a good option.

Remote data models allow a server to do two things:
1. Define a list of data models "definitions" that should be auto generated, including fields and
   field types
2. Define a channel for CRUDL actions to occur that "just works" for all dynamically generated
   models, and doesn't require a developer to implement these actions manually for each model.

However, because there is now server code in the picture, you'll also need the ability to modify
your server and it will need to use one of the supported stacks ([see here](./getting-started/initial.md#server-driven)).

If you only want part of the above, consider reading about [mixing remote and local data models](./Mixing Remote and Local.md)!

## Wrapper Component
<details>
<summary>Create `src/datamodels.tsx`, if you haven't already</summary>

Data Models are defined at the top level of the project, within a wrapper component. If you haven't
already, create a file called `src/datamodels.tsx` and put this inside (note this assumes next.js,
make the relevant changes if you are using a different tool):
```typescript
import { useRouter } from 'next/router';

import {
  DataModels,
  AdminContextProvider,
  queryParameterStateCache,
} from '@/admin';

export default function AllDataModels({ children }: { children: React.ReactNode}) {
  return (
    <div style={{ padding: 8 }}>
      <AdminContextProvider stateCache={queryParameterStateCache} nextRouter={useRouter()}>
        <DataModels>
          {/* Put all data models here! */}

          {children}
        </DataModels>
      </AdminContextProvider>
    </div>
  );
}
```

Now, anytime you implement an admin-related page, surround the admin specific components in
`<AllDataModels> {/* ... */} </AllDataModels`.

</summary>

## Code example
For a more through explanation, follow the [getting started guide](./getting-started/initial.md).

### Next.js + TRPC + Prisma

Client side - add this to your `src/datamodels.tsx` global wrapper component:
```typescript
import { api } from "@/utils/api";

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

<AdminContextProvider stateCache={queryParameterStateCache} nextRouter={useRouter()}>
  {/* 2. Give the data models provider the way to get remote data models */}
  <DataModels fetchRemoteDataModels={fetchRemoteDataModels}>
    {/* 3. Include all remote data models in the admin interface */}
    <RemoteDataModels />

    {children}
  </DataModels>
</AdminContextProvider>
```

Server side - add this to your main trpc router:
```typescript
import prisma from "@prisma/client";

import { generateRemoteDataModelsTRPCRouter } from "@/admin/remote-data-model-adapters/protocols/trpc";
import PrismaRemoteDataModelProvider from "@/admin/remote-data-model-adapters/datastores/prisma";

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

## Generic React App / Express / Prisma

Client side - add this to your `src/datamodels.tsx` global wrapper component:
```typescript
import { api } from "@/utils/api";
import { useGenerateRemoteDataModelsRestEndpoints } from 'admin/remote-data-model-adapters/protocols/rest';

// 1. Set up a "remote data model client" that communicates with the server over trpc.
const { fetchRemoteDataModels } = useGenerateRemoteDataModelsRestEndpoints(
  // REST API base url:
  "http://path-to-my-server.com:8000/api/v1/admin",

  // If you'd like to inject custom headers / modify the request before it gets sent, you can
  // override the `fetch` function this uses here:
  // (url: string, options?: RequestInit) => fetch(url, {...options, headers: {...options.headers, 'Authorization': 'Bearer mytoken'}})

  // General options:
  // {
  //   // Defaults to true - if false, skips fetching a list of datamodel definitions
  //   // This allows you to use this client with a generic rest api
  //   fetchDefinitions: true,
  //
  //   // Defaults to 'PATCH' - allows one to customize the method that gets used when making
  //   // a request to update a data model, so that you can use this client with a pre-existing
  //   // generic rest api.
  //   updateRequestMethod: 'PATCH'
  // }
);

<AdminContextProvider stateCache={queryParameterStateCache} nextRouter={useRouter()}>
  {/* 2. Give the data models provider the way to get remote data models */}
  <DataModels fetchRemoteDataModels={fetchRemoteDataModels}>
    {/* 3. Include all remote data models in the admin interface */}
    <RemoteDataModels />

    {children}
  </DataModels>
</AdminContextProvider>
```

Server side - add this to your express routes:
```typescript
import express from 'express';
import prisma from '@prisma/client';

import { generateRemoteDataModelsRestEndpoints } from 'admin/remote-data-model-adapters/protocols/rest';
import PrismaRemoteDataModelProvider from 'admin/remote-data-model-adapters/datastores/prisma';

const app = express();

// ...

// This custom middleware backs the admin interface and allows CRUD interactions
// to be performed on all database tables.
app.use(
  '/api/v1/admin',
  generateRemoteDataModelsRestEndpoints(PrismaRemoteDataModelProvider(prisma)),
);

// ...

app.listen(8000);
```

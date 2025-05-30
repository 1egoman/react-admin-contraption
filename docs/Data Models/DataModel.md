# Locally defined `DataModel`s

Data Models are how you tell the tool how a certain type of data should be represented. The simplest
way to define data models is by literally defining them in the code (as opposed to [getting their
definition from a remote server](./RemoteDataModel.md)).


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
} from 'react-admin-contraption-unstable';

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

## Example
```typescript
import { DataModel, PrimaryKeyField } from 'react-admin-contraption-unstable';

// Example type data to give an idea of this demo schema:
export type Vehicle = {
  id: string,
  name: string,
  hasBrakes: boolean,
  type: 'car' | 'truck',
  numberOfWheels: number | null,
  metadata: any, /* some sort of json... */
  driverId: Person['id'],
};

// Then, in the `AllDataModels` wrapper component:
<DataModel<Vehicle>
  // "name" can be any string you want and will act as an identifier used in other places
  // to refer to this data model.
  name="vehicle"

  // Define english-language ways of rendering this model's name.
  // These could / maybe should be autogenerated in the future.
  singularDisplayName="Vehicle"
  pluralDisplayName="Vehicles"

  // Tell the data model how to perform CRUDL actions against a server
  fetchPageOfData={/* see below for an implementation of this */ }
  fetchItem={/* see below for an implementation of this */ }
  // createItem (optional)
  // updateItem (optional)
  // deleteItem (optional)

  // This function should return a unique value for every data model entry for react keying
  // purposes.
  keyGenerator={vehicle => vehicle.id}

  // Define how to navigate to the list, detail, and creation pages for this data model
  //
  // Note that these aren't required, but if you don't specify the applicable ones (ie, if you can't
  // create a data model in the admin, don't specify that one), then users won't be able to navigate
  // between the relevant pages.
  listLink={{ type: 'next-link' as const, href: `/admin/vehicles` }}
  detailLinkGenerator={vehicle => ({ type: 'next-link' as const, href: `/admin/vehicles/${vehicle.id}` })}
  createLink={{ type: 'next-link', href: `/admin/vehicles/new` }}
>
  {/*
  Fields go in here!
  For more info, see https://bread-1.gitbook.io/react-admin-contraption/data-models/fields
  */}

  <PrimaryKeyField
    name="id"
    singularDisplayName="Id"
    pluralDisplayName="Ids"
    sortable
  />
</DataModel>
```

#### `fetchPageOfData` / `fetchItem` / etc
These functions must be implemented for each data model and tell it how it can get data from a
server somewhere. Each is a very generic interface that can be implemented no matter the underlying
technology the project uses.

If you'd like to have these be automatically generated for you, read more about [remote data models](./RemoteDataModel.md).

```typescript
const fetchPageOfData = useCallback(async (
  page: number,
  filters: Array<[Array<string>, any]>,
  sort: Sort | null,
  searchText: string,
  // NOTE: optionally, this `AbortSignal` can be passed into whatever request making mechanism you
  // are using to auto cancel old requests when a user changes things while the app is loading.
  signal: AbortSignal
) => {
  const qs = new URLSearchParams();

  if (filters || searchText.length > 0) {
    for (const [[name, ..._rest], value] of filters) {
      qs.set(name, value);
    }
  }
  if (searchText.length > 0) {
    qs.set('title', searchText);
  }

  const response = await fetch(`http://localhost:3003/vehicles?${qs.toString()}`, { signal });
  if (!response.ok) {
    throw new Error(`Error fetching vehicles: received ${response.status} ${await response.text()}`)
  }

  const body = await response.json();

  return {
    // This api endpoint isn't paginated, but in the real world, you probably would want it to be
    // (which would mean setting `nextPageAvailable` / `totalCount` accordingly)
    nextPageAvailable: false,
    totalCount: body.length,
    data: body,
  };
}, []);

const fetchItem = useCallback(async (itemKey: string, signal: AbortSignal) => {
  const response = await fetch(`http://localhost:3003/vehicles/${itemKey}`, { signal });
  if (!response.ok) {
    throw new Error(`Error fetching vehicle with id ${itemKey}: received ${response.status} ${await response.text()}`)
  }

  return response.json();
}, []);

// createItem, updateItem, and deleteItem are similar, but handle their respective CRUD actions
// Look at the code / typescript types if you want to understand the exact parameters here, but
// they are relatively straightforward
```

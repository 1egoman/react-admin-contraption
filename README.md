# Admin Contraption Thing
A tool that allows one to create django admin / active admin like interfaces in react.

https://github.com/1egoman/react-admin-contraption/assets/1704236/d127b193-5c19-44ab-803b-68a5e71afb9f

# Getting started
There is a next.js app in `example`. Run `npm install && npm run dev`, then go to the root web page
it serves for some example admin implementations.

Note that you may need to also start a fake backend server locally - `cd jsonserver && npx json-server -p 3003 db.json` should do that.

# Example
The core code currently lives in `admin/` (a symlink to `example/src/admin`). Right now, copy this
code into a project's `src` directory (TBD process for now, some sort of package distribution
mechanism needs to be thought through here) to add this to a project.

### Data Models
The most important concept in this project is a "data model" - this is how you tell the tool how
data should be represented.

<img src="./readme-assets/Screenshot 2024-04-24 at 11.36.22 AM.png" />

## Code example
```typescript
// Example type data to give an idea of this demo schema:
type Person = { id: string, /* ... */ };
export type Vehicle = {
  id: string,
  name: string,
  hasBrakes: boolean,
  type: 'car' | 'truck',
  numberOfWheels: number | null,
  metadata: any, /* some sort of json... */
  driverId: Person['id'],
};

// Then, in a component somewhere:
<DataModel<Vehicle>
  name="vehicle"
  singularDisplayName="vehicle"
  pluralDisplayName="vehicles"

  fetchPageOfData={/* see below for an implementation of this */ }
  fetchItem={/* see below for an implementation of this */ }
  // createItem
  // updateItem
  // deleteItem

  keyGenerator={vehicle => post.id}
  detailLinkGenerator={post => ({ type: 'href' as const, href: `/admin/vehicles/${vehicle.id}` })}
  listLink={{ type: 'href' as const, href: `/admin/vehicles` }}
  createLink={{ type: 'href', href: `/admin/vehicles/new` }}
>
  {/* A field tells the tool how to render an subattribute of the data model */}
  {/* Note that this is a raw field implementation, there are more abstract fields */}
  {/* that in practice you'd use most of the time. */}
  <Field<Vehicle, 'id', string>
    name="id"
    singularDisplayName="Id"
    pluralDisplayName="Ids"
    csvExportColumnName="id"
    columnWidth={100}

    // Each field has a backing state data structure. For this field, it's `string` (third generic)
    // The below props control mapping back and forth between the raw item (`vehicle`) and the state (`state`)
    // This field is read only though, so it's not that interesting.
    getInitialStateFromItem={vehicle => vehicle.id}
    injectAsyncDataIntoInitialStateOnDetailPage={async state => state}
    serializeStateToItem={(state, _vehicle) => state}

    sortable // When set, this field can be clicked on to sort in list views

    // This prop (along with `modifyMarkup`) control how a field presents itself in different
    // contexts. `displayMarkup` is rendered in read only contexts (ie, list views) and
    // `modifyMarkup` is shown in read/write contexts. Note that `modifyMarkup` also has the ability
    // to update the field state (its render prop function signature has more parameters)
    displayMarkup={state => <span>{state}</span>}

    // There are other lifecycle methods one can tap into as well - the goal here is to provide as
    // many extension points as possible to allow this tool to scale better than a django admin /
    // active admin kind of thing.
  />

  {/* A few more simple abstract fields: */}
  <BooleanField<Post, 'hasBrakes'>
    name="hasBrakes"
    singularDisplayName="Has Brakes"
    pluralDisplayName="Has Brakes"
    // ^- Sometimes the plural and singular names are the same...  just do whatever makes gramatical sense in the interface :)
  />
  <ChoiceField<Post, 'type'>
    name="type"
    singularDisplayName="Car Type"
    pluralDisplayName="Car Types"

    getInitialStateWhenCreating={() => 'unset'}
    // ^- What is the default value when in the creation form?

    choices={[
      {id: 'Unset', disabled: true, label: 'Unset'},
      {id: 'car', label: 'Car'},
      {id: 'truck', label: 'Truck'},
    ]}
  />
  <NumberField<Post, 'numberOfWheels', true>
    name="numberOfWheels"
    singularDisplayName="Number of Wheels"
    pluralDisplayName="Number of Wheels"

    // Most of the abstract fields can be made nullable, and when enabled (plus the last generic
    // parameter being set to true), the control will show radio buttons allowing one to pick "null"
    // instead of typing a value
    nullable

    getInitialStateWhenCreating={() => null}
  />
  <JSONField<Post, 'metadata'>
    name="metadata"
    singularDisplayName="Metadata"
    pluralDisplayName="Metadata"
    getInitialStateWhenCreating={() => ({})}
  />

  {/* This tool also supports foreign keys by using SingleForeignKeyField / MultiForeignKeyField: */}
  <SingleForeignKeyField<Post, 'driverId', Person>
    name="driverId"
    singularDisplayName="Driver"
    pluralDisplayName="Drivers"

    // The "name" of another data model that represents the other side of the relation
    relatedName="person"

    // There's a lot of different ways that data can be represented in api responses - to try to
    // give as much flexibility as possible, this field can either accept just an id of the related
    // model ("KEY_ONLY") or a full on embedded object ("FULL"). If `KEY_ONLY` is set, then the
    // field will automatically look up the related item using its associated `fetchItem` function.
    getInitialStateFromItem={vehicle => ({ type: 'KEY_ONLY' as const, key: vehicle.driverId })}

    // There are quite a few lifecycle props one can use to tap into how this field works - the
    // above are the only required ones though.
  />
  {/*
  // The MultiForeignKeyField is very similar - the only difference is `getInitialStateFromItem`
  // returns an array of ids or an array of embedded objects:
  <MultiForeignKeyField<Post, 'passengerIds', Person>
    name="passengerIds"
    singularDisplayName="Passenger"
    pluralDisplayName="Passengers"

    relatedName="person"
    getInitialStateFromItem={vehicle => ({ type: "KEY_ONLY", key: post.passengerIds })}
  />
</DataModel>
```

#### `fetchPageOfData` / `fetchItem` / etc
These functions must be implemented for each data model and tell it how it can get data from a
server somewhere. Each is a very generic interface that can be implemented no matter the underlying
technology the project uses - as of april 2023, I've experimented with REST and TRPC, but any data
async source should work fine.

I wouldn't be surprised if a set of standardized specific components that use trpc/react server
actions/etc were developed that would be largely drop in to standardize the api interface.  But,
that is for the future!

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

#### Including data models in other pages
Data models must be placed in a `<DataModels>...</DataModels>` component. Here's what I've done to
date:
```typescript
export default function CustomWrapperComponentToBringInDataModels({ children  }) {
  return (
    // Must wrap all the admin stuff - allows configuration of global parameters
    <AdminContextProvider>
      <DataModels>
        {/* Add data model definitions here */}

        {children}
      </DataModels>
    </AdminContextProvider>
  );
}
```

Then, wrap all subsequent pages in this component.

In a next.js app, there's probably a more elegant way to do this. If so, do that instead.

#### Remote Data Models
It's likely you won't want to write out custom `<DataModel />` definitions for all data models in
the app. Instead, you can let the server drive data models by taking advantage of "remote data
models". Here is an example:

```typescript
// This function would make a request to the server and get `definitions`, plus then inject all
// this extra context about how one could query the server to get information about the given datamodels
const fetchRemoteDataModels = useCallback(async (): Promise<RemoteDataModelDefinition> => {
  return {
    fetchPageOfData: (dataModelName) => {
      // A mock implementation of `fetchPageOfData` for `dataModelName`
      // This should actually call out to some dynamic query endpoint thing that can service this
      // request, do the filters / search / sort, etc
      return async (page, filters, /* ... */) => ({
        nextPageAvailable: false,
        totalCount: 0,
        data: [{id: 1, textcolumn: 'foo', foreign: '1'}],
      });
    },
    fetchItem: (dataModelName) => {
      // A mock implementation of `fetchItem` for `dataModelName`
      // This should actually call out to some dynamic query endpoint thing that can service this
      // request, do the filters / search / sort, etc
      return async (key) => ({ id: key, textcolumn: 'foo', foreign: '1' });
    },
    // Similar to the above, these can also be optionally defined here:
    // createItem
    // updateItem
    // deleteItem

    listLink: (dataModelName) => ({ type: 'next-link', href: `/admin/filteroff/${dataModelName}` }),
    detailLinkGenerator: (dataModelName, key) => ({ type: 'next-link', href: `/admin/filteroff/${dataModelName}/${key}` }),
    createLink: dataModelName => ({ type: 'next-link', href: `/admin/filteroff/${dataModelName}/new` }),

    // Somehow generate this from the prisma schema file serverside...
    definitions: {
      dynamicmodel: {
        singularDisplayName: "dynamic model",
        pluralDisplayName: "dynamic models",
        columns: {
          id: { type: 'primaryKey', singularDisplayName: "id", pluralDisplayName: "ids", nullable: false },
          textcolumn: { type: "text", singularDisplayName: "id", pluralDisplayName: "ids", nullable: false},
          foreign: { type: "singleForeignKey", to: "user", singularDisplayName: "id", pluralDisplayName: "ids", nullable: false },
        },
      },
      dynamicmodel2: {
        singularDisplayName: "dynamic model",
        pluralDisplayName: "dynamic models",
        columns: {
          id: { type: 'primaryKey', singularDisplayName: "id", pluralDisplayName: "ids", nullable: false },
          textcolumn: { type: "text", singularDisplayName: "id", pluralDisplayName: "ids", nullable: false},
        },
      },
    },
  };
}, []);

// Then, later on, in something like that `CustomWrapperComponentToBringInDataModels` component I mentioned above:
<AdminContextProvider>
  <DataModels fetchRemoteDataModels={fetchRemoteDataModels}> {/* <-- fetchRemoteDataModels is passed in here */}

    {/* Finally, a new built in component: This will render custom server generated data models: */}
    <RemoteDataModels />
    {/* You could also do this, to exclude certain server generated ones so you can implement your own: */}
    {/* <RemoteDataModels exclude={["dynamicmodel2"]} /> */}
    {/* Or the allowlist version */}
    {/* <RemoteDataModels include={["dynamicmodel"]} /> */}

    {/* Or, it's also possible to define a data model, but rely on fields from the server: */}
    <DataModel
      // ... props here, see above for what these would be ...
    >
      {/* Include all fields associated with `dynamicmodel`: */}
      <RemoteFields name="dynamicmodel" />

      {/* Include all but a single field associated with `dynamicmodel`: */}
      {/* <RemoteFields name="dynamicmodel" excludes={["foreign"]} /> */}

      {/* Include a single field associated with `dynamicmodel`: */}
      {/* <RemoteFields name="dynamicmodel" includes={["textcolumn"]} /> */}
    </DataModel>

    {/* Data model that is a fully custom implementation - this component is custom and */}
    {/* renders a <DataModel></DataModel> inside: */}
    <UserDataModel />

    {children}
  </DataModels>
</AdminContextProvider>
```

## List Page
The list page shows a read only list of all datamodels that are fetched from a server and allows a user to
filter, sort, and perform actions on them.

<img src="./readme-assets/Screenshot 2024-04-24 at 11.08.46 AM.png" />

<div align="center">
  <img width="30%" src="./readme-assets/Screenshot 2024-04-24 at 11.10.34 AM.png">
  <img width="30%" src="./readme-assets/Screenshot 2024-04-24 at 11.10.12 AM.png">
  <img width="30%" src="./readme-assets/Screenshot 2024-04-24 at 11.11.01 AM.png">
</div>

### Code example
If in a next.js app, create a `src/pages/admin/vehicles/index.tsx` file, and return something like
the below from a component defined as that file's default export:
```typescript
<CustomWrapperComponentToBringInDataModels>
  <List<Vehicle>
    name="vehicle" // Points to a data model, see the earlier section
    checkable
  >
    <ListFilterBar searchable>
      {/* Filter definitions handle rendering filters. `StringFilterDefinition` is a more abstract */}
      {/* filter but fully customizable filter rendering is possible by using the more abstract */}
      {/* `FilterDefinition` implementation. */}

      {/* Simple one parameter filter: */}
      <StringFilterDefinition name={["id"]} />

      {/* `name` can be used to define an arbitrary filter path, allowing for some very nuanced and */}
      {/* complicated filtering behavior not available in many tools. Some examples: */}
      <StringFilterDefinition name={["name", "equals"]} />
      <StringFilterDefinition name={["name", "contains"]} />
      <StringFilterDefinition name={["numberOfWheels", "less than"]} />
      <StringFilterDefinition name={["numberOfWheels", "greater than"]} />

      {/* Here is an example of a more abstract filter to give an idea of the kind of stuff that */}
      {/* is pretty easily possible: */}
      <FilterDefinition<[string, string]>
        name={["numberOfWheels", "is in range"]}
        getInitialState={() => ['', '']}

        // If a filter is not yet valid, it will be highlighted as invalid (often like a red border
        // on an input box or something like that). See this component's `children` for an example.
        onIsValid={([start, end]) => !isNaN(parseInt(start)) && !isNaN(parseInt(end))}

        // If a filter is valid, then it may also be complete. A complete filter is included in the
        // request to get a list of data to show in the list view.
        //
        // In _most_ cases, this function is the same as `onIsValid`.
        onIsComplete={([start, end]) => !isNaN(parseInt(start)) && !isNaN(parseInt(end))}

        // Serializing and deserializing the filter allows it to be represented in the query string
        serialize={state => JSON.stringify(state)}
        deserialize={raw => JSON.parse(raw)}
      >
        {(state, setState, filter, onBlur) => (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Start"
              value={start}
              onChange={e => setState([e.currentTarget.value, state[1]])}
              onBlur={onBlur}
              style={{ border: !filter.isValid ? '1px solid red' : undefined }}
            />
            <input
              type="text"
              placeholder="End"
              value={end}
              onChange={e => setState([state[0], e.currentTarget.value])}
              onBlur={onBlur}
              style={{ border: !filter.isValid ? '1px solid red' : undefined }}
            />
          </div>
        )}
      </FilterDefinition>
      
      {/* In a real app, you'd probably auto generate filter definitions somehow and then maybe */}
      {/* add a few custom app specific ones. This is also something that some bread specific */}
      {/* api integration stuff on top could help facilutate long term. */}
    </ListFilterBar>
    <ListActionBar<User>>
      {checkedItems => (
        <Fragment>
          {/* Expose bulk actions that a user can select when a set of items are checked */}
          <button
            onClick={() => alert(checkedItems.map(i => i.id).join(','))}
          >Export</button>
        </Fragment>
      )}
    </ListActionBar>

    {/* Because this is react, you can just put whatever you want intermixed with these */}
    {/* admin-related components and it will render like you expect: */}
    <div>My cool markup</div>

    <ListTable />
  </List>
<CustomWrapperComponentToBringInDataModels>
```

## Detail Page
The detail page shows a writable version of a given datamodel allowing one to create and update
instances on ones data.

<img src="./readme-assets/Screenshot 2024-04-24 at 11.11.56 AM.png" />

<div align="center">
  <img width="45%" src="./readme-assets/Screenshot 2024-04-24 at 11.12.04 AM.png">
  <img width="45%" src="./readme-assets/Screenshot 2024-04-24 at 11.11.42 AM.png">
</div>

### Code example
If in a next.js app, create a `src/pages/admin/vehicles/[id].tsx` file, and return something like
the below from a component defined as that file's default export:
```typescript
<CustomWrapperComponentToBringInDataModels>
  <Detail<Vehicle>
    name="vehicle" // Points to a data model, see the earlier shction
    itemKey={id === 'new' ? undefined : id} // `id` should be the id from the url. If unset, this renders a creation form.
    title={vehicle => vehicle.name}
    actions={vehicle => (
      // Single-control specific actions can be put here.
      <Fragment>
        <button onClick={() => alert(`Click ${vehicle.id}!`)}>Blink headlights</button>
      </Fragment>
    )}
  >
    <DetailFields />
  </Detail>
</CustomWrapperComponentToBringInDataModels>
}
```

## Autorendering List / Detail Pages
It's likely that if you are taking advantage of remote data models, you wouldn't want to have to
scaffold out a list and detail page for each remote data model, given there is no way to know for
sure which models the server will return.

Luckily, there is a "fallback" available - create a file like `src/pages/admin/[...path].tsx` and
put this inside:
```typescript
import { useRouter } from 'next/router';
import { ListDetailRenderer } from '@/admin';
import CustomWrapperComponentToBringInDataModels from '...';

export default function Page() {
  const router = useRouter();
  const path = router.query.path ? router.query.path as Array<string> : null;
  if (!path) {
    return null;
  }

  return (
    <CustomWrapperComponentToBringInDataModels>

      {/* This component will render fallback default versions of list and detail pages */}
      {/* for any models which don't have a pre-existing set of pages defined. */}
      <ListDetailRenderer
        basePath="/admin"
        name={path[0]}
        view={path.length > 1 ? 'detail' : 'list'}
        itemKey={path[1] === 'new' ? undefined : path[1]}
      />
      {/* ^ Note that as of early may 2024, this component doesn't generate filters properly */}

    </CustomWrapperComponentToBringInDataModels>
  );
}
```

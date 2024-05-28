# Mixing Remote and Local Data Models

As you further develop your admin interface, you may want some of the benefits of
[remote data models](./RemoteDataModels.md), but also want some of the customizability of local
[data models](./DataModels.md). Luckily, this isn't an either/or proposition, and there's a few
steps of abstraction you can take to slowly move from one extreme to the other.

Also keep in mind that it is possible to customize the individual [List](./pages/List.md) and
[Detail](./pages/Detail.md) pages, and that may prove to be a better solution depending on your
aims.

## Step 1: Remote Data Model
See [here](./RemoteDataModels.md) for more details.

```typescript
// In `src/datamodels.tsx`:
const { fetchRemoteDataModels } = useGenerateRemoteDataModelsTRPCClient(/* ... */);

<AdminContextProvider>
  <DataModels fetchRemoteDataModels={fetchRemoteDataModels}>
    <RemoteDataModels />

    {children}
  </DataModels>
</AdminContextProvider>
```

## Step 2: Remote Data Model, but with the ability to customize `DataModel` props
```typescript
// In `src/datamodels.tsx`:
const { getPropsForRemoteDataModel } = useGenerateRemoteDataModelsTRPCClient(/* ... */);

<AdminContextProvider>
  <DataModels fetchRemoteDataModels={fetchRemoteDataModels}>
    {/* 1. Remove the "vehicle" remote data model from the auto generated list */}
    <RemoteDataModels exclude={["Vehicle"]} />

    {/* 2. Manually generate the data model */}
    <DataModel<Vehicle>
      name="Vehicle" // NOTE that this must be the same as the name the remote data model had!
      singularDisplayName="Vehicle"
      pluralDisplayName="Vehicles"

      {/* 3. Auto generated the props that do the data fetching - include create/update/delete */}
      {...getPropsForRemoteDataModel('Vehicle', ['createItem', 'updateItem', 'deleteItem'])}

      keyGenerator={vehicle => vehicle.id}
      detailLinkGenerator={vehicle => ({ type: 'href' as const, href: `/admin/vehicles/${vehicle.id}` })}
      listLink={{ type: 'href' as const, href: `/admin/vehicles` }}
      createLink={{ type: 'href', href: `/admin/vehicles/new` }}
    >
      {/* 4. Use all the existing remote field definitions */}
      <RemoteFields name="Vehicle" />
    </DataModel>

    {children}
  </DataModels>
</AdminContextProvider>
```

## Step 3: Remote Data Model, but with custom `DataModel` supporting overridden custom fields
```typescript
// In `src/datamodels.tsx`:
const { getPropsForRemoteDataModel } = useGenerateRemoteDataModelsTRPCClient(/* ... */);

<AdminContextProvider>
  <DataModels fetchRemoteDataModels={fetchRemoteDataModels}>
    {/* 1. Remove the "vehicle" remote data model from the auto generated list */}
    <RemoteDataModels exclude={["Vehicle"]} />

    {/* 2. Manually generate the data model */}
    <DataModel<Vehicle>
      name="Vehicle" // NOTE that this must be the same as the name the remote data model had!
      singularDisplayName="Vehicle"
      pluralDisplayName="Vehicles"

      {/* 3. Auto generated the props that do the data fetching - include create/update/delete */}
      {...getPropsForRemoteDataModel('Vehicle', ['createItem', 'updateItem', 'deleteItem'])}

      keyGenerator={vehicle => vehicle.id}
      detailLinkGenerator={vehicle => ({ type: 'href' as const, href: `/admin/vehicles/${vehicle.id}` })}
      listLink={{ type: 'href' as const, href: `/admin/vehicles` }}
      createLink={{ type: 'href', href: `/admin/vehicles/new` }}
    >
      {/* 4. Use all the existing remote field definitions, EXCEPT for one: */}
      <RemoteFields
        name="Vehicle"
        exclude={["metadata"]}
      />

      {/* 5. Define the custom field: */}
      <JSONField<Vehicle, 'metadata'>
        name="metadata"
        singularDisplayName="Metadata"
        pluralDisplayName="Metadata"
        getInitialStateWhenCreating={() => ({ my_default: 'metadata here' })}
      />

      {/* Note that to get the fields in the right order, you may need to put a RemoteFields before
      the field you are adding including the fields before the field you want, and then a
      RemoteFields after including the fields you want after */}
    </DataModel>

    {children}
  </DataModels>
</AdminContextProvider>
```

## Step 4: Remote Data Model, but with fully custom `DataModel` fields:
The only thing that makes this data model "remote" is that it still relys on the server for data
fetching.

```typescript
// In `src/datamodels.tsx`:
const { getPropsForRemoteDataModel } = useGenerateRemoteDataModelsTRPCClient(/* ... */);

<AdminContextProvider>
  <DataModels fetchRemoteDataModels={fetchRemoteDataModels}>
    {/* 1. Remove the "vehicle" remote data model from the auto generated list */}
    <RemoteDataModels exclude={["Vehicle"]} />

    {/* 2. Manually generate the data model */}
    <DataModel<Vehicle>
      name="Vehicle" // NOTE that this must be the same as the name the remote data model had!
      singularDisplayName="Vehicle"
      pluralDisplayName="Vehicles"

      {/* 3. Auto generated the props that do the data fetching - include create/update/delete */}
      {...getPropsForRemoteDataModel('Vehicle', ['createItem', 'updateItem', 'deleteItem'])}

      keyGenerator={vehicle => vehicle.id}
      detailLinkGenerator={vehicle => ({ type: 'href' as const, href: `/admin/vehicles/${vehicle.id}` })}
      listLink={{ type: 'href' as const, href: `/admin/vehicles` }}
      createLink={{ type: 'href', href: `/admin/vehicles/new` }}
    >
      {/* 5. Define all custom fields - note that there is no RemoteFields component below! */}
      <PrimaryKeyField<Vehicle, 'id'>
        name="id"
        singularDisplayName="Id"
        pluralDisplayName="Ids"
        sortable
      />

      <BooleanField<Vehicle, 'hasBrakes'>
        name="hasBrakes"
        singularDisplayName="Has Brakes"
        pluralDisplayName="Has Brakes"
      />

      <ChoiceField<Vehicle, 'type'>
        name="type"
        singularDisplayName="Car Type"
        pluralDisplayName="Car Types"

        getInitialStateWhenCreating={() => 'unset'}

        choices={[
          {id: 'Unset', disabled: true, label: 'Unset'},
          {id: 'car', label: 'Car'},
          {id: 'truck', label: 'Truck'},
        ]}
      />

      <NumberField<Vehicle, 'numberOfWheels', true>
        name="numberOfWheels"
        singularDisplayName="Number of Wheels"
        pluralDisplayName="Number of Wheels"
        nullable
        getInitialStateWhenCreating={() => null}
      />

      <JSONField<Vehicle, 'metadata'>
        name="metadata"
        singularDisplayName="Metadata"
        pluralDisplayName="Metadata"
        getInitialStateWhenCreating={() => ({ my_default: 'metadata here' })}
      />
    </DataModel>

    {children}
  </DataModels>
</AdminContextProvider>
```

## Step 5: Local Data Model
```typescript
// In `src/datamodels.tsx`:
<AdminContextProvider>
  <DataModels fetchRemoteDataModels={fetchRemoteDataModels}>
    {/* 1. Remove the "vehicle" remote data model from the auto generated list */}
    <RemoteDataModels exclude={["Vehicle"]} />

    {/* 2. Manually generate the data model */}
    <DataModel<Vehicle>
      name="Vehicle" // NOTE that this must be the same as the name the remote data model had!
      singularDisplayName="Vehicle"
      pluralDisplayName="Vehicles"

      {/* 3. Define fully custom data fetching */}
      {/* More info: https://bread-1.gitbook.io/react-admin-contraption/data-models/datamodel */}
      fetchPageOfData={/* ... */ }
      fetchItem={/* ... */ }
      // createItem
      // updateItem
      // deleteItem

      keyGenerator={vehicle => vehicle.id}
      detailLinkGenerator={vehicle => ({ type: 'href' as const, href: `/admin/vehicles/${vehicle.id}` })}
      listLink={{ type: 'href' as const, href: `/admin/vehicles` }}
      createLink={{ type: 'href', href: `/admin/vehicles/new` }}
    >
      <PrimaryKeyField<Vehicle, 'id'>
        name="id"
        singularDisplayName="Id"
        pluralDisplayName="Ids"
        sortable
      />

      <BooleanField<Vehicle, 'hasBrakes'>
        name="hasBrakes"
        singularDisplayName="Has Brakes"
        pluralDisplayName="Has Brakes"
      />

      <ChoiceField<Vehicle, 'type'>
        name="type"
        singularDisplayName="Car Type"
        pluralDisplayName="Car Types"

        getInitialStateWhenCreating={() => 'unset'}

        choices={[
          {id: 'Unset', disabled: true, label: 'Unset'},
          {id: 'car', label: 'Car'},
          {id: 'truck', label: 'Truck'},
        ]}
      />

      <NumberField<Vehicle, 'numberOfWheels', true>
        name="numberOfWheels"
        singularDisplayName="Number of Wheels"
        pluralDisplayName="Number of Wheels"
        nullable
        getInitialStateWhenCreating={() => null}
      />

      <JSONField<Vehicle, 'metadata'>
        name="metadata"
        singularDisplayName="Metadata"
        pluralDisplayName="Metadata"
        getInitialStateWhenCreating={() => ({ my_default: 'metadata here' })}
      />
    </DataModel>

    {children}
  </DataModels>
</AdminContextProvider>
```

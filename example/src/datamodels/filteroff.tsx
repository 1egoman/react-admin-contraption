import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';

import {
  Field,
  InputField,
  BooleanField,
  NumberField,
  DataModels,
  DataModel,
  SingleForeignKeyField,
  MultiForeignKeyField,
  AdminContextProvider,
  StateCache,
  ChoiceField,
  ForeignKeyFullItem,
} from '@/admin';
import JSONField from '@/admin/fields/JSONField';
import { Filter, Sort } from '@/admin/types';
import { RemoteDataModelDefinition, RemoteDataModels } from '@/admin/datamodel';
import PrimaryKeyField from '@/admin/fields/PrimaryKeyField';


export type User = {
  id: string;
  provider: string;
  uid: number;
  name: string;
  email: string;
  profile_picture_url: string;
  gender: string;
  show_me: string;
  age: number;
  radius: number;
  age_min: number;
  age_max: number;
  bio: string;
  time_zone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_seen: string;
  referral_code: string | null;
  referred_by_id: User["id"];
  birthday: string;
  send_calendar_date_invites: boolean;
  notice: string | null;
  location: string;
  ip_geo: string;
};


export function UserDataModel() {
  const fetchPageOfData = useCallback(async (
    _page: number,
    filters: Array<[Array<string>, any]>,
    sort: Sort | null,
    searchText: string,
    signal: AbortSignal
  ) => {
    const qs = new URLSearchParams();

    if (filters || searchText.length > 0) {
      for (const [[name, ..._rest], value] of filters) {
        qs.set(name, value);
      }
    }
    if (searchText.length > 0) {
      qs.set('name', searchText);
    }

    const response = await fetch(`http://localhost:3003/filteroff-users?${qs.toString()}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching filteroff-users: received ${response.status} ${await response.text()}`)
    }

    let body = await response.json();

    if (sort) {
      body = body.sort((a: any, b: any) => {
        if (!sort) {
          return 0;
        } else {
          const asc = sort.direction === "desc" ? 1 : -1;
          const desc = sort.direction === "desc" ? -1 : 1;
          return a[sort.fieldName] < b[sort.fieldName] ? asc : desc;
        }
      });
    }

    return {
      nextPageAvailable: false,
      totalCount: body.length,
      data: body,
    };
  }, []);

  const fetchItem = useCallback(async (itemKey: string, signal: AbortSignal) => {
    const response = await fetch(`http://localhost:3003/filteroff-users/${itemKey}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching user with id ${itemKey}: received ${response.status} ${await response.text()}`)
    }

    return response.json();
  }, []);

  const createItem = useCallback(async (createData: Partial<User>, signal: AbortSignal) => {
    const response = await fetch(`http://localhost:3003/filteroff-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createData),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Error creating user: received ${response.status} ${await response.text()}`)
    }

    const body = await response.json();

    await new Promise(r => setTimeout(r, 5000));

    return body;
  }, []);

  const updateItem = useCallback(async (itemKey: string, updateData: Partial<User>, signal: AbortSignal) => {
    const response = await fetch(`http://localhost:3003/filteroff-users/${itemKey}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Error updating user ${itemKey}: received ${response.status} ${await response.text()}`)
    }

    return response.json();
  }, []);

  return (
    <DataModel<User>
      name="user"
      singularDisplayName="User"
      pluralDisplayName="Users"

      fetchPageOfData={fetchPageOfData}
      fetchItem={fetchItem}
      createItem={createItem}
      updateItem={updateItem}
      // deleteItem

      keyGenerator={user => user.id}
      detailLinkGenerator={user => ({ type: 'next-link' as const, href: `/admin/filteroff/users/${user.id}` })}
      listLink={{ type: 'next-link' as const, href: `/admin/filteroff/users` }}
      createLink={{ type: 'next-link', href: `/admin/filteroff/users/new` }}
    >
      <PrimaryKeyField<User, "id">
        name="id"
        singularDisplayName="Id"
        pluralDisplayName="Ids"
        csvExportColumnName="id"
        columnWidth={100}
        sortable
      />
      <ChoiceField<User, "provider">
        name="provider"
        singularDisplayName="Provider"
        pluralDisplayName="Providers"
        csvExportColumnName="provider"
        getInitialStateWhenCreating={() => 'unset'}
        choices={[
          {id: 'unset', disabled: true, label: 'unset'},
          {id: 'twilio', label: 'twilio'},
          {id: 'something-else', label: 'something else'},
        ]}
        sortable
      />
      <NumberField<User, "uid"> name="uid" singularDisplayName="Uid" pluralDisplayName="Uids" sortable />
      <InputField<User, "name">
        name="name"
        singularDisplayName="Name"
        pluralDisplayName="Names"
        sortable
      />
      <InputField<User, "profile_picture_url">
        name="profile_picture_url"
        singularDisplayName="Picture"
        pluralDisplayName="Pictures"
        displayMarkup={(state) => (
          <img src={state} style={{ width: 128, height: 128 }} />
        )}
      />
      <InputField<User, "gender"> name="gender" singularDisplayName="Gender" pluralDisplayName="Genders" sortable />
      <NumberField<User, "age"> name="age" singularDisplayName="Age" pluralDisplayName="Ages" sortable />
      <NumberField<User, "age_min"> name="age_min" singularDisplayName="Age Min" pluralDisplayName="Age Mines" sortable />
      <NumberField<User, "age_max"> name="age_max" singularDisplayName="Age Max" pluralDisplayName="Age Maxes" sortable />
      <NumberField<User, "radius"> name="radius" singularDisplayName="radius" pluralDisplayName="radiuss" sortable />
      <InputField<User, "time_zone"> name="time_zone" singularDisplayName="Time Zone" pluralDisplayName="Time Zones" sortable />
      <InputField<User, "bio"> name="bio" singularDisplayName="Bio" pluralDisplayName="Bios" sortable />

      <BooleanField<User, "is_active">
        name="is_active"
        singularDisplayName="Is Active"
        pluralDisplayName="Is Actives"
        sortable
        getInitialStateWhenCreating={() => true}
      />

      <InputField<User, "created_at">
        name="created_at"
        singularDisplayName="Created At"
        pluralDisplayName="Created Ats"
        sortable
        getInitialStateWhenCreating={() => new Date().toISOString()}
      />
      <InputField<User, "updated_at">
        name="updated_at"
        singularDisplayName="Updated At"
        pluralDisplayName="Updated Ats"
        sortable
        getInitialStateWhenCreating={() => new Date().toISOString()}
      />
      <InputField<User, "last_seen">
        name="last_seen"
        singularDisplayName="Updated At"
        pluralDisplayName="Updated Ats"
        sortable
        getInitialStateWhenCreating={() => new Date().toISOString()}
      />

      <InputField<User, "referral_code"> name="referral_code" singularDisplayName="Referral Code" pluralDisplayName="Referral Codes" sortable />
      {/* FIXME: referred_by_id I think is a self referential FK! */}
      <InputField<User, "birthday"> name="birthday" singularDisplayName="Birthday" pluralDisplayName="Birthdays" sortable />
      <BooleanField<User, "send_calendar_date_invites">
        name="send_calendar_date_invites"
        singularDisplayName="Send Calendar Date Invites"
        pluralDisplayName="Send Calendar Date Invitess"
        getInitialStateWhenCreating={() => false}
        sortable
      />
      <InputField<User, "notice", true>
        name="notice"
        singularDisplayName="Notice"
        pluralDisplayName="Notices"
        nullable
        sortable
      />

      <InputField<User, "show_me"> name="show_me" singularDisplayName="Show Me" pluralDisplayName="Show Mes" sortable />
      <InputField<User, "location"> name="location" singularDisplayName="Location" pluralDisplayName="Locations" sortable />
      <InputField<User, "ip_geo"> name="ip_geo" singularDisplayName="Ip Geo" pluralDisplayName="Ip Geos" sortable />
    </DataModel>
  );
}

export default function AllDataModels({ children }: { children: React.ReactNode}) {
  const stateCache: StateCache = useMemo(() => {
    return {
      store: async (filters, sort, searchText, _columnSet) => {
        const url = new URL(window.location.href);

        if (filters.length > 0) {
          url.searchParams.set('filters', JSON.stringify(filters));
        } else {
          url.searchParams.delete('filters');
        }

        if (sort) {
          url.searchParams.set('sort', JSON.stringify(sort));
        } else {
          url.searchParams.delete('sort');
        }

        if (searchText.length > 0) {
          url.searchParams.set('searchtext', JSON.stringify(searchText));
        } else {
          url.searchParams.delete('searchtext');
        }

        window.history.pushState({}, "", url.toString());
      },
      read: async () => {
        const url = new URL(window.location.href);
        const filters = JSON.parse(url.searchParams.get('filters') || '[]');
        const sort = JSON.parse(url.searchParams.get('sort') || 'null');
        const searchText = JSON.parse(url.searchParams.get('searchtext') || '""');
        const columnSet = 'all';

        return [filters, sort, searchText, columnSet];
      },
    };
  }, []);

  // This function would make a request to the server and get `definitions`, plus then inject all
  // this extra context about how one could query the server to get information about the given datamodels
  //
  // This would be what that "bread specific custom adapter" thing would do:
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
      // createItem
      // updateItem
      // deleteItem

      listLink: (dataModelName) => ({ type: 'next-link', href: `/admin/filteroff/${dataModelName}` }),
      detailLinkGenerator: (dataModelName, key) => ({ type: 'next-link', href: `/admin/filteroff/${dataModelName}/${key}` }),
      createLink: dataModelName => ({ type: 'next-link', href: `/admin/filteroff/${dataModelName}/new` }),

      // Somehow generate this from the prisma schema file serverside...
      definitions: {
        dynamicmodel: {
          singularDisplayName: 'Dynamic Model',
          pluralDisplayName: 'Dynamic Models',
          columns: {
            id: { type: 'primaryKey', singularDisplayName: 'id', pluralDisplayName: 'ids' },
            textcolumn: { type: 'text', singularDisplayName: 'text column', pluralDisplayName: 'text columns' },
            foreign: { type: 'singleForeignKey', to: 'user', singularDisplayName: 'foreign', pluralDisplayName: 'foreign' },
          },
        },
        dynamicmodel2: {
          singularDisplayName: 'Dynamic Model 2',
          pluralDisplayName: 'Dynamic Model 2s',
          columns: {
            id: { type: 'primaryKey', singularDisplayName: 'id', pluralDisplayName: 'id' },
            textcolumn: { type: 'text', singularDisplayName: 'text column', pluralDisplayName: 'text columns' },
          },
        },
      },
    };
  }, []);

  return (
    <div style={{ fontFamily: 'Roboto Mono, menlo, monospace' }}>
      <AdminContextProvider stateCache={stateCache} nextRouter={useRouter()}>
        <DataModels fetchRemoteDataModels={fetchRemoteDataModels}> {/* <-- fetchRemoteDataModels is passed in here */}

          {/* Finally, a new built in component: This will render custom server generated data models: */}
          <RemoteDataModels />
          {/* You could also do this, to exclude certain server generated ones so you can implement your own: */}
          {/* <RemoteDataModels exclude={["dynamicmodel2"]} /> */}
          {/* Or the allowlist version */}
          {/* <RemoteDataModels include={["dynamicmodel"]} /> */}

          {/* Data model that is a fully custom implementation: */}
          <UserDataModel />

          {children}
        </DataModels>
      </AdminContextProvider>
    </div>
  );
}

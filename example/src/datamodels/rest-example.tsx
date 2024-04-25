import { useCallback, useMemo } from 'react';

import {
  Field,
  InputField,
  DataModels,
  DataModel,
  SingleForeignKeyField,
  MultiForeignKeyField,
  AdminContextProvider,
  StateCache,
  // ChoiceField,
} from '@/admin';
import JSONField from '@/admin/fields/JSONField';
import { Filter, Sort } from '@/admin/types';

export type Post = {
  id: number,
  userId: User["id"],
  title: string,
  body: string,
  commentIds: Array<Comment['id']>,
};

export function PostDataModel() {
  const fetchPageOfData = useCallback(async (
    page: number,
    filters: Array<[Filter["name"], Filter["state"]]>,
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

    // NOTE: I'm working around a limitation of the json-server thing here, ideally a total count
    // would be returned by whatever api endpoint this function is calling
    const totalCountResponse = await fetch(`http://localhost:3003/posts?${qs.toString()}`, { signal });
    if (!totalCountResponse.ok) {
      throw new Error(`Error fetching posts to get total count: received ${totalCountResponse.status} ${await totalCountResponse.text()}`)
    }
    const totalCount = (await totalCountResponse.json()).length;

    const pageSize = 30;
    qs.set('_start', `${(page-1) * pageSize}`);
    qs.set('_limit', `${pageSize}`);

    if (sort) {
      qs.set('_sort', sort.direction === 'desc' ? `-${sort.fieldName}` : sort.fieldName);
    }

    if (searchText.length > 0) {
      qs.set('q', searchText);
    }

    const response = await fetch(`http://localhost:3003/posts?${qs.toString()}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching posts: received ${response.status} ${await response.text()}`)
    }

    const body = await response.json();

    return {
      nextPageAvailable: totalCount > page*pageSize,
      totalCount,
      data: body,
    };
  }, []);

  const fetchItem = useCallback(async (itemKey: string, signal: AbortSignal) => {
    const response = await fetch(`http://localhost:3003/posts/${itemKey}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching post with id ${itemKey}: received ${response.status} ${await response.text()}`)
    }

    return response.json();
  }, []);

  const createItem = useCallback(async (createData: Partial<Post>, signal: AbortSignal) => {
    const response = await fetch(`http://localhost:3003/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createData),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Error creating post: received ${response.status} ${await response.text()}`)
    }

    return response.json();
  }, []);

  const updateItem = useCallback(async (itemKey: string, updateData: Partial<Post>, signal: AbortSignal) => {
    const response = await fetch(`http://localhost:3003/posts/${itemKey}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Error updating post ${itemKey}: received ${response.status} ${await response.text()}`)
    }

    return response.json();
  }, []);

  const deleteItem = useCallback(async (itemKey: string, signal: AbortSignal) => {
    const response = await fetch(`http://localhost:3003/posts/${itemKey}`, { method: 'DELETE', signal });
    if (!response.ok) {
      throw new Error(`Error deleting post with id ${itemKey}: received ${response.status} ${await response.text()}`)
    }
  }, []);

  return (
    <DataModel<Post>
      name="post"
      singularDisplayName="post"
      pluralDisplayName="posts"

      fetchPageOfData={fetchPageOfData}
      fetchItem={fetchItem}
      createItem={createItem}
      updateItem={updateItem}
      deleteItem={deleteItem}

      keyGenerator={post => `${post.id}`}
      detailLinkGenerator={post => ({ type: 'href' as const, href: `/admin/rest-example/posts/${post.id}` })}
      listLink={{ type: 'href' as const, href: `/admin/rest-example/posts` }}
      createLink={{ type: 'href', href: `/admin/rest-example/posts/new` }}
    >
      <Field<Post, 'id', number>
        name="id"
        singularDisplayName="Id"
        pluralDisplayName="Ids"
        csvExportColumnName="id"
        columnWidth={100}
        sortable
        getInitialStateFromItem={post => post.id}
        injectAsyncDataIntoInitialStateOnDetailPage={async state => state}
        serializeStateToItem={(item) => item}
        displayMarkup={state => <span>{state}</span>}
      />
      <SingleForeignKeyField<Post, 'userId', User>
        name="userId"
        singularDisplayName="User"
        pluralDisplayName="Users"
        csvExportColumnName="user_id"

        // nullable
        sortable
        // searchable

        relatedName="user"
        getInitialStateFromItem={post => ({ type: 'KEY_ONLY' as const, key: `${post.userId}` })}
      />
      <MultiForeignKeyField<Post, 'commentIds', Comment>
        name="commentIds"
        singularDisplayName="Comments"
        pluralDisplayName="Comments"
        csvExportColumnName="comments m2m"

        relatedName="comment"
        getInitialStateFromItem={post => ({ type: "KEY_ONLY", key: post.commentIds })}
      />
      <InputField<Post, 'title'>
        name="title"
        singularDisplayName="Title"
        pluralDisplayName="Titles"
        sortable
        // getInitialStateFromItem={post => post.title}
        // getInitialStateWhenCreating={() => ''}
        // serializeStateToItem={(initialItem, state) => ({ ...initialItem, title: state })}
      />
      {/* <ChoiceField<Post, 'title'> */}
      {/*   name="title" */}
      {/*   singularDisplayName="Title" */}
      {/*   pluralDisplayName="Titles" */}
      {/*   csvExportColumnName="title_value" */}
      {/*   getInitialStateWhenCreating={() => 'unset'} */}
      {/*   choices={[ */}
      {/*     {id: 'unset', disabled: true, label: 'unset'}, */}
      {/*     {id: 'foo', label: 'foo'}, */}
      {/*     {id: 'bar', label: 'bar'}, */}
      {/*   ]} */}
      {/* /> */}
      {/* <InputField<Post, 'body'> */}
      <JSONField<Post, 'body'>
        name="body"
        singularDisplayName="Body"
        pluralDisplayName="Bodies"
        csvExportColumnName="body_text"
        // sortable
        getInitialStateFromItem={post => ({body: post.body})}
        getInitialStateWhenCreating={() => ({ body: "" })}
        serializeStateToItem={(initialItem, state) => ({ ...initialItem, body: state.body })}
      />
    </DataModel>
  );
}

export type User = {
  id: string,
  name: string,
  username: string,
  email: string,
  address: {
    street: string,
    suite: string,
    city: string,
    zipcode: string,
    geo: {
      lat: string,
      lng: string,
    },
  },
  phone: string,
  website: string,
  company: {
    name: string,
    catchPhrase: string,
    bs: string,
  },
};

export function UserDataModel() {
  const fetchPageOfData = useCallback(async (
    page: number,
    filters: Array<[Filter["name"], Filter["state"]]>,
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

    // NOTE: I'm working around a limitation of the json-server thing here, ideally a total count
    // would be returned by whatever api endpoint this function is calling
    const totalCountResponse = await fetch(`http://localhost:3003/users?${qs.toString()}`, { signal });
    if (!totalCountResponse.ok) {
      throw new Error(`Error fetching users to get total count: received ${totalCountResponse.status} ${await totalCountResponse.text()}`)
    }
    const totalCount = (await totalCountResponse.json()).length;

    const pageSize = 30;
    qs.set('_start', `${(page-1) * pageSize}`);
    qs.set('_limit', `${pageSize}`);

    if (sort) {
      qs.set('_sort', sort.direction === 'desc' ? `-${sort.fieldName}` : sort.fieldName);
    }

    if (searchText.length > 0) {
      qs.set('q', searchText);
    }

    const response = await fetch(`http://localhost:3003/users?${qs.toString()}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching users: received ${response.status} ${await response.text()}`)
    }

    const body = await response.json();

    return {
      nextPageAvailable: totalCount > page*pageSize,
      totalCount,
      data: body,
    };
  }, []);

  const fetchItem = useCallback(async (itemKey: string, signal: AbortSignal) => {
    const response = await fetch(`http://localhost:3003/users/${itemKey}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching user with id ${itemKey}: received ${response.status} ${await response.text()}`)
    }

    return response.json();
  }, []);

  const createItem = useCallback(async (createData: Partial<User>, signal: AbortSignal) => {
    const response = await fetch(`http://localhost:3003/users`, {
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

    return response.json();
  }, []);

  const updateItem = useCallback(async (itemKey: string, updateData: Partial<User>, signal: AbortSignal) => {
    const response = await fetch(`http://localhost:3003/users/${itemKey}`, {
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

  const deleteItem = useCallback(async (itemKey: string, signal: AbortSignal) => {
    const response = await fetch(`http://localhost:3003/users/${itemKey}`, { method: 'DELETE', signal });
    if (!response.ok) {
      throw new Error(`Error deleting user with id ${itemKey}: received ${response.status} ${await response.text()}`)
    }
  }, []);

  return (
    <DataModel<User>
      name="user"
      singularDisplayName="user"
      pluralDisplayName="users"

      fetchPageOfData={fetchPageOfData}
      fetchItem={fetchItem}
      createItem={createItem}
      updateItem={updateItem}
      deleteItem={deleteItem}

      keyGenerator={user => `${user.id}`}
      detailLinkGenerator={user => ({ type: 'href' as const, href: `/admin/rest-example/users/${user.id}` })}
      listLink={{ type: 'href' as const, href: `/admin/rest-example/users` }}
      createLink={{ type: 'href', href: `/admin/rest-example/users/new` }}
    >
      <Field<User, 'id', number>
        name="id"
        singularDisplayName="Id"
        pluralDisplayName="Ids"
        columnWidth={100}
        getInitialStateFromItem={user => user.id}
        injectAsyncDataIntoInitialStateOnDetailPage={async state => state}
        serializeStateToItem={(item) => item}
        displayMarkup={state => <span>{state}</span>}
      />
      <InputField<User, 'name'>
        name="name"
        singularDisplayName="Name"
        pluralDisplayName="Names"
        sortable
        getInitialStateFromItem={user => `${user.name}`}
        getInitialStateWhenCreating={() => ''}
        serializeStateToItem={(initialItem, state) => ({ ...initialItem, name: state })}
      />
      <InputField<User, 'username'>
        name="username"
        singularDisplayName="Username"
        pluralDisplayName="Usernames"
        sortable
        getInitialStateFromItem={user => `${user.username}`}
        getInitialStateWhenCreating={() => ''}
        serializeStateToItem={(initialItem, state) => ({ ...initialItem, username: state })}
      />
      <InputField<User, 'email'>
        name="email"
        singularDisplayName="Email"
        pluralDisplayName="Emails"
        sortable
        getInitialStateFromItem={user => `${user.email}`}
        getInitialStateWhenCreating={() => ''}
        serializeStateToItem={(initialItem, state) => ({ ...initialItem, email: state })}
      />
      <InputField<User, 'phone'>
        name="phone"
        singularDisplayName="Phone"
        pluralDisplayName="Phones"
        sortable
        getInitialStateFromItem={user => `${user.phone}`}
        getInitialStateWhenCreating={() => ''}
        serializeStateToItem={(initialItem, state) => ({ ...initialItem, phone: state })}
      />
      <InputField<User, 'website'>
        name="website"
        singularDisplayName="Website"
        pluralDisplayName="Websites"
        sortable
        getInitialStateFromItem={user => `${user.website}`}
        getInitialStateWhenCreating={() => ''}
        serializeStateToItem={(initialItem, state) => ({ ...initialItem, website: state })}
      />
    </DataModel>
  );
}

export type Comment = {
  id: string,
  body: string,
};

export function CommentDataModel() {
  const fetchPageOfData = useCallback(async (
    page: number,
    filters: Array<[Filter["name"], Filter["state"]]>,
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

    // NOTE: I'm working around a limitation of the json-server thing here, ideally a total count
    // would be returned by whatever api endpoint this function is calling
    const totalCountResponse = await fetch(`http://localhost:3003/comments?${qs.toString()}`, { signal });
    if (!totalCountResponse.ok) {
      throw new Error(`Error fetching comments to get total count: received ${totalCountResponse.status} ${await totalCountResponse.text()}`)
    }
    const totalCount = (await totalCountResponse.json()).length;

    const pageSize = 30;
    qs.set('_start', `${(page-1) * pageSize}`);
    qs.set('_limit', `${pageSize}`);

    if (sort) {
      qs.set('_sort', sort.direction === 'desc' ? `-${sort.fieldName}` : sort.fieldName);
    }

    if (searchText.length > 0) {
      qs.set('q', searchText);
    }

    const response = await fetch(`http://localhost:3003/comments?${qs.toString()}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching comments: received ${response.status} ${await response.text()}`)
    }

    const body = await response.json();

    return {
      nextPageAvailable: totalCount > page*pageSize,
      totalCount,
      data: body,
    };
  }, []);

  const fetchItem = useCallback(async (itemKey: string, signal: AbortSignal) => {
    const response = await fetch(`http://localhost:3003/comments/${itemKey}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching comment with id ${itemKey}: received ${response.status} ${await response.text()}`)
    }

    return response.json();
  }, []);

  const createItem = useCallback(async (createData: Partial<Comment>, signal: AbortSignal) => {
    const response = await fetch(`http://localhost:3003/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createData),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Error creating comment: received ${response.status} ${await response.text()}`)
    }

    return response.json();
  }, []);

  const updateItem = useCallback(async (itemKey: string, updateData: Partial<Comment>, signal: AbortSignal) => {
    const response = await fetch(`http://localhost:3003/comments/${itemKey}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Error updating comment ${itemKey}: received ${response.status} ${await response.text()}`)
    }

    return response.json();
  }, []);

  const deleteItem = useCallback(async (itemKey: string, signal: AbortSignal) => {
    const response = await fetch(`http://localhost:3003/comments/${itemKey}`, { method: 'DELETE', signal });
    if (!response.ok) {
      throw new Error(`Error deleting comment with id ${itemKey}: received ${response.status} ${await response.text()}`)
    }
  }, []);

  return (
    <DataModel<Comment>
      name="comment"
      singularDisplayName="Comment"
      pluralDisplayName="Comments"

      fetchPageOfData={fetchPageOfData}
      fetchItem={fetchItem}
      createItem={createItem}
      updateItem={updateItem}
      deleteItem={deleteItem}

      keyGenerator={comment => `${comment.id}`}
      detailLinkGenerator={comment => ({ type: 'href' as const, href: `/admin/rest-example/comments/${comment.id}` })}
      listLink={{ type: 'href' as const, href: `/admin/rest-example/comments` }}
      createLink={{ type: 'href', href: `/admin/rest-example/comments/new` }}
    >
      <Field<Comment, 'id', Comment['id']>
        name="id"
        singularDisplayName="Id"
        pluralDisplayName="Ids"
        columnWidth={100}
        getInitialStateFromItem={comment => comment.id}
        injectAsyncDataIntoInitialStateOnDetailPage={async state => state}
        serializeStateToItem={(item) => item}
        displayMarkup={state => <span>{state}</span>}
      />
      <InputField<Comment, 'body'>
        name="body"
        singularDisplayName="Body"
        pluralDisplayName="Bodies"
        sortable
        getInitialStateFromItem={comment => comment.body}
        getInitialStateWhenCreating={() => ''}
        serializeStateToItem={(initialItem, state) => ({ ...initialItem, body: state })}
      />
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

  // Example of how you may want to override ui controls to make the admin have a similar user
  // experience to the main app:
  const controls = useMemo(() => {
    const Button: React.FunctionComponent<{
      size?: "small" | "regular";
      disabled?: boolean;
      children: React.ReactNode;
      onClick: () => void;
    }> = ({ size, disabled, onClick, children }) => (
      <button disabled={disabled} onClick={onClick} style={{ background: 'red' }}>
        size:{size} {children}
      </button>
    );

    const IconButton: React.FunctionComponent<{
      size?: "small" | "regular";
      disabled?: boolean;
      children: React.ReactNode;
      onClick: () => void;
    }> = ({ size, disabled, onClick, children }) => (
      <button disabled={disabled} onClick={onClick} style={{ background: 'green' }}>
        size:{size} {children}
      </button>
    );

    return {
      // Button,
      // IconButton,
    };
  }, []);

  return (
    <div style={{ fontFamily: 'Roboto Mono, menlo, monospace' }}>
      <AdminContextProvider stateCache={stateCache} controls={controls}>
        <DataModels>
          <PostDataModel />
          <UserDataModel />
          <CommentDataModel />

          {children}
        </DataModels>
      </AdminContextProvider>
    </div>
  );
}

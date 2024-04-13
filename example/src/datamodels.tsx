import { useCallback, useMemo } from 'react';

import { BattleWithParticipants, BattleParticipant, BattleBeat } from '@/types';
import {
  Field,
  Sort,
  InputField,
  DataModels,
  DataModel,
  SingleForeignKeyField,
  MultiForeignKeyField,
  AdminContextProvider,
  StateCache,
  MultiLineInputField,
  ChoiceField,
} from '@/admin';

export function BattleDataModel() {
  const fetchPageOfData = useCallback(async (
    page: number,
    filters: any,
    sort: Sort | null,
    searchText: string,
    signal: AbortSignal
  ) => {
    // console.log('REQUEST:', page, filters, sort, searchText);
    const qs = new URLSearchParams();
    qs.set('page', `${page}`);

    if (sort) {
      qs.set('sortField', sort.fieldName);
      qs.set('sortDirection', sort.direction);
    }

    if (filters || searchText.length > 0) {
      let filtersParam: any = {};
      if (searchText.length > 0) {
        filtersParam.id = { contains: searchText };
      }

      for (const [name, value] of filters) {
        let cursor = filtersParam;
        let lastCursor = filtersParam;
        for (const part of name) {
          if (!cursor[part]) {
            cursor[part] = {};
          }
          lastCursor = cursor;
          cursor = cursor[part];
        }
        let parsedValue: any;
        try {
          parsedValue = JSON.parse(value)
        } catch {
          parsedValue = value;
        }
        lastCursor[name.at(-1)] = parsedValue;
      }
      qs.set('filters', JSON.stringify(filtersParam));
    }

    const response = await fetch(`https://api-staging.rapbattleapp.com/v1/battles?${qs.toString()}`, {
      signal,
      headers: {
        // 'Authorization': `Bearer ${await getToken()}`,
      },
    });
    // const response = await fetch(`http://localhost:8000/v1/battles?${qs.toString()}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching battles: received ${response.status} ${await response.text()}`)
    }

    const body = await response.json();

    return {
      nextPageAvailable: Boolean(body.next),
      totalCount: body.total,
      data: body.results,
    };
  }, []);

  const fetchItem = useCallback(async (itemKey: string, signal: AbortSignal) => {
    const response = await fetch(`https://api-staging.rapbattleapp.com/v1/battles/${itemKey}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching battle with id ${itemKey}: received ${response.status} ${await response.text()}`)
    }

    return response.json();
  }, []);

  const createItem = useCallback(async (createData: Partial<BattleParticipant>, signal: AbortSignal) => {
    const response = await fetch(`https://api-staging.rapbattleapp.com/v1/battles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createData),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Error creating battle: received ${response.status} ${await response.text()}`)
    }

    return response.json();
  }, []);

  const updateItem = useCallback(async (itemKey: string, updateData: Partial<BattleParticipant>, signal: AbortSignal) => {
    const response = await fetch(`https://api-staging.rapbattleapp.com/v1/battles/${itemKey}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Error updating battle ${itemKey}: received ${response.status} ${await response.text()}`)
    }

    return response.json();
  }, []);

  const deleteItem = useCallback(async (itemKey: string, signal: AbortSignal) => {
    const response = await fetch(`https://api-staging.rapbattleapp.com/v1/battles/${itemKey}`, { method: 'DELETE', signal });
    if (!response.ok) {
      throw new Error(`Error deleting battle with id ${itemKey}: received ${response.status} ${await response.text()}`)
    }
  }, []);

  return (
    <DataModel<BattleWithParticipants>
      name="battle"
      singularDisplayName="battle"
      pluralDisplayName="battles"

      fetchPageOfData={fetchPageOfData}
      fetchItem={fetchItem}
      // createItem={createItem}
      createItem={null}
      // updateItem={updateItem}
      updateItem={null}
      // deleteItem={deleteItem}
      deleteItem={null}

      keyGenerator={battle => battle.id}
      detailLinkGenerator={battle => ({ type: 'href' as const, href: `/admin/battles/${battle.id}` })}
      createLink={{ type: 'href', href: `/admin/battles/new` }}
    >
      <Field<BattleWithParticipants, 'id', string>
        name="id"
        singularDisplayName="Id"
        pluralDisplayName="Ids"
        columnWidth="250px"
        getInitialStateFromItem={battle => battle.id}
        injectAsyncDataIntoInitialStateOnDetailPage={async state => state}
        serializeStateToItem={(item) => item}
        displayMarkup={state => <span>{state}</span>}
      />
      <InputField<BattleWithParticipants, 'startedAt', true>
        name="startedAt"
        singularDisplayName="Started At"
        pluralDisplayName="Started Ats"
        columnWidth="200px"
        sortable
        nullable
        getInitialStateFromItem={battle => battle.startedAt}
        getInitialStateWhenCreating={() => ''}
        serializeStateToItem={(initialItem, state) => ({ ...initialItem, startedAt: state })}
      />
      <InputField<BattleWithParticipants, 'completedAt', true>
        name="completedAt"
        singularDisplayName="Completed At"
        pluralDisplayName="Completed Ats"
        columnWidth="200px"
        sortable
        nullable
        getInitialStateFromItem={battle => battle.completedAt}
        getInitialStateWhenCreating={() => ''}
        serializeStateToItem={(initialItem, state) => ({ ...initialItem, completedAt: state })}
      />
      <InputField<BattleWithParticipants, 'madeInactiveAt', true>
        name="madeInactiveAt"
        singularDisplayName="Made Inactive At"
        pluralDisplayName="Made Inactive Ats"
        columnWidth="200px"
        nullable
        sortable
        getInitialStateFromItem={battle => battle.madeInactiveAt}
        getInitialStateWhenCreating={() => ''}
        serializeStateToItem={(initialItem, state) => ({ ...initialItem, madeInactiveAt: state })}
      />
      <InputField<BattleWithParticipants, 'madeInactiveReason', true>
        name="madeInactiveReason"
        singularDisplayName="Made Inactive Reason"
        pluralDisplayName="Made Inactive Reasons"
        columnWidth="200px"
        sortable
        nullable
        getInitialStateFromItem={battle => battle.madeInactiveReason}
        getInitialStateWhenCreating={() => ''}
        serializeStateToItem={(initialItem, state) => ({ ...initialItem, madeInactiveReason: state })}
      />
      {/* <SingleForeignKeyField<BattleWithParticipants, 'beat', BattleBeat> */}
      {/*   name="beat" */}
      {/*   singularDisplayName="Beat" */}
      {/*   pluralDisplayName="Beats" */}
      {/*   columnWidth="165px" */}
      {/*   nullable */}
      {/*   getInitialStateFromItem={battle => ({ beatId: battle.beatId, beatKey: 'OLD', beatUrl: 'OLD' })} */}
      {/*   serializeStateToItem={(initialItem, beat) => ({ ...initialItem, beatId: beat.id })} */}

      {/*   getRelatedKey={beat => beat.id} */}
      {/*   relatedName="battleBeat" */}

      {/*   generateNewRelatedItem={() => ({ id: '', beatKey: 'NEW', beatUrl: 'NEW' })} */}
      {/*   createRelatedItem={(_item, relatedItem) => Promise.resolve({id: 'aaa', ...relatedItem} as BattleBeat)} */}
      {/*   updateRelatedItem={(_item, relatedItem) => Promise.resolve({...relatedItem} as BattleBeat)} */}
      {/* /> */}
      <MultiForeignKeyField<BattleWithParticipants, 'beats', BattleBeat>
        name="beats"
        singularDisplayName="Beat"
        pluralDisplayName="Beats"
        columnWidth="165px"
        // nullable
        getInitialStateFromItem={battle => battle.beatId ? [{ id: battle.beatId, beatKey: 'OLD', beatUrl: 'OLD' }] : []}
        serializeStateToItem={(initialItem, beats) => ({ ...initialItem, beatIds: beats.map(beat => beat.id) })}

        getRelatedKey={beat => beat.id}
        relatedName="battleBeat"

        // generateNewRelatedItem={() => ({ id: '', beatKey: 'NEW', beatUrl: 'NEW' })}
        createRelatedItem={(_item, relatedItem) => Promise.resolve({id: 'aaa', ...relatedItem} as BattleBeat)}
        updateRelatedItem={(_item, relatedItem) => Promise.resolve({...relatedItem} as BattleBeat)}
      />
      <Field<BattleWithParticipants, 'participants', BattleWithParticipants['participants']>
        name="participants"
        singularDisplayName="Participants"
        pluralDisplayName="Participants"
        columnWidth="165px"
        getInitialStateFromItem={battle => battle.participants}
        injectAsyncDataIntoInitialStateOnDetailPage={async state => state}
        serializeStateToItem={(initialItem) => initialItem}
        displayMarkup={state => <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
          {state.map((participant) => (
            <div key={participant.id} style={{display: 'flex', alignItems: 'center', gap: 4}}>
              <a href={`/battle-participants/${participant.id}`} style={{display: 'flex', gap: 4}}>
                {participant.user.profileImageUrl ? (
                  <img src={participant.user.profileImageUrl} style={{width: 20, height: 20, borderRadius: 4}} />
                ) : (
                  <div style={{width: 20, height: 20, backgroundColor: '#ddd', borderRadius: 4}} />
                )}
                {participant.user.handle ? (
                  <small>{participant.user.handle}</small>
                ) : (
                  <small><small>{participant.user.id}</small></small>
                )}
              </a>
            </div>
          ))}
        </div>}
      />
    </DataModel>
  );
}

export function BattleBeatDataModel() {
  const fetchPageOfData = useCallback(async (
    page: number,
    filters: any,
    sort: Sort | null,
    searchText: string,
    signal: AbortSignal
  ) => {
    // console.log('REQUEST:', page, filters, sort, searchText);
    const qs = new URLSearchParams();
    qs.set('page', `${page}`);

    if (sort) {
      qs.set('sortField', sort.fieldName);
      qs.set('sortDirection', sort.direction);
    }

    if (filters || searchText.length > 0) {
      let filtersParam: any = {};
      if (searchText.length > 0) {
        filtersParam.id = { contains: searchText };
      }

      for (const [name, value] of filters) {
        let cursor = filtersParam;
        let lastCursor = filtersParam;
        for (const part of name) {
          if (!cursor[part]) {
            cursor[part] = {};
          }
          lastCursor = cursor;
          cursor = cursor[part];
        }
        let parsedValue: any;
        try {
          parsedValue = JSON.parse(value)
        } catch {
          parsedValue = value;
        }
        lastCursor[name.at(-1)] = parsedValue;
      }
      qs.set('filters', JSON.stringify(filtersParam));
    }

    const response = await fetch(`https://api-staging.rapbattleapp.com/v1/battles?${qs.toString()}`, {
      signal,
      headers: {
        // 'Authorization': `Bearer ${await getToken()}`,
      },
    });
    // const response = await fetch(`http://localhost:8000/v1/battles?${qs.toString()}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching battles: received ${response.status} ${await response.text()}`)
    }

    const body = await response.json();

    return {
      nextPageAvailable: Boolean(body.next),
      totalCount: body.total,
      data: body.results,
    };
  }, []);

  const fetchItem = useCallback(async (itemKey: string, signal: AbortSignal) => {
    const response = await fetch(`https://api-staging.rapbattleapp.com/v1/battles/${itemKey}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching battle with id ${itemKey}: received ${response.status} ${await response.text()}`)
    }

    return response.json();
  }, []);

  return (
    <DataModel<BattleBeat>
      name="battleBeat"
      singularDisplayName="battle beat"
      pluralDisplayName="battle beats"

      fetchPageOfData={fetchPageOfData}
      fetchItem={fetchItem}
      createItem={null}
      updateItem={null}
      deleteItem={null}

      keyGenerator={beat => beat.id}
    >
      <Field<BattleBeat, 'id', string>
        name="id"
        singularDisplayName="Id"
        pluralDisplayName="Ids"
        columnWidth="250px"
        getInitialStateFromItem={beat => beat.id}
        injectAsyncDataIntoInitialStateOnDetailPage={async state => state}
        serializeStateToItem={(item) => item}
        displayMarkup={state => <span>{state}</span>}
      />
      <InputField<BattleBeat, 'beatKey'>
        name="beatKey"
        singularDisplayName="Beat Key"
        pluralDisplayName="Beat Keys"
        columnWidth="200px"
        sortable
        getInitialStateFromItem={beat => beat.beatKey}
        getInitialStateWhenCreating={() => ''}
        serializeStateToItem={(initialItem, state) => ({ ...initialItem, beatKey: state })}
      />
    </DataModel>
  );
}

export type Post = {
  id: number,
  userId: number,
  title: string,
  body: string,
  commentIds: Array<Comment['id']>,
};

export function PostDataModel() {
  const fetchPageOfData = useCallback(async (
    page: number,
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
      qs.set('title', searchText);
    }

    const response = await fetch(`http://localhost:3003/posts?${qs.toString()}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching posts: received ${response.status} ${await response.text()}`)
    }

    const body = await response.json();

    return {
      nextPageAvailable: false,
      totalCount: body.length,
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
      detailLinkGenerator={post => ({ type: 'href' as const, href: `/admin/posts/${post.id}` })}
      listLink={{ type: 'href' as const, href: `/admin/posts` }}
      createLink={{ type: 'href', href: `/admin/posts/new` }}
    >
      <Field<Post, 'id', number>
        name="id"
        singularDisplayName="Id"
        pluralDisplayName="Ids"
        columnWidth={100}
        getInitialStateFromItem={post => post.id}
        injectAsyncDataIntoInitialStateOnDetailPage={async state => state}
        serializeStateToItem={(item) => item}
        displayMarkup={state => <span>{state}</span>}
      />
      {/* <InputField<Post, 'userId'> */}
      {/*   name="userId" */}
      {/*   singularDisplayName="User ID" */}
      {/*   pluralDisplayName="User IDs" */}
      {/*   columnWidth={100} */}
      {/*   sortable */}
      {/*   getInitialStateFromItem={post => `${post.userId}`} */}
      {/*   getInitialStateWhenCreating={() => ''} */}
      {/*   serializeStateToItem={(initialItem, state) => ({ ...initialItem, userId: parseInt(state) })} */}
      {/* /> */}
      <SingleForeignKeyField<Post, 'userId', User>
        name="userId"
        singularDisplayName="User"
        pluralDisplayName="Users"
        getInitialStateFromItem={post => ({ id: post.userId, name: 'OLD', username: 'OLD', email: 'OLD', phone: 'OLD', website: 'OLD' }) as User}
        injectAsyncDataIntoInitialStateOnDetailPage={async (_state, item, signal) => {
          const response = await fetch(`http://localhost:3003/users/${item.userId}`, { signal });
          if (!response.ok) {
            throw new Error(`Error fetching user with id ${item.id}: received ${response.status} ${await response.text()}`);
          }

          return response.json();
        }}
        serializeStateToItem={(initialItem, user) => ({ ...initialItem, userId: user.id })}

        relatedName="user"

        generateNewRelatedItem={() => ({ id: 0, name: 'OLD', username: 'OLD', email: 'OLD', phone: 'OLD', website: 'OLD' }) as User}
        createRelatedItem={async (post, relatedUser) => {
          const user = { ...relatedUser, postId: post.id };
          const response = await fetch(`http://localhost:3003/users`, {
            /* signal, */
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user),
          });
          if (!response.ok) {
            throw new Error(`Error creating user with data ${JSON.stringify(user)}: received ${response.status} ${await response.text()}`);
          }

          return response.json();
        }}
        updateRelatedItem={(_item, relatedItem) => Promise.resolve({...relatedItem} as User)}
      />
      <MultiForeignKeyField<Post, 'commentIds', Comment>
        name="commentIds"
        singularDisplayName="Comments"
        pluralDisplayName="Comments"
        getInitialStateFromItem={post => post.commentIds.map(cid => ({ id: cid, body: "OLD" }))}
        injectAsyncDataIntoInitialStateOnDetailPage={async (_state, item, signal) => {
          const response = await fetch(`http://localhost:3003/comments`, { signal });
          if (!response.ok) {
            throw new Error(`Error fetching user with id ${item.id}: received ${response.status} ${await response.text()}`);
          }

          return response.json().then((comments: Array<Comment>) => {
            return item.commentIds.map(cid => comments.find(c => c.id === cid)!);
          });
        }}
        serializeStateToItem={(initialItem, comments) => ({ ...initialItem, commentIds: comments.map(c => c.id) })}

        relatedName="comment"

        createRelatedItem={async (post, relatedComment) => {
          const response = await fetch(`http://localhost:3003/comments`, {
            /* signal, */
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(relatedComment),
          });
          if (!response.ok) {
            throw new Error(`Error creating comment with data ${JSON.stringify(relatedComment)}: received ${response.status} ${await response.text()}`);
          }

          const comment = await response.json();

          const postResponse = await fetch(`http://localhost:3003/posts/${post.id}`, {
            /* signal, */
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...post, commentIds: [...post.commentIds, comment.id]}),
          });
          if (!postResponse.ok) {
            throw new Error(`Error updating post to add comment ${relatedComment.id}: received ${postResponse.status} ${await postResponse.text()}`);
          }

          return comment;
        }}
        updateRelatedItem={(_item, relatedItem) => Promise.resolve({...relatedItem} as Comment)}
      />
      {/* <InputField<Post, 'title'> */}
      {/*   name="title" */}
      {/*   singularDisplayName="Title" */}
      {/*   pluralDisplayName="Titles" */}
      {/*   // sortable */}
      {/*   // getInitialStateFromItem={post => post.title} */}
      {/*   // getInitialStateWhenCreating={() => ''} */}
      {/*   // serializeStateToItem={(initialItem, state) => ({ ...initialItem, title: state })} */}
      {/* /> */}
      <ChoiceField<Post, 'title'>
        name="title"
        singularDisplayName="Title"
        pluralDisplayName="Titles"
        choices={[
          {id: 'foo', label: 'foo'},
          {id: 'bar', label: 'bar'},
        ]}
      />
      <MultiLineInputField<Post, 'body'>
        name="body"
        singularDisplayName="Body"
        pluralDisplayName="Bodies"
        // sortable
        getInitialStateFromItem={post => post.body}
        getInitialStateWhenCreating={() => ''}
        serializeStateToItem={(initialItem, state) => ({ ...initialItem, body: state })}
      />
    </DataModel>
  );
}

export type User = {
  id: number,
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
    filters: Array<[Array<string>, any]>,
    sort: Sort | null,
    searchText: string,
    signal: AbortSignal
  ) => {
    // console.log('REQUEST:', page, filters, sort, searchText);
    const qs = new URLSearchParams();

    if (filters || searchText.length > 0) {
      for (const [[name, ..._rest], value] of filters) {
        qs.set(name, value);
      }
    }
    if (searchText.length > 0) {
      qs.set('title', searchText);
    }

    const response = await fetch(`http://localhost:3003/users?${qs.toString()}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching users: received ${response.status} ${await response.text()}`)
    }

    const body = await response.json();

    return {
      nextPageAvailable: false,
      totalCount: body.length,
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
      detailLinkGenerator={user => ({ type: 'href' as const, href: `/admin/users/${user.id}` })}
      listLink={{ type: 'href' as const, href: `/admin/users` }}
      createLink={{ type: 'href', href: `/admin/users/new` }}
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
    filters: Array<[Array<string>, any]>,
    sort: Sort | null,
    searchText: string,
    signal: AbortSignal
  ) => {
    // console.log('REQUEST:', page, filters, sort, searchText);
    const qs = new URLSearchParams();

    if (filters || searchText.length > 0) {
      for (const [[name, ..._rest], value] of filters) {
        qs.set(name, value);
      }
    }
    if (searchText.length > 0) {
      qs.set('title', searchText);
    }

    const response = await fetch(`http://localhost:3003/comments?${qs.toString()}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching comments: received ${response.status} ${await response.text()}`)
    }

    const body = await response.json();

    return {
      nextPageAvailable: false,
      totalCount: body.length,
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

      keyGenerator={user => `${user.id}`}
      detailLinkGenerator={user => ({ type: 'href' as const, href: `/admin/comments/${user.id}` })}
      listLink={{ type: 'href' as const, href: `/admin/comments` }}
      createLink={{ type: 'href', href: `/admin/comments/new` }}
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
        const searchText = url.searchParams.get('searchtext') || '';
        const columnSet = 'all';

        return [filters, sort, searchText, columnSet];
      },
    };
  }, []);

  return (
    <AdminContextProvider stateCache={stateCache}>
      <DataModels>
        {/* <BattleDataModel /> */}
        {/* <BattleBeatDataModel /> */}

        <PostDataModel />
        <UserDataModel />
        <CommentDataModel />

        {children}
      </DataModels>
    </AdminContextProvider>
  );
}

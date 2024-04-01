import { useCallback } from 'react';

import { BattleWithParticipants, BattleParticipant, BattleBeat } from '@/types';
import {
  Field,
  Sort,
  InputField,
  DataModels,
  DataModel,
  SingleForeignKeyField,
} from '@/admin';

export default function AllDataModels({ children }: { children: React.ReactNode}) {
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
    <DataModels>
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
          serializeStateToItem={(item) => item}
          displayMarkup={state => <span>{state}</span>}
        />
        <InputField<BattleWithParticipants, 'startedAt'>
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
        <InputField<BattleWithParticipants, 'completedAt'>
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
        <InputField<BattleWithParticipants, 'madeInactiveAt'>
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
        <InputField<BattleWithParticipants, 'madeInactiveReason'>
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
        {/* <SingleForeignKeyField<BattleWithParticipants & { beat: BattleBeat | null }, 'beat', BattleBeat> */}
        {/*   name="beat" */}
        {/*   singularDisplayName="Beat" */}
        {/*   pluralDisplayName="Beats" */}
        {/*   columnWidth="165px" */}
        {/*   nullable */}
        {/*   getInitialStateFromItem={battle => battle.beat} */}
        {/*   serializeStateToItem={(initialItem, beat) => ({ ...initialItem, beatId: beat.id })} */}

        {/*   getRelatedKey={beat => beat.id} */}
        {/*   relatedName="battleBeat" */}

        {/*   fetchPageOfRelatedData={(_page, item) => { */}
        {/*     return Promise.resolve({ */}
        {/*       nextPageAvailable: false, */}
        {/*       totalCount: 1, */}
        {/*       data: [item.beat], */}
        {/*     }); */}
        {/*   }} */}
        {/*   generateNewRelatedItem={() => ({ id: '', beatKey: 'NEW', beatUrl: 'NEW' })} */}
        {/*   createRelatedItem={(_item, relatedItem) => Promise.resolve({id: 'aaa', ...relatedItem} as BattleBeat)} */}
        {/*   updateRelatedItem={(_item, relatedItem) => Promise.resolve({...relatedItem} as BattleBeat)} */}
        {/* /> */}
        <Field<BattleWithParticipants, 'participants', BattleWithParticipants['participants']>
          name="participants"
          singularDisplayName="Participants"
          pluralDisplayName="Participants"
          columnWidth="165px"
          getInitialStateFromItem={battle => battle.participants}
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
          getInitialStateFromItem={battle => battle.id}
          serializeStateToItem={(item) => item}
          displayMarkup={state => <span>{state}</span>}
        />
        <InputField<BattleBeat, 'beatKey'>
          name="beatKey"
          singularDisplayName="Started At"
          pluralDisplayName="Started Ats"
          columnWidth="200px"
          sortable
          nullable
          getInitialStateFromItem={beat => beat.beatKey}
          getInitialStateWhenCreating={() => ''}
          serializeStateToItem={(initialItem, state) => ({ ...initialItem, beatKey: state })}
        />
      </DataModel>

      {children}
    </DataModels>
  );
}

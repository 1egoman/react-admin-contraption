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
  ChoiceField,
  ForeignKeyFullItem,
  NumberField,
  BooleanField,
  JSONField,
} from '@/admin';
import { Filter, Sort } from '@/admin/types';

export type Battle = {
  id: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  madeInactiveAt: string | null;
  madeInactiveReason: string | null;
  numberOfRounds: number;
  turnLengthSeconds: number;
  warmupLengthSeconds: number;
  twilioRoomName: string;
  twilioRoomSid: string;
  beatId: string | null;
  votingEndsAt: string | null;
  computedPrivacyLevel: 'PRIVATE' | 'PUBLIC';

  exportedVideoStatus:
    | 'QUEUING'
    | 'DOWNLOADING'
    | 'COMPOSITING'
    | 'UPLOADING'
    | 'COMPLETED'
    | 'ERROR'
    | 'DISABLED'
    | null;
  exportedVideoKey: string | null;
  exportedVideoQueuedAt: string | null;
  exportedVideoStartedAt: string | null;
  exportedVideoCompletedAt: string | null;
};

export type BattleParticipant = {
  id: string;
  createdAt: string;
  updatedAt: string;
  associatedWithBattleAt: string | null;
  // lastCheckedInAt: string;
  connectionStatus: 'UNKNOWN' | 'ONLINE' | 'OFFLINE';
  initialMatchFailed: boolean;
  battleId: string | null;
  readyForBattleAt: string | null;
  requestedBattlePrivacyLevel: 'PRIVATE' | 'PUBLIC' | null;
  twilioAudioTrackId: string | null;
  twilioVideoTrackId: string | null;
  twilioDataTrackId: string | null;
  forfeitedAt: string | null;
  videoStreamingStartedAt: string | null;
  madeInactiveAt: string | null;
  madeInactiveReason: string | null;
  currentState: string;
  currentContext: object;
  userId: string;
  order: number | null;
  appState: string | null;
  twilioCompositionSid: string | null;
  twilioCompositionStatus: string | null;
  user: User;
};

export type BattleWithParticipants = Battle & {
  participants: Array<Omit<BattleParticipant, 'battleId'>>;
};

export type BattleBeat = {
  id: string;
  beatKey: string;
  beatUrl: string;
};

export function BattleDataModel() {
  const fetchPageOfData = useCallback(async (
    page: number,
    filters: Array<[Filter['name'], Filter['state']]>,
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
      // updateItem={updateItem}
      // deleteItem={deleteItem}

      keyGenerator={battle => battle.id}
      detailLinkGenerator={battle => ({ type: 'href' as const, href: `/admin/barz/battles/${battle.id}` })}
      createLink={{ type: 'href', href: `/admin/barz/battles/new` }}
      listLink={{ type: 'href', href: `/admin/barz/battles` }}
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
      <SingleForeignKeyField<BattleWithParticipants, 'beatId', BattleBeat, true>
        name="beatId"
        singularDisplayName="Beat"
        pluralDisplayName="Beats"
        columnWidth="165px"
        nullable
        sortable

        relatedName="battleBeat"

        getInitialStateFromItem={battle => battle.beatId ? ({ type: 'KEY_ONLY', key: battle.beatId }) : null}
        getInitialStateWhenCreating={() => null}
        serializeStateToItem={(initialItem, beat) => ({ ...initialItem, beatId: beat ? beat.id : null })}
      />
      {/* <Field<BattleWithParticipants, 'participants', BattleWithParticipants['participants']> */}
      {/*   name="participants" */}
      {/*   singularDisplayName="Participants" */}
      {/*   pluralDisplayName="Participants" */}
      {/*   columnWidth="165px" */}
      {/*   getInitialStateFromItem={battle => battle.participants} */}
      {/*   injectAsyncDataIntoInitialStateOnDetailPage={async state => state} */}
      {/*   serializeStateToItem={(initialItem) => initialItem} */}
      {/*   csvExportData={state => state.map(p => p.id).join(', ')} */}
      {/*   displayMarkup={state => <div style={{display: 'flex', flexDirection: 'column', gap: 4}}> */}
      {/*     {state.map((participant) => ( */}
      {/*       <div key={participant.id} style={{display: 'flex', alignItems: 'center', gap: 4}}> */}
      {/*         <div style={{display: 'flex', gap: 4}}> */}
      {/*           {participant.user.profileImageUrl ? ( */}
      {/*             <img src={participant.user.profileImageUrl} style={{width: 20, height: 20, borderRadius: 4}} /> */}
      {/*           ) : ( */}
      {/*             <div style={{width: 20, height: 20, backgroundColor: '#ddd', borderRadius: 4}} /> */}
      {/*           )} */}
      {/*           {participant.user.handle ? ( */}
      {/*             <small>{participant.user.handle}</small> */}
      {/*           ) : ( */}
      {/*             <small><small>{participant.user.id}</small></small> */}
      {/*           )} */}
      {/*         </div> */}
      {/*       </div> */}
      {/*     ))} */}
      {/*   </div>} */}
      {/*   // Note: No custom `modifyMarkup`, so `displayMarkup` is used on the detail page too! */}
      {/* /> */}

      <MultiForeignKeyField<BattleWithParticipants, 'participants', BattleParticipant>
        name="participants"
        singularDisplayName="Participants"
        pluralDisplayName="Participants"
        columnWidth="165px"

        relatedName="battleParticipant"

        getInitialStateFromItem={battle => ({
          type: 'FULL',
          item: battle.participants.map(p => ({ ...p, battleId: battle.id })),
        })}
        displayMarkup={state => {
          if (state.type !== 'FULL') {
            return null;
          }

          return (
            <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
              {state.item.map((participant) => (
                <div key={participant.id} style={{display: 'flex', alignItems: 'center', gap: 4}}>
                  <div style={{display: 'flex', gap: 4}}>
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
                  </div>
                </div>
              ))}
            </div>
          );
        }}
      />
    </DataModel>
  );
}

export function BattleBeatDataModel() {
  const fetchPageOfData = useCallback(async (
    page: number,
    _filters: any,
    _sort: Sort | null,
    _searchText: string,
    signal: AbortSignal
  ) => {
    // console.log('REQUEST:', page, filters, sort, searchText);
    const qs = new URLSearchParams();
    qs.set('page', `${page}`);

    const response = await fetch(`https://api-staging.rapbattleapp.com/v1/beats/precached?${qs.toString()}`, {
      signal,
      headers: {
        // 'Authorization': `Bearer ${await getToken()}`,
      },
    });
    // const response = await fetch(`http://localhost:8000/v1/beats/precached?${qs.toString()}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching beats: received ${response.status} ${await response.text()}`)
    }

    const body = await response.json();

    return {
      nextPageAvailable: Boolean(body.next),
      totalCount: body.total,
      data: body.results,
    };
  }, []);

  const fetchItem = useCallback(async (itemKey: string, signal: AbortSignal) => {
    const battleResponse = await fetch(`https://api-staging.rapbattleapp.com/v1/battles?filter={"beatId":"${itemKey}"}&pageSize=1`, { signal });
    if (!battleResponse.ok) {
      throw new Error(`Error fetching battle with beat with id ${itemKey}: received ${battleResponse.status} ${await battleResponse.text()}`)
    }
    const battlesResponse: { results: Array<BattleWithParticipants> } = await battleResponse.json();

    const response = await fetch(`https://api-staging.rapbattleapp.com/v1/battles/${battlesResponse.results[0].id}/beat`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching beat for ${battlesResponse.results[0].id}: received ${response.status} ${await response.text()}`)
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

      keyGenerator={beat => beat.id}

      // Note that there is not a list / detail page for this data model, so no `details...` link
      // renders for each row in app
    >
      <Field<BattleBeat, 'id', string>
        name="id"
        singularDisplayName="Id"
        pluralDisplayName="Ids"
        getInitialStateFromItem={beat => beat.id}
        injectAsyncDataIntoInitialStateOnDetailPage={async state => state}
        serializeStateToItem={(item) => item}
        displayMarkup={state => <span>{state}</span>}
      />
      <InputField<BattleBeat, 'beatKey'>
        name="beatKey"
        singularDisplayName="Beat Key"
        pluralDisplayName="Beat Keys"
        getInitialStateFromItem={beat => beat.beatKey}
        getInitialStateWhenCreating={() => ''}
        serializeStateToItem={(initialItem, state) => ({ ...initialItem, beatKey: state })}
      />
    </DataModel>
  );
}

export function BattleParticipantDataModel() {
  const fetchPageOfData = useCallback(async (
    page: number,
    filters: Array<[Filter['name'], Filter['state']]>,
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

    const response = await fetch(`https://api-staging.rapbattleapp.com/v1/participants?${qs.toString()}`, {
      signal,
      headers: {
        // 'Authorization': `Bearer ${await getToken()}`,
      },
    });
    // const response = await fetch(`http://localhost:8000/v1/participants?${qs.toString()}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching battle participants: received ${response.status} ${await response.text()}`)
    }

    const body = await response.json();

    return {
      nextPageAvailable: Boolean(body.next),
      totalCount: body.total,
      data: body.results,
    };
  }, []);

  const fetchItem = useCallback(async (itemKey: string, signal: AbortSignal) => {
    // const response = await fetch(`https://api-staging.rapbattleapp.com/v1/participants/${itemKey}`, { signal });
    // if (!response.ok) {
    //   throw new Error(`Error fetching battle participant with id ${itemKey}: received ${response.status} ${await response.text()}`)
    // }

    // return response.json();

    const qs = new URLSearchParams();
    qs.set('pageSize', '1');
    qs.set('filters', JSON.stringify({ id: itemKey }));

    const response = await fetch(`https://api-staging.rapbattleapp.com/v1/participants?${qs.toString()}`, {
      signal,
      headers: {
        // 'Authorization': `Bearer ${await getToken()}`,
      },
    });
    // const response = await fetch(`http://localhost:8000/v1/participants?${qs.toString()}`, { signal });
    if (!response.ok) {
      throw new Error(`Error fetching battle participant ${itemKey}: received ${response.status} ${await response.text()}`)
    }

    const body = await response.json();
    return body.results[0];
  }, []);

  const updateItem = useCallback(async (itemKey: string, updateData: Partial<BattleParticipant>, signal: AbortSignal) => {
    const response = await fetch(`https://api-staging.rapbattleapp.com/v1/participants/${itemKey}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Error updating battle participant ${itemKey}: received ${response.status} ${await response.text()}`)
    }

    return response.json();
  }, []);

  return (
    <DataModel<BattleParticipant>
      name="battleParticipant"
      singularDisplayName="Battle Participant"
      pluralDisplayName="Battle Participants"

      fetchPageOfData={fetchPageOfData}
      fetchItem={fetchItem}
      updateItem={updateItem}

      keyGenerator={participant => participant.id}
      detailLinkGenerator={participant => ({ type: 'href' as const, href: `/admin/barz/battle-participants/${participant.id}` })}
      // listLink={{ type: 'href', href: `/admin/barz/battles` }}
    >
      <Field<BattleParticipant, 'id', string>
        name="id"
        singularDisplayName="Id"
        pluralDisplayName="Ids"
        columnWidth="250px"
        getInitialStateFromItem={participant => participant.id}
        injectAsyncDataIntoInitialStateOnDetailPage={async state => state}
        serializeStateToItem={(item) => item}
        displayMarkup={state => <span>{state}</span>}
      />
      <InputField<BattleParticipant, 'createdAt'>
        name="createdAt"
        singularDisplayName="Created At"
        pluralDisplayName="Created Ats"
        sortable
        getInitialStateWhenCreating={() => new Date().toISOString()}
      />
      <InputField<BattleParticipant, 'updatedAt'>
        name="updatedAt"
        singularDisplayName="Updated At"
        pluralDisplayName="Updated Ats"
        sortable
        getInitialStateWhenCreating={() => new Date().toISOString()}
      />
      <InputField<BattleParticipant, 'userId'>
        name="userId"
        singularDisplayName="User ID"
        pluralDisplayName="User IDs"
        sortable
      />
      <NumberField<BattleParticipant, 'userComputedScoreAtBattleCreatedAt'>
        name="userComputedScoreAtBattleCreatedAt"
        singularDisplayName="User Computed Score (at created)"
        pluralDisplayName="User Computed Score (at created)"
        sortable
      />
      <InputField<BattleParticipant, 'appState', true>
        name="appState"
        singularDisplayName="App State"
        pluralDisplayName="App States"
        sortable
        nullable
      />
      <InputField<BattleParticipant, 'appStateLastChangedAt', true>
        name="appStateLastChangedAt"
        singularDisplayName="App State Last Changed At"
        pluralDisplayName="App State Last Changed Ats"
        sortable
        nullable
      />

      <InputField<BattleParticipant, 'associatedWithBattleAt'>
        name="associatedWithBattleAt"
        singularDisplayName="Associated With Battle At"
        pluralDisplayName="Associated With Battle Ats"
        sortable
      />

      {/* <InputField<BattleParticipant, 'battleId'> */}
      {/*   name="battleId" */}
      {/*   singularDisplayName="Battle Id" */}
      {/*   pluralDisplayName="Battle Id" */}
      {/*   sortable */}
      {/* /> */}

      <BooleanField<BattleParticipant, 'computedDidWinOrTieBattle'>
        name="computedDidWinOrTieBattle"
        singularDisplayName="Computed Did Win Or Tie Battle"
        pluralDisplayName="Computed Did Win Or Tie Battles"
        sortable
        getInitialStateWhenCreating={() => false}
      />

      <ChoiceField<BattleParticipant, 'connectionStatus', BattleParticipant['connectionStatus']>
        name="connectionStatus"
        singularDisplayName="Connection Status"
        pluralDisplayName="Connection Statuss"
        sortable
        choices={[
          {id: 'ONLINE', label: 'Online'},
          {id: 'OFFLINE', label: 'Offline'},
          {id: 'UNKNOWN', label: 'Unknown'},
        ]}
        getInitialStateWhenCreating={() => 'ONLINE'}
      />

      <JSONField<BattleParticipant, 'currentContext'>
        name="currentContext"
        singularDisplayName="Current Context"
        pluralDisplayName="Current Contexts"
        sortable
      />

      <InputField<BattleParticipant, 'currentState'>
        name="currentState"
        singularDisplayName="Current State"
        pluralDisplayName="Current States"
        sortable
      />

      <InputField<BattleParticipant, 'forfeitedAt', true>
        name="forfeitedAt"
        singularDisplayName="Forfeited At"
        pluralDisplayName="Forfeited Ats"
        sortable
        nullable
      />

      <BooleanField<BattleParticipant, 'initialMatchFailed'>
        name="initialMatchFailed"
        singularDisplayName="Initial Match Failed"
        pluralDisplayName="Initial Match Faileds"
        sortable
        getInitialStateWhenCreating={() => false}
      />

      <InputField<BattleParticipant, 'madeInactiveAt', true>
        name="madeInactiveAt"
        singularDisplayName="Made Inactive At"
        pluralDisplayName="Made Inactive Ats"
        sortable
        nullable
      />

      <InputField<BattleParticipant, 'madeInactiveReason', true>
        name="madeInactiveReason"
        singularDisplayName="Made Inactive Reason"
        pluralDisplayName="Made Inactive Reasons"
        sortable
        nullable
      />

      <ChoiceField<BattleParticipant, 'matchingAlgorithm', 'DEFAULT' | 'RANDOM'>
        name="matchingAlgorithm"
        singularDisplayName="Matching Algorithm"
        pluralDisplayName="Matching Algorithms"
        sortable
        choices={[
          {id: 'DEFAULT', label: 'Default'},
          {id: 'RANDOM', label: 'Random'},
        ]}
        getInitialStateWhenCreating={() => 'DEFAULT'}
      />

      <InputField<BattleParticipant, 'matchingStartedAt', true>
        name="matchingStartedAt"
        singularDisplayName="Matching Started At"
        pluralDisplayName="Matching Started Ats"
        sortable
        nullable
      />

      <NumberField<BattleParticipant, 'order'>
        name="order"
        singularDisplayName="Order"
        pluralDisplayName="Orders"
        sortable
      />

      <InputField<BattleParticipant, 'processedVideoCompletedAt', true>
        name="processedVideoCompletedAt"
        singularDisplayName="Processed Video Completed At"
        pluralDisplayName="Processed Video Completed Ats"
        sortable
        nullable
      />

      <InputField<BattleParticipant, 'processedVideoKey', true>
        name="processedVideoKey"
        singularDisplayName="Processed Video Key"
        pluralDisplayName="Processed Video Keys"
        sortable
        nullable
      />

      <InputField<BattleParticipant, 'processedVideoOffsetMilliseconds', true>
        name="processedVideoOffsetMilliseconds"
        singularDisplayName="Processed Video Offset Milliseconds"
        pluralDisplayName="Processed Video Offset Milliseconds"
        sortable
        nullable
      />

      <InputField<BattleParticipant, 'processedVideoQueuedAt', true>
        name="processedVideoQueuedAt"
        singularDisplayName="Processed Video Queued At"
        pluralDisplayName="Processed Video Queued Ats"
        sortable
        nullable
      />

      <InputField<BattleParticipant, 'processedVideoStartedAt', true>
        name="processedVideoStartedAt"
        singularDisplayName="Processed Video Started At"
        pluralDisplayName="Processed Video Started Ats"
        sortable
        nullable
      />

      <InputField<BattleParticipant, 'processedVideoStatus', true>
        name="processedVideoStatus"
        singularDisplayName="Processed Video Status"
        pluralDisplayName="Processed Video Status"
        sortable
        nullable
      />

      <InputField<BattleParticipant, 'readyForBattleAt', true>
        name="readyForBattleAt"
        singularDisplayName="Ready For Battle At"
        pluralDisplayName="Ready For Battle Ats"
        sortable
        nullable
      />

      <ChoiceField<BattleParticipant, 'requestedBattlePrivacyLevel', BattleParticipant['requestedBattlePrivacyLevel'], true>
        name="requestedBattlePrivacyLevel"
        singularDisplayName="Requested Battle Privacy Level"
        pluralDisplayName="Requested Battle Privacy Levels"
        sortable
        nullable
        choices={[
          {id: 'PUBLIC', label: 'Public'},
          {id: 'PRIVATE', label: 'Private'},
        ]}
        getInitialStateWhenCreating={() => 'PRIVATE'}
      />

      <InputField<BattleParticipant, 'twilioAudioRecordingId', true>
        name="twilioAudioRecordingId"
        singularDisplayName="Twilio Audio Recording Id"
        pluralDisplayName="Twilio Audio Recording Ids"
        sortable
        nullable
      />

      <InputField<BattleParticipant, 'twilioAudioTrackId', true>
        name="twilioAudioTrackId"
        singularDisplayName="Twilio Audio Track Id"
        pluralDisplayName="Twilio Audio Track Ids"
        sortable
        nullable
      />

      <InputField<BattleParticipant, 'twilioDataTrackId', true>
        name="twilioDataTrackId"
        singularDisplayName="Twilio Data Track Id"
        pluralDisplayName="Twilio Data Track Ids"
        sortable
        nullable
      />

      <InputField<BattleParticipant, 'twilioVideoRecordingId', true>
        name="twilioVideoRecordingId"
        singularDisplayName="Twilio Video Recording Id"
        pluralDisplayName="Twilio Video Recording Ids"
        sortable
        nullable
      />

      <InputField<BattleParticipant, 'twilioVideoTrackId', true>
        name="twilioVideoTrackId"
        singularDisplayName="Twilio Video Track Id"
        pluralDisplayName="Twilio Video Track Ids"
        sortable
        nullable
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
          <BattleDataModel />
          <BattleBeatDataModel />
          <BattleParticipantDataModel />

          {children}
        </DataModels>
      </AdminContextProvider>
    </div>
  );
}

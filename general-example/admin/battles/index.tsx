import { Fragment } from 'react';

import { BattleWithParticipants } from '@/types';
import AllDataModels from '@/datamodels';
import {
  List,
  ListTable,
  ListActionBar,
  ListFilterBar,
  StringFilterDefinition,
  FilterDefinition,
} from '@/admin';

// import { BattleParticipantFields } from '../battle-participants';

const PRISMA_BASE_OPERATIONS = [
  'equals',
  'lt',
  'gt',
  'gte',
  'contains',
  'startsWith',
  'endsWith',
];

export default function Page() {
  return (
    <AllDataModels>
      <List<BattleWithParticipants> name="battle" checkable>
        <ListFilterBar searchable>
          {[
            'createdAt',
            'updatedAt',
            'startedAt',
            'completedAt',
            'madeInactiveAt',
            'madeInactiveReason',
            'numberOfRounds',
            'turnLengthSeconds',
            'warmupLengthSeconds',
            'twilioRoomName',
          ].map(field => (
            <Fragment key={field}>
              {PRISMA_BASE_OPERATIONS.flatMap(o => [[o], ['not', o]]).map((keys, index) => (
                <StringFilterDefinition
                  key={index}
                  name={[field, ...keys]}
                />
                // <FilterDefinition<string>
                //   key={index}
                //   name={[field, ...keys]}
                //   getInitialState={() => ""}
                //   onIsComplete={state => state.length > 0}
                //   onIsValid={state => state.length > 0}
                //   serialize={state => state}
                //   deserialize={state => state}
                // >
                //   {(state, setState, filter, onBlur) => (
                //     <input
                //       type="text"
                //       value={state}
                //       onChange={(e) => setState(e.currentTarget.value)}
                //       onBlur={() => onBlur()}
                //       style={{border: !filter.isValid ? '1px solid red' : ''}}
                //     />
                //   )}
                // </FilterDefinition>
              ))}
              {[["in"], ["not", "in"]].map((keys, index) => (
                <FilterDefinition<Array<string>>
                  key={index}
                  name={[field, ...keys]}
                  getInitialState={() => []}
                  onIsComplete={_state => true}
                  onIsValid={_state => true}
                  serialize={state => state.join(',')}
                  deserialize={raw => raw.split(',')}
                >
                  {(state, setState, filter, onBlur) => (
                    <input
                      type="text"
                      value={state.join(',')}
                      onChange={(e) => setState(e.currentTarget.value.split(','))}
                      onBlur={() => onBlur()}
                      style={{border: !filter.isValid ? '1px solid red' : ''}}
                    />
                  )}
                </FilterDefinition>
              ))}
            </Fragment>
          ))}

          {/*
          <FilterDefinition<string>
            name={["One deep"]}
            getInitialState={() => ""}
            onIsComplete={state => state.length > 0}
            onIsValid={state => state.length > 3}
            serialize={state => state}
            deserialize={state => state}
          >
            {(state, setState, filter, onBlur) => (
              <input style={{border: !filter.isValid ? '1px solid red' : ''}} type="text" value={state} onChange={(e) => setState(e.currentTarget.value)} onBlur={() => onBlur()} />
            )}
          </FilterDefinition>
          <FilterDefinition<string>
            name={["Another", "greater than"]}
            getInitialState={() => ""}
            onIsComplete={state => state.length > 0}
            onIsValid={state => true}
          >
            {(state, setState, filter, onBlur) => (
              <input type="text" value={state} onChange={(e) => setState(e.currentTarget.value)} onBlur={() => onBlur()} />
            )}
          </FilterDefinition>
          <FilterDefinition<string>
            name={["Made Inactive Reason", "equals"]}
            getInitialState={() => ""}
            onIsComplete={state => state.length > 0}
            onIsValid={state => true}
          >
            {(state, setState, filter, onBlur) => (
              <input type="text" value={state} onChange={(e) => setState(e.currentTarget.value)} onBlur={() => onBlur()} />
            )}
          </FilterDefinition>
          <FilterDefinition<string>
            name={["Made Inactive Reason", "greater than"]}
            getInitialState={() => ""}
            onIsComplete={state => state.length > 0}
            onIsValid={state => true}
          >
            {(state, setState, filter, onBlur) => (
              <input style={{border: !filter.isValid ? '1px solid red' : ''}} type="text" value={state} onChange={(e) => setState(e.currentTarget.value)} onBlur={() => onBlur()} />
            )}
          </FilterDefinition>
          */}
        </ListFilterBar>
        <ListActionBar<BattleWithParticipants>
          // canSelectAllAcrossPages
        >
          {checkedItems => (
            <div style={{ display: 'flex', gap: 8}}>
              <button onClick={() => alert(checkedItems === 'all' ? 'all' : checkedItems.map(i => i.id).join(','))}>Bulk action a</button>
            </div>
          )}
        </ListActionBar>
        <ListTable
          detailLinkColumnWidth={100}
        />
      </List>
    </AllDataModels>
  );
}

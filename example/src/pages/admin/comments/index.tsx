import { Fragment } from 'react';

import AllDataModels, { Comment } from '@/datamodels';
import {
  List,
  ListTable,
  ListActionBar,
  ListFilterBar,
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
      <List<Comment> name="comment" checkable>
        <ListFilterBar searchable>
          {[
            'id',
            'body',
          ].map(field => (
            <FilterDefinition<string>
              key={field}
              name={[field]}
              getInitialState={() => ""}
              onIsComplete={state => state.length > 0}
              onIsValid={state => state.length > 0}
              serialize={state => state}
              deserialize={state => state}
            >
              {(state, setState, filter, onBlur) => (
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.currentTarget.value)}
                  onBlur={() => onBlur()}
                  style={{border: !filter.isValid ? '1px solid red' : ''}}
                />
              )}
            </FilterDefinition>
          ))}
        </ListFilterBar>
        <ListTable
          detailLinkColumnWidth={100}
        />
      </List>
    </AllDataModels>
  );
}

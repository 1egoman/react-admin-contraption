import AllDataModels, { User } from '@/datamodels';
import {
  List,
  ListTable,
  ListActionBar,
  ListFilterBar,
  FilterDefinition,
} from '@/admin';

export default function Page() {
  return (
    <AllDataModels>
      <List<User> name="user" checkable>
        <ListFilterBar searchable>
          {[
            'id',
            'userId',
            'title',
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
        <ListActionBar<User>
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

import AllDataModels, { User } from '@/datamodels/rest-example';
import {
  List,
  ListTable,
  ListActionBar,
  ListFilterBar,
  StringFilterDefinition,
} from '@/admin';

export default function Page() {
  return (
    <AllDataModels>
      <List<User> name="user" checkable>
        <ListFilterBar searchable>
          {[
            'id',
            'name',
            'username',
            'email',
            'phone',
            'website',
          ].map(field => (
            <StringFilterDefinition
              key={field}
              name={[field]}
            />
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

import AllDataModels, { Post } from '@/datamodels';
import {
  List,
  ListTable,
  ListActionBar,
  ListFilterBar,
  FilterDefinition,
  StringFilterDefinition,
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
      <List<Post> name="post" checkable>
        <ListFilterBar searchable>
          {[
            'id',
            'userId',
            'title',
            'body',
          ].map(field => (
            <StringFilterDefinition
              key={field}
              name={[field]}
            />
          ))}
        </ListFilterBar>
        <ListActionBar<Post>
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
          columnSets={{ "foo": ["id", "body"] }}
        />
      </List>
    </AllDataModels>
  );
}

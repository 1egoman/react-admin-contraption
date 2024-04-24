import AllDataModels, { Comment } from '@/datamodels/rest-example';
import {
  List,
  ListTable,
  ListFilterBar,
  StringFilterDefinition,
} from '@/admin';

export default function Page() {
  return (
    <AllDataModels>
      <List<Comment> name="comment" checkable>
        <ListFilterBar searchable>
          {[
            'id',
            'body',
          ].map(field => (
            <StringFilterDefinition
              key={field}
              name={[field]}
            />
          ))}
        </ListFilterBar>
        <ListTable
          detailLinkColumnWidth={100}
        />
      </List>
    </AllDataModels>
  );
}

import AllDataModels, { User } from '@/datamodels/filteroff';
import {
  List,
  ListTable,
  ListActionBar,
  ListFilterBar,
  StringFilterDefinition,
} from '@/admin';
import { useControls } from '@/admin/controls';

export default function Page() {
  // In a real project you probably wouldn't use this internal `useControls` hook in the admin code
  // I am using it just to make some controls match the broader control style
  //
  // Instead, you'd probably override the controls on the root `AdminProviderContext` (which injects
  // them into the admin code) and just use those directly
  const Controls = useControls();

  return (
    <AllDataModels>
      <List<User> name="user" checkable>
        <ListFilterBar
          searchable
          filterPresets={{
            // Filter presets can clear all the filters
            all: () => [],

            // Filter presets can just completely replace filters:
            online: () => [
              {name: ["is_active"], isComplete: true, isValid: true, workingState: "true", state: true }
            ],

            // Filter presets can add filters to the list:
            newToday: (existingFilters) => [
              ...existingFilters,
              {name: ["last_seen_lt"], isComplete: true, isValid: true, workingState: new Date(new Date().getTime() - 100000).toISOString(), state: "TBD" }
            ],

            // Or they can be no-ops if you have a rest api backing an example that doesn't have
            // very robust filtering support :)
            last24: (old) => old,
            clients: (old) => old,
            dateNight: (old) => old,
            deleted: (old) => old,
          }}
        >
          {[
            'id',
            'provider',
            'uid',
            'name',
            'email',
            'profile_picture_url',
            'gender',
            'age',
            'radius',
            'age_min',
            'age_max',
            'bio',
            'time_zone',
            'is_active',
            'created_at',
            'updated_at',
            'last_seen',
            'last_seen_lt',
            'referral_code',
            'referred_by_id',
            'birthday',
            'send_calendar_date_invites',
            'notice',
          ].map(field => (
            <StringFilterDefinition
              key={field}
              name={[field]}
            />
          ))}
        </ListFilterBar>
        <ListActionBar<User>>
          {checkedItems => (
            <div style={{ display: 'flex', gap: 8}}>
              <Controls.Button
                onClick={() => alert(checkedItems === 'all' ? 'all' : checkedItems.map(i => i.id).join(','))}
              >Export</Controls.Button>
              <Controls.Button
                onClick={() => alert(checkedItems === 'all' ? 'all' : checkedItems.map(i => i.id).join(','))}
              >Send Push</Controls.Button>
              <Controls.Button
                onClick={() => alert(checkedItems === 'all' ? 'all' : checkedItems.map(i => i.id).join(','))}
              >Send SMS</Controls.Button>
              <Controls.Button
                onClick={() => alert(checkedItems === 'all' ? 'all' : checkedItems.map(i => i.id).join(','))}
              >Force Delete</Controls.Button>
              <Controls.Button
                onClick={() => alert(checkedItems === 'all' ? 'all' : checkedItems.map(i => i.id).join(','))}
              >Verify</Controls.Button>
              <Controls.Button
                onClick={() => alert(checkedItems === 'all' ? 'all' : checkedItems.map(i => i.id).join(','))}
              >Scammer</Controls.Button>
              <Controls.Button
                onClick={() => alert(checkedItems === 'all' ? 'all' : checkedItems.map(i => i.id).join(','))}
              >Suspicious</Controls.Button>
              <Controls.Button
                onClick={() => alert(checkedItems === 'all' ? 'all' : checkedItems.map(i => i.id).join(','))}
              >Put in Dating Pool</Controls.Button>
            </div>
          )}
        </ListActionBar>
        <ListTable
          detailLinkColumnWidth={100}
          columnSets={{
            all: ["id", "profile_picture_url", "name", "time_zone", "email", "gender", "show_me", "age", "location", "ip_geo"],
          }}
        />
      </List>
    </AllDataModels>
  );
}

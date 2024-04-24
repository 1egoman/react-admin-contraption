import { Fragment } from 'react';
import { useRouter } from 'next/router';

import AllDataModels, { User } from '@/datamodels/filteroff';

import { Detail, DetailFields, useDetailDataContext } from '@/admin';
import { useControls } from '@/admin/controls';

const CustomCardThing: React.FunctionComponent<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ border: '1px solid black', display: 'flex', flexDirection: 'column', gap: 8, flexGrow: 1, flexShrink: 1 }}>
    <div style={{ padding: 8, fontWeight: 'bold' }}>{title}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
  </div>
);

function CustomStuff() {
  const dataContext = useDetailDataContext<User>();

  if (dataContext.detailData.status !== 'COMPLETE') {
    return null;
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'row', gap: 16 }}>
      <CustomCardThing title="Gallery">
        <img src={dataContext.detailData.data.profile_picture_url} style={{ width: 128, height: 128 }}/>
        <span>face detected</span>
      </CustomCardThing>
      <CustomCardThing title="Originals">
        <table style={{ padding: 8 }}>
          <tr>
            <th align="left">Id</th>
            <th align="left">Text Response</th>
            <th align="left">Type Of</th>
            <th align="left">Cover</th>
          </tr>
          <tr>
            <td>I do</td>
            <td>not know</td>
            <td>what goes</td>
            <td>here</td>
          </tr>
        </table>
      </CustomCardThing>
      <CustomCardThing title="Scam Check">
        <table style={{ padding: 8 }}>
          <tr>
            <th align="left">Id</th>
            <th align="left">Text Response</th>
            <th align="left">Type Of</th>
            <th align="left">Cover</th>
          </tr>
          <tr>
            <td>I do</td>
            <td>not know</td>
            <td>what goes</td>
            <td>here</td>
          </tr>
        </table>
      </CustomCardThing>
    </div>
  );
}

export default function Page() {
  // In a real project you probably wouldn't use this internal `useControls` hook in the admin code
  // I am using it just to make some controls match the broader control style
  //
  // Instead, you'd probably override the controls on the root `AdminProviderContext` (which injects
  // them into the admin code) and just use those directly
  const Controls = useControls();

  const router = useRouter();
  const id = router.query.id ? `${router.query.id}` : null;
  if (!id) {
    return null;
  }

  return (
    <AllDataModels>
      <Detail<User>
        name="user"
        itemKey={id === 'new' ? undefined : id}
        title={item => item.name}
        actions={user => (
          <Fragment>
            <Controls.Button onClick={() => alert(`Click ${user.id}!`)}>Algo</Controls.Button>
            <Controls.Button onClick={() => alert(`Click ${user.id}!`)}>Force Delete</Controls.Button>
            <Controls.Button onClick={() => alert(`Click ${user.id}!`)}>Ban</Controls.Button>
            <Controls.Button onClick={() => alert(`Click ${user.id}!`)}>Mixpanel</Controls.Button>
            <Controls.Button onClick={() => alert(`Click ${user.id}!`)}>Verify</Controls.Button>
            <Controls.Button onClick={() => alert(`Click ${user.id}!`)}>Client</Controls.Button>
            <Controls.Button onClick={() => alert(`Click ${user.id}!`)}>+ Matchmaker pro</Controls.Button>
            <Controls.Button onClick={() => alert(`Click ${user.id}!`)}>- Matchmaker pro</Controls.Button>
            <Controls.Button onClick={() => alert(`Click ${user.id}!`)}>Scammer</Controls.Button>
            <Controls.Button onClick={() => alert(`Click ${user.id}!`)}>Lookup</Controls.Button>
          </Fragment>
        )}
      >
        <CustomStuff />
        <DetailFields />
      </Detail>
    </AllDataModels>
  );
}

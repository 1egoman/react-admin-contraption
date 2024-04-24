import Link from 'next/link';

export default function Page() {
  return (
    <div>
      <h1>Admin demos</h1>
      <ul style={{ paddingLeft: 24, paddingTop: 8 }}>
        <li>
          <Link
            href="/admin/rest-example"
            style={{ color: "var(--blue-10)", textDecoration: 'underline' }}
          >Post/User/Comment example admin</Link>
        </li>
        <li>
          <Link
            href="/admin/barz"
            style={{ color: "var(--blue-10)", textDecoration: 'underline' }}
          >Barz example admin</Link>
        </li>
        <li>
          <Link
            href="/admin/filteroff"
            style={{ color: "var(--blue-10)", textDecoration: 'underline' }}
          >Filteroff example admin</Link>
        </li>
      </ul>
    </div>
  );
}

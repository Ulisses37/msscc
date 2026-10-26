import type { Metadata } from 'next';

import SubscribeConfirmStatus from './SubscribeConfirmStatus';

// Not linked from any navigation and not indexed: this is a one-time token
// landing page reached only from a confirmation email. `referrer: 'no-referrer'`
// keeps the token out of the Referer header of any request the page makes.
export const metadata: Metadata = {
  title: 'Confirm your subscription | MSSCC',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function SubscribeConfirmPage({
  searchParams,
}: {
  searchParams: { token?: string | string[] };
}) {
  // A repeated query key is invalid, so only a single string is usable.
  const token = searchParams.token;
  return (
    <SubscribeConfirmStatus token={typeof token === 'string' ? token : ''} />
  );
}

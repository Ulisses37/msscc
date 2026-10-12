import { MembershipPaymentResult } from '@/components/membership/MembershipPaymentResult';

export default function MembershipPaymentResultPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { confirmation_reference?: string | string[] };
}) {
  // Ignore Stripe's extra return parameters: only our own opaque reference is
  // needed to read the verified status, and a repeated query key is invalid.
  const reference = searchParams.confirmation_reference;
  return (
    <MembershipPaymentResult
      locale={params.locale}
      confirmationReference={typeof reference === 'string' ? reference : ''}
    />
  );
}
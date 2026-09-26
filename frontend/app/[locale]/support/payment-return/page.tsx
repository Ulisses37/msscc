export default function PaymentReturnPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="mb-4 text-3xl font-bold text-slate-800">
        Payment Submitted
      </h1>

      <p className="mb-8 text-slate-600">
        Thank you. Your payment was submitted and is being processed.
      </p>

      <a
        href="../"
        className="inline-block rounded-md bg-pink-700 px-5 py-3 font-semibold text-white hover:bg-pink-800"
      >
        Return to Support
      </a>
    </main>
  );
}
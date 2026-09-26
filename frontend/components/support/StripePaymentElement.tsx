"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { loadStripe } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";

interface StripePaymentElementProps {
  clientSecret: string;
  email: string;
}

interface CheckoutPaymentFormProps {
  email: string;
}

// Load Stripe once instead of creating a new Stripe instance every time
// the component renders.
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

function CheckoutPaymentForm({ email }: CheckoutPaymentFormProps) {
  const t = useTranslations("SupportPage");
  const checkoutState = useCheckoutElements();

  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");

  // Checkout is only available after Stripe has successfully initialized.
  // Defining it here also allows the email synchronization effect to run
  // before the confirmation button is enabled.
  const checkout =
    checkoutState.type === "success" ? checkoutState.checkout : null;

  useEffect(() => {
    if (!checkout) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      return;
    }

    let isCancelled = false;

    const syncEmailWithStripe = async () => {
      try {
        /*
         * Stripe needs the customer's email before checkout.canConfirm can
         * become true. Previously, the email was only supplied inside
         * checkout.confirm(), but that method could not be reached because
         * the button was disabled while canConfirm was false.
         */
        const result = await checkout.updateEmail(normalizedEmail);

        if (!isCancelled && result.type === "error") {
          setConfirmationError(
            result.error.message || t("paymentConfirmationError")
          );
        }
      } catch {
        if (!isCancelled) {
          setConfirmationError(t("paymentConfirmationError"));
        }
      }
    };

    void syncEmailWithStripe();

    // Prevent an outdated request from updating state if this component
    // unmounts before Stripe responds.
    return () => {
      isCancelled = true;
    };
  }, [checkout, email, t]);

  if (checkoutState.type === "loading") {
    return (
      <div className="py-4 text-center text-sm text-gray-600">
        Loading secure payment form...
      </div>
    );
  }

  if (checkoutState.type === "error") {
    return (
      <p className="mt-3 text-sm text-red-600" role="alert">
        {checkoutState.error.message || t("paymentConfirmationError")}
      </p>
    );
  }

  if (!checkout) {
    return (
      <p className="mt-3 text-sm text-red-600" role="alert">
        {t("paymentConfirmationError")}
      </p>
    );
  }

  const handleConfirmPayment = async () => {
    // Prevent confirmation until Stripe reports that all required payment
    // information has been entered.
    if (!checkout.canConfirm || isConfirming) {
      return;
    }

    setIsConfirming(true);
    setConfirmationError("");

    try {
      const result = await checkout.confirm({
        email: email.trim().toLowerCase(),
      });

      /*
       * Successful confirmation normally redirects the user to the return
       * URL supplied when the Checkout Session was created. Therefore, an
       * error only needs to be displayed if Stripe returns an error result.
       */
      if (result.type === "error") {
        setConfirmationError(
          result.error.message || t("paymentConfirmationError")
        );
        setIsConfirming(false);
      }
    } catch {
      setConfirmationError(t("paymentConfirmationError"));
      setIsConfirming(false);
    }
  };

  return (
    <div>
      <PaymentElement
        options={{
          layout: "accordion",
        }}
      />

      {confirmationError && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {confirmationError}
        </p>
      )}

      <button
        type="button"
        onClick={handleConfirmPayment}
        disabled={!checkout.canConfirm || isConfirming}
        className="mt-5 w-full rounded-md bg-pink-700 px-4 py-3 font-semibold text-white transition-colors hover:bg-pink-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
      >
        {isConfirming ? "Confirming Donation..." : "Confirm Donation"}
      </button>
    </div>
  );
}

export function StripePaymentElement({
  clientSecret,
  email,
}: StripePaymentElementProps) {
  const t = useTranslations("SupportPage");

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {t("paymentConfirmationError")}
      </p>
    );
  }

  if (!clientSecret) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {t("paymentConfirmationError")}
      </p>
    );
  }

  return (
    <div className="rounded-md border border-slate-300 bg-slate-50 p-3 sm:p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-700">
        <span aria-hidden="true"></span>
        <span>Secure payment powered by Stripe</span>
      </div>

      <CheckoutElementsProvider
        stripe={stripePromise}
        options={{ clientSecret }}
      >
        <CheckoutPaymentForm email={email} />
      </CheckoutElementsProvider>
    </div>
  );
}export default StripePaymentElement;
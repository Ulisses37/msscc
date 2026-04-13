export type DonationRecord = {
  date: string;
  name: string;
  paymentMethod: string;
  frequency: "one-time" | "quarterly" | "annual";
  amount: number;
};

export const sampleDonationData: DonationRecord[] = [
  {
    date: "2026-03-15",
    name: "Alice Johnson",
    paymentMethod: "VISA",
    frequency: "one-time",
    amount: 50,
  },
  {
    date: "2026-03-20",
    name: "Michael Chen",
    paymentMethod: "paypal",
    frequency: "annual",
    amount: 250,
  },
  {
    date: "2026-03-22",
    name: "Sofia Martinez",
    paymentMethod: "debit card",
    frequency: "quarterly",
    amount: 75,
  },
  {
    date: "2026-03-25",
    name: "David Kim",
    paymentMethod: "credit card",
    frequency: "one-time",
    amount: 100,
  },
];

export type MembershipRecord = {
  date: string;
  name: string;
  paymentMethod: string;
  level: "individual" | "corporate" | "student" | "family";
  amount: number;
  status: "active" | "inactive";
};

export const sampleMembershipData: MembershipRecord[] = [
  {
    date: "2026-01-15",
    name: "Jane Doe",
    paymentMethod: "Credit Card",
    level: "individual",
    amount: 50,
    status: "active",
  },
  {
    date: "2026-02-10",
    name: "Global Tech Inc.",
    paymentMethod: "Bank Transfer",
    level: "corporate",
    amount: 250,
    status: "active",
  },
  {
    date: "2026-03-05",
    name: "Alex Nguyen",
    paymentMethod: "Cash",
    level: "student",
    amount: 25,
    status: "inactive",
  },
  {
    date: "2026-03-20",
    name: "Smith Family",
    paymentMethod: "Credit Card",
    level: "family",
    amount: 100,
    status: "active",
  },
];

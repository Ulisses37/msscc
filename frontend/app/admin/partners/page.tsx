'use client';

import { SDProp, SDTable, PartnerTable, PartnerProp } from "./partnersComponents"

const partners: PartnerProp[] = [
  { sdName: "Partner 1", sdDisplayOrder: 1, sdContributionAmount: 1000, sdWebsite: "www.1.com" },
  { sdName: "Partner 2", sdDisplayOrder: 2, sdContributionAmount: 1000, sdWebsite: "www.2.com" },
  { sdName: "Partner 3", sdDisplayOrder: 3, sdContributionAmount: 1000, sdWebsite: "www.3.com" },
];

const donors: SDProp[] = [
  { sdName: "Donor 1", sdDisplayOrder: 1, sdContributionAmount: 500 },
  { sdName: "Donor 2", sdDisplayOrder: 2, sdContributionAmount: 500 },
  { sdName: "Donor 3", sdDisplayOrder: 3, sdContributionAmount: 500 },
];

const sponsors: SDProp[] = [
  { sdName: "Sponsor 1", sdDisplayOrder: 1, sdContributionAmount: 200 },
  { sdName: "Sponsor 2", sdDisplayOrder: 2, sdContributionAmount: 200 },
  { sdName: "Sponsor 3", sdDisplayOrder: 3, sdContributionAmount: 200 },
];

export default function Partners(){

  return(
    <div className="container w-[80%] mx-auto flex flex-col gap-6">
      <h1 className="text-4xl text-left font-bold mb-10">Partners, Donors, & Sponsors</h1>

      <div className="w-[80%] inline-block rounded border border-gray-300 bg-gray-50 p-2">
        <div className="grid grid-cols-4 border-separate border-spacing-y-1">
          <div className="px-6 py-2 text-sm font-semibold">Order</div>
          <div className="px-6 py-2 text-sm font-semibold">Name</div>
          <div className="px-6 py-2 text-sm font-semibold">Contribution Amount</div>
          <div className="px-6 py-2 text-sm font-semibold">Website</div>
          <PartnerTable rowData={partners}/>
        </div>
      </div>

      <div className="w-[80%] inline-block rounded border border-gray-300 bg-gray-50 p-2">
        <div className="grid grid-cols-3 border-separate border-spacing-y-1">
          <div className="px-6 py-2 text-sm font-semibold">Order</div>
          <div className="px-6 py-2 text-sm font-semibold">Name</div>
          <div className="px-6 py-2 text-sm font-semibold">Contribution Amount</div>
          <SDTable rowData={sponsors}/>
        </div>
      </div>

      <div className="w-[80%] inline-block rounded border border-gray-300 bg-gray-50 p-2">
        <div className="grid-cols-3 grid border-separate border-spacing-y-1">
          <div className="px-6 py-2 text-sm font-semibold">Order</div>
          <div className="px-6 py-2 text-sm font-semibold">Name</div>
          <div className="px-6 py-2 text-sm font-semibold">Contribution Amount</div>
          <SDTable rowData={donors}/>
        </div>
      </div>
    </div>
  )
}

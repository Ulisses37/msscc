'use client';

import { useState, useEffect } from 'react';

import { PartnerProp, PartnerTable } from "./partnersComponents"


export default function Partners(){
  const [partners, setPartners] = useState<PartnerProp[]>([]);

  // fetch partners from database
useEffect(() => {
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/partners/`)
    .then(res => res.json())
    .then((partnerRecords: {
        partner_id: number;
        display_name_en: string;
        category_en: string;
        website_url: string | null;
        display_order: number;
        media_assest: number | null;
        contribution_amount: number;
    }[]) => {
      const mappedPartners: PartnerProp[] = partnerRecords
        .sort((a, b) => a.display_order - b.display_order)
        .map(partner => ({
          PartnerID: partner.partner_id,
          Name: partner.display_name_en,
          Category: partner.category_en,
          Website: partner.website_url ?? null,
          MediaAssest: partner.media_assest ?? null,
          ContributionAmount: partner.contribution_amount ?? 0,
          DisplayOrder: partner.display_order
        }));

      setPartners(mappedPartners);
    })
    .catch(error => console.error('Error fetching partners:', error));
}, []);
console.log(partners);
  return(
    <div className="container w-[80%] mx-auto flex flex-col gap-4">
      <h1 className="text-4xl text-left font-bold mb-2">Partners, Donors, & Sponsors</h1>

      <div className="w-[80%] inline-block rounded border border-gray-300 bg-gray-50 p-2">
        <div className="grid grid-cols-8">
          <div className="px-3 py-2 text-sm font-semibold col-span-1">Order</div>
          <div className="px-3 py-2 text-sm font-semibold col-span-3">Name</div>
          <div className="px-3 py-2 text-sm font-semibold col-span-2">Contribution Amount</div>
          <div className="px-3 py-2 text-sm font-semibold col-span-1">Website</div>
        </div>
        <PartnerTable rowData={partners.filter(p => p.Category === "partner")}/>
      </div>

      <div className="w-[80%] inline-block rounded border border-gray-300 bg-gray-50 p-2">
        <div className="grid grid-cols-8">
          <div className="px-3 py-2 text-sm col-span-1 font-semibold">Order</div>
          <div className="px-3 py-2 text-sm col-span-3 font-semibold">Name</div>
          <div className="px-3 py-2 text-sm col-span-2 font-semibold">Contribution Amount</div>
        </div>
        <PartnerTable rowData={partners.filter(p => p.Category === "sponsor")}/>
      </div>

      <div className="w-[80%] inline-block rounded border border-gray-300 bg-gray-50 p-2">
        <div className="grid-cols-8 grid">
          <div className="px-3 py-2 text-sm col-span-1 font-semibold">Order</div>
          <div className="px-3 py-2 text-sm col-span-3 font-semibold">Name</div>
          <div className="px-3 py-2 text-sm col-span-2 font-semibold">Contribution Amount</div>
        </div>
        <PartnerTable rowData={partners.filter(p => p.Category === "donor")}/>
      </div>
    </div>
  )
}

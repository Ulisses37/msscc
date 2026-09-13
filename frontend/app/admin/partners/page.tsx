'use client';

import { useState, useEffect } from 'react';

import { PartnerProp, PartnerTable, CreatePartnerProp } from "./partnersComponents"


export default function Partners(){
  const [partners, setPartners] = useState<PartnerProp[]>([]);
  const [popUp, setPopUp] = useState<"partner" | "donor" | "sponsor" | null>(null);

  // fetch partners from database
useEffect(() => {
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/partners/`)
    .then(res => res.json())
    .then((partnerRecords: {
        partner_id: number;
        display_name_en: string;
        display_name_jp: string;
        category_en: string;
        category_jp: string;
        website_url: string | null;
        display_order: number;
        media_assest: number | null;
        contribution_amount: number;
        isVisible: boolean;
    }[]) => {
      const mappedPartners: PartnerProp[] = partnerRecords
        .sort((a, b) => a.display_order - b.display_order)
        .map(partner => ({
          PartnerID: partner.partner_id,
          Name: partner.display_name_en,
          NameJP:partner.display_name_jp,
          Category: partner.category_en,
          CategoryJP: partner.category_jp,
          Website: partner.website_url ?? null,
          MediaAssest: partner.media_assest ?? null,
          ContributionAmount: partner.contribution_amount ?? 0,
          DisplayOrder: partner.display_order,
          isVisible: partner.isVisible
        }));

      setPartners(mappedPartners);
    })
    .catch(error => console.error('Error fetching partners:', error));
}, []);
console.log(partners);
return(
  <div className="w-full max-w-[1600px] mx-auto flex flex-col gap-4 px-4">
    <h1 className="text-4xl text-center font-bold mb-2">Partners</h1>

    <div className="w-full rounded border border-gray-300 bg-gray-100 p-2">
      <div className="flex justify-between items-center">
        <div className="text-3xl text-left font-bold ml-2">Partners</div>
        <div
          onClick={() => {setPopUp("partner")}}
          className="w-8 h-8 mx-4 bg-green-500 text-white font-bold rounded hover:bg-green-600 flex items-center justify-center cursor-pointer"
        >
          +
        </div>
      </div>
      <div className="grid grid-cols-[60px_300px_200px_1fr]">
        <div className="px-2 py-2 text-sm font-semibold">Order</div>
        <div className="px-3 py-2 text-sm font-semibold pl-4">Name</div>
        <div className="px-3 py-2 text-sm font-semibold">Contribution Amount</div>
        <div className="px-3 py-2 text-sm font-semibold pl-8">Website</div>
      </div>
      <PartnerTable rowData={partners.filter(p => p.Category === "partner")}/>
      {popUp === "partner" && <CreatePartnerProp
       PType = "partner"
        onChange = {setPopUp}
        InitialDisplayOrder={getNextDisplayOrder({category: "partner", partnersArray: partners})}
        UsedDisplayOrders= {partners.filter(p => p.Category === "partner").map(p => p.DisplayOrder)}/>}
    </div>

    <div className="w-full rounded border border-gray-300 bg-gray-100 p-2">
      <div className="text-3xl text-left font-bold ml-2">Donors</div>
      <div className="grid grid-cols-[60px_300px_200px]">
        <div className="px-2 py-2 text-sm font-semibold">Order</div>
        <div className="px-3 py-2 text-sm font-semibold pl-4">Name</div>
        <div className="px-3 py-2 text-sm font-semibold">Contribution Amount</div>
      </div>
      <PartnerTable rowData={partners.filter(p => p.Category === "donor")}/>
    </div>

    <div className="w-full rounded border border-gray-300 bg-gray-100 p-2">
      <div className="text-3xl text-left font-bold ml-2">Sponsors</div>
      <div className="grid grid-cols-[60px_300px_200px]">
        <div className="px-2 py-2 text-sm font-semibold">Order</div>
        <div className="px-3 py-2 text-sm font-semibold pl-4">Name</div>
        <div className="px-3 py-2 text-sm font-semibold">Contribution Amount</div>
      </div>
      <PartnerTable rowData={partners.filter(p => p.Category === "sponsor")}/>
    </div>
  </div>
)
}

function getNextDisplayOrder({
  category,
  partnersArray,
  } : {
    category : string,
    partnersArray: PartnerProp[],
  }): number {
    const categoryPartners = partnersArray.filter(p => p.Category === category);
    if (categoryPartners.length === 0) return 1;
    const maxOrder = Math.max(...categoryPartners.map(p => p.DisplayOrder));
    return maxOrder + 1;
}

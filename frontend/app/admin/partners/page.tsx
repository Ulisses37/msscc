'use client';

import { useState, useEffect } from 'react';

import { PartnerProp, PartnerTable, PartnerTableHeader, CreatePartnerProp, EditPartnerProp } from "./partnersComponents"


export default function Partners(){
  const [partners, setPartners] = useState<PartnerProp[]>([]);
  const [popUp, setPopUp] = useState<"partner" | "donor" | "sponsor" | null>(null);
  const [editPopUp, setEditPopUp] = useState<PartnerProp | null>(null);

  // fetch partners from database
useEffect(() => {
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/partners/`)
    .then(res => res.json())
    .then((partnerRecords: {
        partner_id: number;
        display_name_en: string;
        display_name_ja: string;
        category_en: string;
        category_jp: string;
        website_url: string | null;
        display_order: number;
        media_asset: number | null;
        contribution_amount: number;
        is_visible: boolean;
    }[]) => {
      const mappedPartners: PartnerProp[] = partnerRecords
        .sort((a, b) => a.display_order - b.display_order)
        .map(partner => ({
          PartnerID: partner.partner_id,
          Name: partner.display_name_en,
          NameJP:partner.display_name_ja,
          Category: partner.category_en,
          CategoryJP: partner.category_jp,
          Website: partner.website_url ?? null,
          MediaAsset: partner.media_asset ?? null,
          ContributionAmount: partner.contribution_amount ?? 0,
          DisplayOrder: partner.display_order,
          isVisible: partner.is_visible
        }));

        setPartners(mappedPartners);
      })
      .catch(error => console.error('Error fetching partners:', error));
  }, []);

  return(
    <div className="min-h-dvh bg-msscc-white px-2 py-4 font-body text-msscc-gray-dark sm:p-6 md:p-10">
      <header className="mb-6 border-b border-msscc-gray-light pb-4 md:mb-8">
        <h1 className="font-heading text-2xl text-msscc-teal sm:text-display">Partners, Donors, & Sponsors</h1>
      </header>

      {/* Partners */}
      <div className="w-full rounded border border-gray-300 bg-msscc-gray-faint p-2 my-2">
        <div className="flex justify-between items-center">
          <div className="text-2xl sm:text-3xl text-left font-bold ml-2 text-msscc-gray">Partners</div>
          <AddButton label="Add partner" onClick={() => setPopUp("partner")} />
        </div>
      </div>
      <div className="grid grid-cols-[60px_300px_200px_1fr]">
        <div className="px-2 py-2 text-sm font-semibold">Order</div>
        <div className="px-3 py-2 text-sm font-semibold pl-4">Name</div>
        <div className="px-3 py-2 text-sm font-semibold">Contribution Amount</div>
        <div className="px-3 py-2 text-sm font-semibold pl-8">Website</div>
      </div>
      <PartnerTable
       rowData={partners.filter(p => p.Category === "partner")}
      setEditPop={setEditPopUp}
      />
      {popUp !== null && <CreatePartnerProp
       PType = {popUp}
        onChange = {setPopUp}
        InitialDisplayOrder={getNextDisplayOrder({category: popUp, partnersArray: partners})}
        UsedDisplayOrders= {partners.filter(p => p.Category === popUp).map(p => p.DisplayOrder)}/>}

      {editPopUp !== null && <EditPartnerProp
      partner = {editPopUp}
      onChange={setEditPopUp}
      UsedDisplayOrders={partners.filter(p => p.Category === editPopUp.Category).map(p => p.DisplayOrder)}
      />}
    </div>

      {/* Donors */}
      <div className="w-full rounded border border-gray-300 bg-msscc-gray-faint p-2 my-2">
        <div className="flex justify-between items-center">
          <div className="text-2xl sm:text-3xl text-left font-bold ml-2 text-msscc-gray">Donors</div>
          <AddButton label="Add donor" onClick={() => setPopUp("donor")} />
        </div>
      </div>

      <div className="grid grid-cols-[60px_300px_200px]">
        <div className="px-2 py-2 text-sm font-semibold">Order</div>
        <div className="px-3 py-2 text-sm font-semibold pl-4">Name</div>
        <div className="px-3 py-2 text-sm font-semibold">Contribution Amount</div>
      </div>
      <PartnerTable
       rowData={partners.filter(p => p.Category === "donor")}
        setEditPop={setEditPopUp}
      />
    </div>

      {/* Sponsors */}
      <div className="w-full rounded border border-gray-300 bg-msscc-gray-faint p-2 my-2">
        <div className="flex justify-between items-center">
          <div className="text-2xl sm:text-3xl text-left font-bold ml-2 text-msscc-gray">Sponsors</div>
          <AddButton label="Add sponsor" onClick={() => setPopUp("sponsor")} />
        </div>
      </div>
      <div className="grid grid-cols-[60px_300px_200px]">
        <div className="px-2 py-2 text-sm font-semibold">Order</div>
        <div className="px-3 py-2 text-sm font-semibold pl-4">Name</div>
        <div className="px-3 py-2 text-sm font-semibold">Contribution Amount</div>
      </div>
      <PartnerTable
       rowData={partners.filter(p => p.Category === "sponsor")}
        setEditPop={setEditPopUp}
      />
    </div>
  </div>
)
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-10 h-10 sm:w-8 sm:h-8 mx-2 sm:mx-4 bg-green-400 text-white font-bold rounded hover:bg-green-600 flex items-center justify-center"
    >
      +
    </button>
  );
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

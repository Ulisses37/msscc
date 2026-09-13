'use client'

import { useState, useEffect } from 'react'
export interface PartnerProp{
  // Sponsor and Donor Prop
  DisplayOrder: number;
  PartnerID: number;
  Name: string;
  NameJP: string;
  Category: string;
  CategoryJP: string;
  MediaAssest: number | null;
  ContributionAmount: number;
  Website: string | null;
  isVisible: boolean;
}


interface PartnerTableProps{
  rowData: PartnerProp[];
}


export function PartnerTable({ rowData = [] } : PartnerTableProps ){
  return (
    <div>
      {rowData
      .slice()
      .sort((a,b) => a.DisplayOrder - b.DisplayOrder)
      .map((row) =>(
        <DisplayRow
         key={row.PartnerID}
         sdName = {row.Name}
         sdDisplayOrder = {row.DisplayOrder}
         sdContributionAmount = {row.ContributionAmount}
         sdWebsite = {row.Website}
        />
      ))}
    </div>
  )
}


function DisplayRow({
  sdName,
  sdDisplayOrder,
  sdContributionAmount,
  sdWebsite,
} : {
  sdName: string,
  sdDisplayOrder : number,
  sdContributionAmount : number ,
  sdWebsite : string | null,
}){
  return (
      <div className={`${sdWebsite != null ? "grid grid-cols-[60px_300px_200px_1fr]" : "grid grid-cols-[60px_300px_200px]"} border-b border-gray-200 last:border-b-0 bg-white`}>
      <div className="px-3 py-2 text-sm font-semibold text-center">{sdDisplayOrder}</div>
      <div className="px-3 py-2 text-sm font-semibold pl-4">{sdName}</div>
      <div className="px-3 py-2 text-sm font-semibold text-right">${sdContributionAmount}</div>
      {sdWebsite && (
        <div className="px-3 py-2 text-sm font-semibold pl-8">{sdWebsite ?? ""}</div>
      )}
    </div>
  );
}

export function CreatePartnerProp(
  {
    PType,
    onChange,
    InitialDisplayOrder,
    UsedDisplayOrders,
  } :
  {
    PType:  string;
    onChange: (value:null) => void;
    InitialDisplayOrder: number;
    UsedDisplayOrders: number[];
  } ){
  const [partnerInfo, setInfo] = useState<PartnerProp>({
  PartnerID: 0,
  Name: "",
  NameJP: "",
  Category: PType,
  CategoryJP: "",
  Website: null,
  ContributionAmount: 0,
  DisplayOrder: InitialDisplayOrder,
  isVisible: true,
  MediaAssest: 0,
  });
  const [orderError, setOrderError] = useState<string | null>(null);

  const CategoryTitle = PType.charAt(0).toUpperCase() + PType.slice(1)

  function handleOrderChange(value: number) {
    setInfo(prev => ({ ...prev, DisplayOrder: value }));
    if (UsedDisplayOrders.includes(value)) {
      setOrderError(`A ${CategoryTitle} already has that display order position.`);
    } else {
      setOrderError(null);
    }
  }

  useEffect(() =>{
    function handleKeyDown(e: KeyboardEvent){
      if (e.key === "Escape"){
        onChange(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
  }, [onChange])
  return(
    <div
    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    onClick={() => onChange(null)}
    >
      <div
      className="bg-white rounded p-6 w-96"
      onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">
          Create {CategoryTitle}
        </h2>

        {/* Editable fields */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-semibold">Name (English)
            <input
              type="text"
              value={partnerInfo?.Name ?? ""}
              onChange={(e) => setInfo(prev => prev ? { ...prev, Name: e.target.value } : prev)}
              className="w-full border rounded px-2 py-1 mt-1 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">Name (Japanese)
            <input
              type="text"
              value={partnerInfo?.NameJP ?? ""}
              onChange={(e) => setInfo(prev => prev ? { ...prev, NameJP: e.target.value } : prev)}
              className="w-full border rounded px-2 py-1 mt-1 font-normal"
            />
          </label>
          {PType === "partner" && <label className="text-sm font-semibold">Website
            <input
              type="text"
              value={partnerInfo?.Website ?? ""}
              onChange={(e) => setInfo(prev => prev ? { ...prev, Website: e.target.value } : prev)}
              className="w-full border rounded px-2 py-1 mt-1 font-normal"
            />
          </label>}
          <label className="text-sm font-semibold">Display Order
            <input
              type="number"
              value={partnerInfo?.DisplayOrder ?? 0}
              onChange={(e) => handleOrderChange(Number(e.target.value))}
              className="w-full border rounded px-2 py-1 mt-1 font-normal"
            />
            {orderError && <p className="text-red-500 text-xs mt-1">{orderError}</p>}
          </label>
          <label className="text-sm font-semibold">Contribution Amount
            <input
              type="number"
              value={partnerInfo?.ContributionAmount ?? 0}
              onChange={(e) => setInfo(prev => ({ ...prev, ContributionAmount: Number(e.target.value)}))}
              className="w-full border rounded px-2 py-1 mt-1 font-normal"
            />
          </label>
          <label className="text-sm font-semibold flex items-center gap-2">
            <input
              type="checkbox"
              checked={partnerInfo.isVisible}
              onChange={(e) => setInfo(prev => ({ ...prev, isVisible: e.target.checked }))}
              className="w-4 h-4"
              />
              Visible
            </label>
        </div>
        <div className="flex">
        <button
          onClick={async() => await updatePartnerTable({partner: partnerInfo, submissionType: "create"})}
          disabled={!!(orderError != null || (partnerInfo.Name == "" && partnerInfo.NameJP == ""))}
          className="mx-12 mt-4 w-full bg-blue-500 text-white font-semibold px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300"
        >
          Save
        </button>
        <button
          onClick={() => onChange(null)}
          className="mx-12 mt-4 w-full bg-red-500 text-white font-semibold px-4 py-2 rounded hover:bg-red-400"
        >
          Cancel
        </button>
        </div>

      </div>
    </div>
  );
}

async function updatePartnerTable(
  {
    partner,
    submissionType,
  }: {
    partner : PartnerProp,
    submissionType : string,
  }){
    if (submissionType === "create"){
      fetch(
        `http://localhost:8000/api/partners/create/`,
        {
          method: "POST",
          headers: { "Content-Type" : "application/json" },
          body: JSON.stringify({
            display_name_en: partner.Name,
            category_en: partner.Category,
            website_url: partner.Website,
            contribution_amount: partner.ContributionAmount,
            is_visible: partner.isVisible,
            display_order: partner.DisplayOrder,
            media_assest: partner.MediaAssest,
            category_ja: partner.CategoryJP,
            display_name_ja: partner.NameJP,
          }),
        }
      ).then(res => {
        if (!res.ok) return res.json().then(err => { alert(`Failed to save: ${JSON.stringify(err)}`); });
        window.location.reload();
      })
      .catch(err => {
        alert("Network error, please try again.");
        console.error(err);
      });
    }
}



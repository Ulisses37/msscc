'use client'

export interface PartnerProp{
  // Sponsor and Donor Prop
  DisplayOrder: number;
  PartnerID: number;
  Name: string;
  Category: string;
  MediaAssest: number | null;
  ContributionAmount: number;
  Website: string | null;
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
        <div className={`${sdWebsite != null ? "grid grid-cols-[100px_300px_180px_1fr]" : "grid grid-cols-[100px_300px_180px]"} border-b border-gray-200 last:border-b-0 bg-white`}>
      <div className="px-3 py-2 text-sm font-semibold">{sdDisplayOrder}</div>
      <div className="px-3 py-2 text-sm font-semibold">{sdName}</div>
      <div className="px-3 py-2 text-sm font-semibold">{sdContributionAmount}</div>
      {sdWebsite && (
        <div className="px-3 py-2 text-sm font-semibold">{sdWebsite ?? ""}</div>
      )}
    </div>
  );
}




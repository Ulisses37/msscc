'use client'

export interface SDProp{
  // Sponsor and Donor Prop
  sdName: string;
  sdDisplayOrder: number;
  sdContributionAmount: number;
}

export interface PartnerProp extends SDProp{
  // Partner Prop
  sdWebsite: string | null;
}

interface PartnerTableProps{
  rowData: PartnerProp[];
}

interface SDTableProps{
  rowData: SDProp[];
}


export function PartnerTable({ rowData = [] } : PartnerTableProps ){
  return (
    <div>
      {rowData
      .slice()
      .sort((a,b) => a.sdDisplayOrder - b.sdDisplayOrder)
      .map((row) =>(
        <DisplayRow
         key={row.sdName}
         sdName = {row.sdName}
         sdDisplayOrder = {row.sdDisplayOrder}
         sdContributionAmount = {row.sdContributionAmount}
         sdWebsite = {row.sdWebsite}
        />
      ))}
    </div>
  )
}

export function SDTable({ rowData = [] } : SDTableProps ){
  return (
    <div>
      {rowData
      .slice()
      .sort((a,b) => a.sdDisplayOrder - b.sdDisplayOrder)
      .map((row) =>(
        <DisplayRow
         key={row.sdName}
         sdName = {row.sdName}
         sdDisplayOrder = {row.sdDisplayOrder}
         sdContributionAmount = {row.sdContributionAmount}
         sdWebsite = {null}
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
  {console.log(sdName + sdContributionAmount + sdDisplayOrder + sdWebsite)}
  return(
    <div className="w-[100%] border border-gray-300 bg-white">
      <div className="grid grid-cols-8">
          <div className="px-3 py-2 text-sm col-span-1 font-semibold">{sdDisplayOrder}</div>
          <div className="px-3 py-2 text-sm col-span-3 font-semibold">{sdName}</div>
          <div className="px-3 py-2 text-sm col-span-2 font-semibold">{sdContributionAmount}</div>
          <div className="px-3 py-2 text-sm col-span-2 font-semibold">{sdWebsite ?? ""}</div>

        </div>
    </div>
  )
}




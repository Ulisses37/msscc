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
    <div className="flex bg-white hover:bg-gray-50 border rounded-md  border-gray-300">
      <div className="px-6 py-3">{sdDisplayOrder}</div>
      <div className="px-6 py-3">{sdName}</div>
      <div className="px-6 py-3">{sdContributionAmount}</div>
      {sdWebsite !== null && (
        <div className="px-6 py-3 ">{sdWebsite}</div>
      )}
    </div>
  )
}




'use client';

import { useState, useEffect } from 'react';

import { PartnerProp, PartnerTable, PartnerTableHeader, CreatePartnerProp, EditPartnerProp } from "./partnersComponents"

const SECTIONS = [
  { category: "partner", title: "Partners", addLabel: "Add partner", emptyLabel: "No partners found." },
  { category: "donor", title: "Donors", addLabel: "Add donor", emptyLabel: "No donors found." },
  { category: "sponsor", title: "Sponsors", addLabel: "Add sponsor", emptyLabel: "No sponsors found." },
] as const;

// Each table shows at most this many rows at a time.
const PAGE_SIZE = 20;

export default function Partners(){
  const [partners, setPartners] = useState<PartnerProp[]>([]);
  const [popUp, setPopUp] = useState<"partner" | "donor" | "sponsor" | null>(null);
  const [editPopUp, setEditPopUp] = useState<PartnerProp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // fetch partners from database
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/partners/`)
      .then(res => {
        if (!res.ok) throw new Error(`Unable to load partners (${res.status}).`);
        return res.json();
      })
      .then((partnerRecords: {
          partner_id: number;
          display_name_en: string;
          display_name_ja: string;
          category_en: string;
          category_jp: string;
          website_url: string | null;
          display_order: number;
          media_asset: number | null;
          media_is_visible: boolean;
          contribution_amount: number;
          is_visible: boolean;
      }[]) => {
        const mappedPartners: PartnerProp[] = partnerRecords
          .sort((a, b) => a.display_order - b.display_order)
          .map(partner => ({
            PartnerID: partner.partner_id,
            Name: partner.display_name_en,
            NameJP: partner.display_name_ja,
            Category: partner.category_en,
            CategoryJP: partner.category_jp,
            Website: partner.website_url ?? null,
            MediaAsset: partner.media_asset ?? null,
            MediaVisible: partner.media_is_visible ?? true,
            ContributionAmount: partner.contribution_amount ?? 0,
            DisplayOrder: partner.display_order,
            isVisible: partner.is_visible
          }));

        setPartners(mappedPartners);
      })
      .catch(err => {
        console.error('Error fetching partners:', err);
        setError(err instanceof Error ? err.message : 'Unable to load partners.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  return(
    <div className="min-h-dvh bg-msscc-white p-0 font-body text-msscc-gray-dark sm:p-6 md:p-10">
      <header className="mb-6 border-b border-msscc-gray-light pb-4 md:mb-8">
        <h1 className="font-heading text-[1.75rem] text-msscc-teal sm:text-display">Partners, Donors, & Sponsors</h1>
      </header>

      <main className="w-full">
        {error && <div role="alert" className="mb-4 border border-msscc-danger bg-red-50 p-4 text-msscc-danger">{error}</div>}
        {isLoading && !error && <div className="mb-4 border border-msscc-gray-light py-12 text-center text-body-sm text-msscc-gray-mid">Loading partners...</div>}

        {!isLoading && !error && SECTIONS.map(({ category, title, addLabel, emptyLabel }) => (
          <PartnerSection
            key={category}
            title={title}
            addLabel={addLabel}
            emptyLabel={emptyLabel}
            rows={partners.filter(p => p.Category === category)}
            onAdd={() => setPopUp(category)}
            onEdit={setEditPopUp}
          />
        ))}
      </main>

      {/* Pop-ups */}
      {popUp !== null && (
        <CreatePartnerProp
          PType={popUp}
          onChange={setPopUp}
          InitialDisplayOrder={getNextDisplayOrder({ category: popUp, partnersArray: partners })}
          UsedDisplayOrders={partners.filter(p => p.Category === popUp).map(p => p.DisplayOrder)}
        />
      )}

      {editPopUp !== null && (
        <EditPartnerProp
          partner={editPopUp}
          onChange={setEditPopUp}
          UsedDisplayOrders={partners.filter(p => p.Category === editPopUp.Category).map(p => p.DisplayOrder)}
        />
      )}
    </div>
  )
}

// Each section owns its own page number and page size, so paging one table never affects the others.
function PartnerSection({
  title,
  addLabel,
  emptyLabel,
  rows,
  onAdd,
  onEdit,
}: {
  title: string;
  addLabel: string;
  emptyLabel: string;
  rows: PartnerProp[];
  onAdd: () => void;
  onEdit: (value: PartnerProp) => void;
}) {
  const [currentPage, setCurrentPage] = useState<number>(1);

  const sortedRows = rows.slice().sort((a, b) => a.DisplayOrder - b.DisplayOrder);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));

  // Deleting or moving rows can leave the current page past the end; clamp it back into range.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
    if (currentPage < 1) setCurrentPage(1);
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageRows = sortedRows.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl text-msscc-teal sm:text-2xl">{title}</h2>
        <AddButton label={addLabel} onClick={onAdd} />
      </div>

      {sortedRows.length > 0 ? (
        <div className="border border-msscc-gray-light">
          <PartnerTableHeader
            currentPage={currentPage}
            totalPages={totalPages}
            firstEntry={startIndex + 1}
            shownEntries={Math.min(startIndex + PAGE_SIZE, sortedRows.length)}
            totalEntries={sortedRows.length}
            onPrevious={() => setCurrentPage(page => Math.max(1, page - 1))}
            onNext={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
          />
          <PartnerTable rowData={pageRows} setEditPop={onEdit} />
        </div>
      ) : (
        <div className="border border-dashed border-msscc-gray-light py-12 text-center text-body-sm text-msscc-gray-mid">
          {emptyLabel}
        </div>
      )}
    </section>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-msscc-pink px-3 py-1 text-body-sm text-msscc-white focus-visible:ring-2 focus-visible:ring-msscc-pink"
    >
      {label}
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

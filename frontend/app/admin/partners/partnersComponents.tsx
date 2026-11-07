'use client'

import { useState, useEffect, useRef } from 'react'
import { ImportImage } from '@/components/ui/ImportImage'
import PostImage from '@/components/ui/PostImage'
import { parseMediaUploadError } from '@/utils/mediaUploadError'

export interface PartnerProp{
  DisplayOrder: number;
  PartnerID: number;
  Name: string;
  NameJP: string;
  Category: string;
  CategoryJP: string;
  MediaAsset: number | null;
  MediaVisible: boolean;
  ContributionAmount: number;
  Website: string | null;
  isVisible: boolean;
}

// Shared styles, matched to the memberships admin page.
// text-base keeps iOS Safari from zooming in when an input is focused.
const labelClass = "block text-label uppercase tracking-label text-msscc-gray-mid";
const inputClass = "mt-1 w-full rounded-md border border-msscc-gray-light bg-msscc-white px-3 py-2.5 text-base font-normal normal-case tracking-normal text-msscc-gray-dark outline-none placeholder:text-msscc-gray-mid focus:border-msscc-pink focus:shadow-focus-admin";
const disabledInputClass = "mt-1 w-full cursor-not-allowed rounded-md border border-msscc-gray-light bg-msscc-gray-faint px-3 py-2.5 text-base font-normal normal-case tracking-normal text-msscc-gray-mid";
const checkboxClass = "h-4 w-4 accent-msscc-pink";
const checkboxLabelClass = "flex items-center gap-2 text-body-sm text-msscc-gray-dark";
const errorTextClass = "mt-1 text-body-sm text-msscc-danger";
const primaryButtonClass = "w-full rounded-md bg-msscc-pink px-4 py-2 text-msscc-white focus-visible:ring-2 focus-visible:ring-msscc-pink disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass = "w-full rounded-md border border-msscc-pink px-4 py-2 text-msscc-pink focus-visible:ring-2 focus-visible:ring-msscc-pink";
const dangerButtonClass = "w-full rounded-md bg-msscc-danger px-4 py-2 text-msscc-white focus-visible:ring-2 focus-visible:ring-msscc-danger";
const modalOverlayClass = "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4";
const modalTitleClass = "mb-4 font-heading text-xl text-msscc-teal sm:text-2xl";

// Columns: Order | Name | Image | Contribution | (Website, md+) | Page (prev/next controls)
// Class names must be written out in full so Tailwind can find them.
export function getGridCols() {
  return 'grid grid-cols-[56px_minmax(0,1fr)_80px_152px] sm:grid-cols-[60px_minmax(0,1fr)_120px_220px_152px] md:grid-cols-[60px_minmax(0,1fr)_120px_220px_minmax(0,1fr)_152px]';
}

export function PartnerTableHeader(
  {
    currentPage,
    totalPages,
    firstEntry,
    shownEntries,
    totalEntries,
    onPrevious,
    onNext,
  } : {
    currentPage: number;
    totalPages: number;
    firstEntry: number;
    shownEntries: number;
    totalEntries: number;
    onPrevious: () => void;
    onNext: () => void;
  }){
  const pageButtonClass = "rounded-md border border-msscc-pink px-2 text-msscc-pink focus-visible:ring-2 focus-visible:ring-msscc-pink disabled:cursor-not-allowed disabled:opacity-50";
  const headerCell = "flex items-center py-3 text-label uppercase tracking-label text-msscc-gray-mid";
  return (
    <div className={`${getGridCols()} border-b border-msscc-gray-light bg-msscc-gray-faint items-center`}>
      <div className={`${headerCell} justify-center px-2 text-center`}>Order</div>
      <div className={`${headerCell} px-3`}>Name</div>
      <div className={`${headerCell} hidden justify-center px-2 text-center sm:flex`}>Image</div>
      <div className={`${headerCell} justify-end px-3 text-right`}>
        <span className="whitespace-nowrap"><span className="hidden sm:inline">Contribution </span>Amount</span>
      </div>
      <div className={`${headerCell} hidden px-3 pl-8 md:flex`}>Website</div>
      <div className="flex items-center justify-end gap-1 px-2 py-2 normal-case tracking-normal">
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className={pageButtonClass}
        >
          ‹
        </button>
        <span className="min-w-[5rem] whitespace-nowrap text-center text-body-sm text-msscc-gray-mid" aria-live="polite">
          {firstEntry}–{shownEntries}/{totalEntries}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className={pageButtonClass}
        >
          ›
        </button>
      </div>
    </div>
  );
}


export function PartnerTable(
  {
    rowData,
    setEditPop,
  } : {
    rowData: PartnerProp[];
    setEditPop: (value: PartnerProp) => void;
  }){
  return (
    <div>
      {rowData
      .slice()
      .sort((a,b) => a.DisplayOrder - b.DisplayOrder)
      .map((row) =>(
        <DisplayRow
         key={row.PartnerID}
         partnerInfo={row}
         setEditPopUp={setEditPop}
        />
      ))}
    </div>
  )
}


function DisplayRow({
  partnerInfo,
  setEditPopUp,
} : {
  partnerInfo: PartnerProp;
  setEditPopUp: (value: PartnerProp) => void;
}){
  return (
    <div
      className={`${getGridCols()}
       cursor-pointer items-center border-b border-msscc-gray-light bg-msscc-white
       text-body-sm text-msscc-gray-dark last:border-b-0 hover:bg-msscc-pink-faint`}
      onClick={() => setEditPopUp(partnerInfo)}
    >
      <div className="px-2 py-3 text-center">{partnerInfo.DisplayOrder}</div>
      <div className="truncate px-3 py-3 font-semibold">{partnerInfo.Name}</div>
      <div className="hidden items-center justify-center px-3 py-1.5 sm:flex">
        {partnerInfo.MediaAsset !== null ? (
          <div className="relative h-10 w-10 overflow-hidden rounded-md border border-msscc-gray-light bg-msscc-gray-faint">
            <PostImage
              mediaID={partnerInfo.MediaAsset}
              configVariant="thumbnail"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <span className="text-body-sm text-msscc-gray-mid">No image</span>
        )}
      </div>
      <div className="px-3 py-3 text-right">${partnerInfo.ContributionAmount}</div>
      <div className="hidden truncate px-3 py-3 pl-8 md:block">
        {partnerInfo.Website}
      </div>
      {/* Empty cell keeps rows aligned with the header's page-controls column */}
      <div aria-hidden="true" />
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
  MediaAsset: null,
  MediaVisible: true,
  });
  const [orderError, setOrderError] = useState<string>("");
  const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaVisible, setMediaVisible] = useState(true);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [contributionError, setContributionError] = useState<string>("");
  const [currentContribution, setCurrentContribution] = useState<number | string>(partnerInfo.ContributionAmount);

  const CategoryTitle = PType.charAt(0).toUpperCase() + PType.slice(1)

  const handleMediaChange = (file: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (!file) {
      setSelectedMediaFile(null);
      setPreviewUrl(null);
      setMediaError(null);
      return;
    }

    setMediaError(null);
    setSelectedMediaFile(file);

    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
  };

  useEffect(() =>{
    function handleKeyDown(e: KeyboardEvent){
      if (e.key === "Escape"){
        onChange(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onChange])

  useEffect(() => () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
  }, [])

  const handleCreateSubmit = async () => {
    setMediaError(null);
    setIsUploadingMedia(true);

    try {
      await validateAndSubmit({
        partnerInfo,
        mediaFile: selectedMediaFile,
        mediaVisible,
        setWebsiteError,
        type: "create",
      });
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : 'Failed to save partner.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  return(
    <div
    className={modalOverlayClass}
    onClick={() => onChange(null)}
    >
      <div
      className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-md bg-msscc-white p-4 text-msscc-gray-dark shadow-lg sm:p-6"
      onClick={(e) => e.stopPropagation()}
      >
        <h2 className={modalTitleClass}>
          Create {CategoryTitle}
        </h2>

        {/* Editable fields */}
        <div className="flex flex-col gap-4">
          <label className={labelClass}>Name (English)
            <input
              type="text"
              value={partnerInfo?.Name ?? ""}
              onChange={(e) => setInfo(prev => prev ? { ...prev, Name: e.target.value } : prev)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>Name (Japanese)
            <input
              type="text"
              value={partnerInfo?.NameJP ?? ""}
              onChange={(e) => setInfo(prev => prev ? { ...prev, NameJP: e.target.value } : prev)}
              className={inputClass}
            />
          </label>
          <div>
            <label className={labelClass}>Website
              <input
                type="text"
                value={partnerInfo?.Website ?? ""}
                onChange={(e) => setInfo(prev => ({ ...prev, Website: e.target.value || null }))}
                className={inputClass}
              />
            </label>
            {websiteError && <p className={errorTextClass}>{websiteError}</p>}
          </div>
          <div>
            <label className={labelClass}>Display Order
              <input
                type="number"
                value={partnerInfo?.DisplayOrder ?? 0}
                onChange={(e) => handleOrderChange(
                    {
                      value: e.target.value,
                      UsedDisplayOrders :  UsedDisplayOrders,
                      setOrderError: setOrderError,
                      setInfo: setInfo,
                      CategoryTitle: CategoryTitle,
                      currentDisplayOrder: -1,
                    })}
                className={inputClass}
              />
            </label>
            {orderError && <p className={errorTextClass}>{orderError}</p>}
          </div>
          <div>
            <label className={labelClass}>Upload Image</label>
            <ImportImage
              id="create-partner-media"
              onChange={handleMediaChange}
            />
            {isUploadingMedia && <p className="mt-1 text-body-sm text-msscc-gray-mid">Uploading image…</p>}
            {previewUrl && (
              <div className="mt-2 h-40 w-full overflow-hidden rounded-md border border-msscc-gray-light bg-msscc-gray-faint">
                <img
                  src={previewUrl}
                  alt="Selected partner image preview"
                  className="h-full w-full object-contain"
                />
              </div>
            )}
            <label className={`${checkboxLabelClass} mt-2`}>
              <input
                type="checkbox"
                checked={mediaVisible}
                onChange={(e) => setMediaVisible(e.target.checked)}
                className={checkboxClass}
              />
              Image visible on the public site
            </label>
            {mediaError && <p className={errorTextClass}>{mediaError}</p>}
          </div>
          <div>
            <label className={labelClass}>Contribution Amount
              <input
                type="number"
                value={currentContribution}
                onChange={(e) => setCurrentContribution(e.target.value)}
                onBlur={(e) => validateContribution(
                  {
                    contributionAmount: e.target.value,
                    setContributionError: setContributionError,
                    setInfo: setInfo,
                  })}
                className={inputClass}
              />
            </label>
            {contributionError !== "" && <p className={errorTextClass}>{contributionError}</p>}
          </div>
          <label className={checkboxLabelClass}>
            <input
              type="checkbox"
              checked={partnerInfo.isVisible}
              onChange={(e) => setInfo(prev => ({ ...prev, isVisible: e.target.checked }))}
              className={checkboxClass}
            />
            Visible
          </label>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleCreateSubmit}
            disabled={!!(isUploadingMedia || mediaError || orderError != "" || (partnerInfo.Name == "" && partnerInfo.NameJP == "") || contributionError != '')}
            className={primaryButtonClass}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}

export function EditPartnerProp(
  {
    partner,
    onChange,
    UsedDisplayOrders
  } : {
    partner: PartnerProp;
    onChange: (value: null) => void;
    UsedDisplayOrders: number[];
}){
  const [partnerInfo, setInfo] = useState<PartnerProp>(partner);
  const [orderError, setOrderError] = useState<string>("");
  const [, setWebsiteError] = useState<string>("");
  const [contributionError, setContributionError] = useState<string>("");
  const [currentDisplayOrder, setCurrentDisplayOrder] = useState<number | string>(partnerInfo.DisplayOrder);
  const [currentContribution, setCurrentContribution] = useState<number | string>(partnerInfo.ContributionAmount);
  const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaVisible, setMediaVisible] = useState(partnerInfo.MediaVisible);

  const CategoryTitle = partnerInfo.Category.charAt(0).toUpperCase() + partnerInfo.Category.slice(1);


  const categoryOptions = [
    { value: "partner", en: "partner", jp: "パートナー" },
    { value: "sponsor", en: "sponsor", jp: "スポンサー" },
    { value: "donor", en: "donor", jp: "寄付者" },
  ];

  function handleCategoryChange(value: string) {
    const selected = categoryOptions.find(opt => opt.value === value);
    if (!selected) return;
    setInfo(prev => prev ? { ...prev, Category: selected.en, CategoryJP: selected.jp } : prev);
  }

  const handleMediaChange = (file: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setMediaError(null);
    setSelectedMediaFile(file);

    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
  };

  useEffect(() => () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
  }, []);

  const handleUpdateSubmit = async () => {
    setMediaError(null);
    setIsUploadingMedia(true);

    try {
      await validateAndSubmit({
        partnerInfo,
        mediaFile: selectedMediaFile,
        mediaVisible,
        setWebsiteError,
        type: "update",
      });
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : 'Failed to update partner.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  return(
    <div
      className={modalOverlayClass}
      onClick={() => onChange(null)}
    >
      <div
        className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-md bg-msscc-white p-4 text-msscc-gray-dark shadow-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={modalTitleClass}>Update {CategoryTitle}</h2>

        {/* Editable fields */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row"> {/*Partner ID & Display Order*/}
            <label className={`${labelClass} sm:flex-1`}>Partner ID
              <input
                type="number"
                value={partnerInfo?.PartnerID}
                className={disabledInputClass}
                disabled
              />
            </label>
            <div className="sm:flex-1">
              <label className={labelClass}>Display Order
                <input
                  type="number"
                  value={currentDisplayOrder}
                  onChange={(e)=>setCurrentDisplayOrder(e.target.value)}
                  onBlur={(e) => handleOrderChange(
                    {
                      value: e.target.value,
                      UsedDisplayOrders :  UsedDisplayOrders,
                      setOrderError: setOrderError,
                      setInfo: setInfo,
                      CategoryTitle: CategoryTitle,
                      currentDisplayOrder: partnerInfo.DisplayOrder
                    })}
                  className={inputClass}
                />
              </label>
              {orderError !== "" && <p className={errorTextClass}>{orderError}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row"> {/*Name pair*/}
            <label className={`${labelClass} sm:flex-1`}>Name (English)
              <input
                type="text"
                value={partnerInfo?.Name ?? ""}
                onChange={(e) => setInfo(prev => prev ? { ...prev, Name: e.target.value } : prev)}
                className={inputClass}
              />
            </label>
            <label className={`${labelClass} sm:flex-1`}>Name (Japanese)
              <input
                type="text"
                value={partnerInfo?.NameJP ?? ""}
                onChange={(e) => setInfo(prev => prev ? { ...prev, NameJP: e.target.value } : prev)}
                className={inputClass}
              />
            </label>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row"> {/*Category Pair*/}
            <label className={`${labelClass} sm:flex-1`}>
              Category (English)
              <select
                value={categoryOptions.find(opt => opt.en === partnerInfo?.Category)?.value ?? partnerInfo.Category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>Select a category</option>
                {categoryOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.en}</option>
                ))}
              </select>
            </label>
            <label className={`${labelClass} sm:flex-1`}>
              Category (Japanese)
              <input
                type="text"
                value={partnerInfo?.CategoryJP ?? ""}
                readOnly
                disabled
                className={disabledInputClass}
              />
            </label>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row"> {/*Contribution*/}
            <div className="sm:flex-1">
              <label className={labelClass}>Contribution Amount
                <input
                  type="number"
                  value={currentContribution}
                  onChange={(e) => setCurrentContribution(e.target.value)}
                  onBlur={(e) => validateContribution(
                    {
                      contributionAmount: e.target.value,
                      setContributionError: setContributionError,
                      setInfo: setInfo,
                    })}
                  className={inputClass}
                />
              </label>
              {contributionError !== "" && <p className={errorTextClass}>{contributionError}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row"> {/*Media asset: Upload & Existing*/}
            <div className="sm:flex-1">
              <label className={labelClass}>Upload Image</label>
              <ImportImage
                id="edit-partner-media"
                onChange={handleMediaChange}
              />
              {isUploadingMedia && <p className="mt-1 text-body-sm text-msscc-gray-mid">Uploading image…</p>}
              {previewUrl && (
                <div className="mt-2 h-40 w-full overflow-hidden rounded-md border border-msscc-gray-light bg-msscc-gray-faint">
                  <img
                    src={previewUrl}
                    alt="New partner image preview"
                    className="h-full w-full object-contain"
                  />
                </div>
              )}
              {mediaError && <p className={errorTextClass}>{mediaError}</p>}
            </div>
            <div className="sm:flex-1">
              <label className={labelClass}>Existing Media Asset ID
                <input
                  type="number"
                  value={partnerInfo?.MediaAsset ?? ""}
                  onChange={(e) => setInfo(prev => prev ? { ...prev, MediaAsset: e.target.value === "" ? null : Number(e.target.value) } : prev)}
                  className={inputClass}
                />
              </label>
              {!previewUrl && partnerInfo.MediaAsset !== null && (
                <div className="relative mt-2 h-40 overflow-hidden rounded-md border border-msscc-gray-light bg-msscc-gray-faint">
                  <PostImage
                    mediaID={partnerInfo.MediaAsset}
                    configVariant="banner"
                    className="object-contain"
                  />
                </div>
              )}
              <label className={`${checkboxLabelClass} mt-2`}>
                <input
                  type="checkbox"
                  checked={mediaVisible}
                  onChange={(e) => setMediaVisible(e.target.checked)}
                  className={checkboxClass}
                />
                Image visible on the public site
              </label>
            </div>
          </div>

          <div> {/*Website URL & Visible*/}
            <label className={labelClass}>Website URL
              <input
                type="text"
                value={partnerInfo?.Website ?? ""}
                onChange={(e) => setInfo(prev => prev ? { ...prev, Website: e.target.value } : prev)}
                className={inputClass}
              />
            </label>
            <label className={`${checkboxLabelClass} mt-3`}>
              <input
                type="checkbox"
                checked={partnerInfo.isVisible}
                onChange={(e) => setInfo(prev => ({ ...prev, isVisible: e.target.checked }))}
                className={checkboxClass}
              />
              Visible
            </label>
          </div>
        </div>
        {/* On phones: Save on top, Delete at the bottom */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={async() => await validateAndSubmit(
              {
                partnerInfo: partnerInfo,
                setWebsiteError: setWebsiteError,
                type: "delete",
              })}
            className={dangerButtonClass}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpdateSubmit}
            disabled={!!(isUploadingMedia || orderError != "" || (partnerInfo.Name == "" && partnerInfo.NameJP == "") || contributionError != '')}
            className={primaryButtonClass}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}


async function updatePartnerTable(
  {
    partner,
    submissionType,
    mediaFile,
    mediaVisible,
  }: {
    partner : PartnerProp,
    submissionType : string,
    mediaFile?: File | null,
    mediaVisible: boolean,
  }){
    let mediaAsset = partner.MediaAsset;

    if ((submissionType === "create" || submissionType === "update") && mediaFile) {
      mediaAsset = await uploadMediaAsset(mediaFile);
    }

    const endpoint = submissionType === "create"
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/partners/create/`
      : `${process.env.NEXT_PUBLIC_API_URL}/api/partners/${partner.PartnerID}/`;

    const response = await fetch(endpoint, {
      method: submissionType === "create" ? "POST" : "PATCH",
      headers: { "Content-Type" : "application/json" },
      body: JSON.stringify({
        display_name_en: partner.Name,
        category_en: partner.Category,
        website_url: partner.Website,
        contribution_amount: partner.ContributionAmount,
        is_visible: partner.isVisible,
        media_is_visible: mediaVisible,
        display_order: partner.DisplayOrder,
        media_asset: mediaAsset,
        category_ja: partner.CategoryJP,
        display_name_ja: partner.NameJP,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData ? JSON.stringify(errorData) : "Failed to save partner.");
    }

    window.location.reload();
}

async function uploadMediaAsset(file: File): Promise<number> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/media/upload/`,
    {
      method: 'POST',
      body: formData,
    },
  );

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    throw parseMediaUploadError(
      errorBody,
      `Image upload failed: ${response.status}`,
    );
  }

  const data: { media_asset_id: number } = await response.json();
  return data.media_asset_id;
}

function handleOrderChange(
  {
    value,
    UsedDisplayOrders,
    setOrderError,
    setInfo,
    CategoryTitle,
    currentDisplayOrder,
  } : {
    value: string;
    UsedDisplayOrders: number[];
    setOrderError: (value: string) => void;
    setInfo: (value: PartnerProp | ((prev: PartnerProp) => PartnerProp)) => void;
    CategoryTitle: string;
    currentDisplayOrder: number;
  } ){
    const currentValue = Number(value);

    if (currentValue === currentDisplayOrder){
      setOrderError("");
      return;
    }

    if (currentValue < 1) {
      setOrderError("Display order must be 1 or greater.");
      return;
    }

    if (UsedDisplayOrders.includes(currentValue)) {
      setOrderError(`A ${CategoryTitle} already has that display order position.`);
      return;
    } else {
      setOrderError("");
    }
    setInfo(prev => ({ ...prev, DisplayOrder: Number(value) }));
  }

async function validateAndSubmit(
  {
    partnerInfo,
    mediaFile,
    mediaVisible,
    setWebsiteError,
    type,
  } : {
    partnerInfo : PartnerProp;
    mediaFile?: File | null;
    mediaVisible?: boolean;
    setWebsiteError: (value: string) => void;
    type: string;
  }){

  if (type === "delete"){
    const confirmed = window.confirm(
      `Are you sure you want to delete "${partnerInfo.Name}?" This cannot be undone.`
    )

    if (!confirmed) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/partners/${partnerInfo.PartnerID}/delete/`, {
    method: "DELETE",
    })
    .then(res => {
      if (!res.ok) {
        alert("Failed to delete partner.");
        return;
      }
      window.location.reload();
    })
    .catch(err => {
      alert("Network error, please try again.");
      console.error(err);
    });
    return;
  };

  if (partnerInfo.ContributionAmount < 0) return;

  const website = partnerInfo.Website?.trim() ?? "";

  // Website is required for partners, optional for donors/sponsors
  if (partnerInfo.Category === "partner" && website === "") {
    setWebsiteError("Please enter a valid URL");
    return;
  }

  partnerInfo.Website =
    website === "" ? null : /^https?:\/\//i.test(website) ? website : `https://${website}`;

  await updatePartnerTable({
    partner: partnerInfo,
    submissionType: type,
    mediaFile,
    mediaVisible: mediaVisible ?? true,
  });
}

function validateContribution(
  {
    contributionAmount,
    setContributionError,
    setInfo,
  } : {
    contributionAmount: string;
    setContributionError: (value: string) => void;
    setInfo: (value: PartnerProp | ((prev: PartnerProp) => PartnerProp)) => void;
  }){
    const currentAmount = Number(contributionAmount);
    if (currentAmount < 0){
      setContributionError("Contribution can not be negative.");
      return;
    }else{
      setContributionError("");
    }
    setInfo(prev => ({...prev, ContributionAmount: Number(contributionAmount)}));
}

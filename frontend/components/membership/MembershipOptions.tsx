'use client';

import { useState, type FocusEvent } from 'react';
import { useTranslations } from 'next-intl';

import {
  formatMembershipPrice,
  MEMBERSHIP_OPTIONS,
  type MembershipOptionId,
} from '@/constants/membershipOptions';

interface MembershipOptionsProps {
  locale: string;
  selectedOptionId: MembershipOptionId | null;
  onOptionChange: (optionId: MembershipOptionId) => void;
}

export function MembershipOptions({
  locale,
  selectedOptionId,
  onOptionChange,
}: MembershipOptionsProps) {
  const t = useTranslations('MembershipPage');
  const [selectionTouched, setSelectionTouched] = useState(false);
  const showSelectionError = selectionTouched && selectedOptionId === null;

  const handleGroupBlur = (event: FocusEvent<HTMLFieldSetElement>) => {
    // Radio inputs blur while keyboard focus moves within the same group. Only
    // mark the group touched after focus leaves the entire fieldset.
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setSelectionTouched(true);
    }
  };

  return (
    <fieldset
      aria-describedby={`membership-options-description${
        showSelectionError ? ' membership-option-error' : ''
      }`}
      aria-invalid={showSelectionError}
      onBlur={handleGroupBlur}
      className="min-w-0"
    >
      <legend className="text-xl font-semibold text-slate-800">
        {t('optionsHeading')}
      </legend>

      <p
        id="membership-options-description"
        className="mt-1 text-sm text-slate-600"
      >
        {t('optionsDescription')}
      </p>

      <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2">
        {MEMBERSHIP_OPTIONS.map((option) => {
          const isSelected = selectedOptionId === option.id;

          return (
            <label
              key={option.id}
              className={`
                flex min-w-0 max-w-full cursor-pointer items-center
                gap-2 rounded-md border px-3 py-2.5
                transition-colors
                ${
                  isSelected
                    ? 'border-pink-700 bg-pink-50 ring-1 ring-pink-700'
                    : 'border-slate-300 bg-white hover:border-pink-500'
                }
              `}
            >
              <input
                type="radio"
                name="membershipOption"
                value={option.id}
                checked={isSelected}
                onChange={() => onOptionChange(option.id)}
                required
                className="h-4 w-4 shrink-0 accent-pink-700"
              />

              <span className="min-w-0 flex-1 break-words text-sm font-medium leading-tight text-slate-800">
                {t(`options.${option.id}`)}
              </span>

              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">
                {formatMembershipPrice(option, locale)}
              </span>
            </label>
          );
        })}
      </div>

      {showSelectionError && (
        <p
          id="membership-option-error"
          className="mt-2 text-sm text-red-600"
          role="alert"
        >
          {t('membershipRequired')}
        </p>
      )}
    </fieldset>
  );
}
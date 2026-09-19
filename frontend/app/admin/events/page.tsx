'use client';

import { useState } from 'react';

type Language = 'en' | 'ja';

export default function EventsPage() {
  const [activeLang, setActiveLang] = useState<Language>('en');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    titleEn: '',
    titleJa: '',
    descriptionEn: '',
    descriptionJa: '',
    startDatetime: '',
    endDatetime: '',
  });

  return (
    <div className="flex min-h-screen bg-msscc-white font-body text-msscc-gray-dark">

      {/* ── Left Sidebar ────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 border-r border-msscc-gray-light p-6 flex flex-col gap-6">

        {/* Create Event Button */}
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full rounded-sm bg-msscc-pink px-4 py-2 text-white text-btn tracking-btn hover:bg-msscc-pink-dark transition-colors text-left"
        >
          + Create Event
        </button>

        {/* Event List Placeholder */}
        <div className="text-center text-msscc-gray-mid py-20 border border-dashed border-msscc-gray-light rounded-lg font-body text-body-sm">
          No events added yet. Existing events will appear here.
        </div>

      </aside>

      {/* ── Main Form Area ───────────────────────────────────── */}
      <main className="flex-1 p-10 max-w-content mx-auto">

        <h1 className="font-heading text-display text-msscc-teal border-b border-msscc-gray-light pb-4 mb-10">
          Create Event
        </h1>

        {showForm ? (
          <>
            {/* Language Toggle */}
            <div className="flex gap-2 mb-8">
              <button
                type="button"
                onClick={() => setActiveLang('en')}
                className={`px-4 py-1 rounded-sm text-btn tracking-btn transition-colors border ${
                  activeLang === 'en'
                    ? 'bg-msscc-teal text-white border-msscc-teal'
                    : 'bg-white text-msscc-teal border-msscc-teal hover:bg-msscc-teal hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setActiveLang('ja')}
                className={`px-4 py-1 rounded-sm text-btn tracking-btn transition-colors border ${
                  activeLang === 'ja'
                    ? 'bg-msscc-teal text-white border-msscc-teal'
                    : 'bg-white text-msscc-teal border-msscc-teal hover:bg-msscc-teal hover:text-white'
                }`}
              >
                JA
              </button>
            </div>

            <div className="flex flex-col gap-6 max-w-prose">

              {/* Title */}
              <div>
                <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                  Title <span className="text-msscc-danger">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder={activeLang === 'en' ? 'Event title...' : 'イベントタイトル...'}
                  value={activeLang === 'en' ? formData.titleEn : formData.titleJa}
                  onChange={(e) =>
                    setFormData(activeLang === 'en'
                      ? { ...formData, titleEn: e.target.value }
                      : { ...formData, titleJa: e.target.value }
                    )
                  }
                  className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
                />
              </div>

              {/* Start Datetime */}
              <div>
                <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                  Start Date & Time <span className="text-msscc-danger">*</span>
                </label>
                <input
                  required
                  type="datetime-local"
                  value={formData.startDatetime}
                  onChange={(e) => setFormData({ ...formData, startDatetime: e.target.value })}
                  className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
                />
              </div>

              {/* End Datetime */}
              <div>
                <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                  End Date & Time <span className="text-msscc-danger">*</span>
                </label>
                <input
                  required
                  type="datetime-local"
                  value={formData.endDatetime}
                  onChange={(e) => setFormData({ ...formData, endDatetime: e.target.value })}
                  className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-eyebrow tracking-eyebrow uppercase text-msscc-gray-mid block mb-2">
                  Description <span className="text-msscc-danger">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder={activeLang === 'en' ? 'Event description...' : 'イベントの説明...'}
                  value={activeLang === 'en' ? formData.descriptionEn : formData.descriptionJa}
                  onChange={(e) =>
                    setFormData(activeLang === 'en'
                      ? { ...formData, descriptionEn: e.target.value }
                      : { ...formData, descriptionJa: e.target.value }
                    )
                  }
                  className="w-full border border-msscc-gray-light rounded-sm px-4 py-2 font-body text-msscc-gray-dark bg-white focus:border-msscc-teal outline-none resize-none"
                />
              </div>

            </div>
          </>
        ) : (
          <div className="text-center text-msscc-gray-mid py-20 border border-dashed border-msscc-gray-light rounded-lg font-body">
            Select an event or click "+ Create Event" to get started.
          </div>
        )}
      </main>

    </div>
  );
}

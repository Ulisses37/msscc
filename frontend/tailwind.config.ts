import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx,js,jsx}",
    "./app/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./pages/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      // ─── MSSCC Color Palette ───────────────────────────────────────────────
      colors: {
        msscc: {
          // Public UI — Teal family
          teal: {
            DEFAULT: "#264653", // Public nav, headings, primary buttons, footer
            dark:    "#1A3340", // Hover / active on teal elements
            light:   "#3A6070", // Subtle teal surfaces, icon fills
          },
          // Admin UI — Pink / Camellia family (admin-only, never public-facing)
          pink: {
            DEFAULT: "#915988", // Admin nav bg, admin primary actions
            dark:    "#7A4474", // Hover / active on admin elements
            light:   "#C49ABF", // Admin accents, table header borders
            faint:   "#F5EBF4", // Admin table headers, admin bg tints
          },
          // Neutral palette
          white:  "#FFFFFF", // Page bg, card surfaces, inputs
          gray: {
            dark:  "#3D3D3A", // Body text
            mid:   "#6B6B68", // Secondary text, captions, labels
            light: "#D3D1C7", // Borders, dividers, input borders
            faint: "#F1EFE8", // Subtle fills, public table headers
          },
          // Semantic extras
          danger: "#8B2020", // Destructive actions (delete, error borders)
        },
      },

      // ─── Font Families ─────────────────────────────────────────────────────
      fontFamily: {
        // Heading: Libre Baskerville Regular — used for H1–H3, card titles, brand name
        heading: [
          "Libre Baskerville",
          "Georgia",
          "serif",
        ],
        // Body: Almarai — used for all UI text, labels, buttons, captions
        body: [
          "Almarai",
          "sans-serif",
        ],
        // Japanese i18n fallback — Noto Serif JP loaded conditionally
        jp: [
          "Noto Serif JP",
          "serif",
        ],
        // Monospace — code snippets, token values
        mono: [
          "Courier New",
          "Courier",
          "monospace",
        ],
      },

      // ─── Font Sizes ────────────────────────────────────────────────────────
      fontSize: {
        // Style-guide type scale
        "display":    ["2rem",    { lineHeight: "1.2", fontWeight: "600" }], // H1 — 32px
        "heading-2":  ["1.375rem",{ lineHeight: "1.3", fontWeight: "600" }], // H2 — 22px
        "heading-3":  ["1.125rem",{ lineHeight: "1.4", fontWeight: "600" }], // H3 — 18px
        "body":       ["1rem",    { lineHeight: "1.7" }],                    // Body — 16px
        "body-sm":    ["0.875rem",{ lineHeight: "1.6" }],                    // Body small — 14px
        "nav":        ["0.8125rem",{ lineHeight: "1" }],                     // Nav public — 13px
        "nav-admin":  ["0.75rem", { lineHeight: "1" }],                      // Nav admin — 12px
        "btn":        ["0.875rem",{ lineHeight: "1", fontWeight: "600" }],   // Button — 14px
        "caption":    ["0.75rem", { lineHeight: "1.5", fontWeight: "300" }], // Caption — 12px
        "eyebrow":    ["0.625rem",{ lineHeight: "1", fontWeight: "600" }],   // Overline/eyebrow — 10px
        "label":      ["0.6875rem",{ lineHeight: "1" }],                     // Form label — 11px
      },

      // ─── Letter Spacing ────────────────────────────────────────────────────
      letterSpacing: {
        "eyebrow": "0.12em",  // Eyebrow / overline labels
        "btn":     "0.03em",  // Button labels
        "label":   "0.06em",  // Form field labels
        "nav-meta":"0.13em",  // Sidebar nav section labels
        "badge":   "0.04em",  // Badge text
        "tag":     "0.10em",  // Uppercase tags, table headers
        "meta":    "0.14em",  // Tiny meta labels (9–10px)
      },

      // ─── Spacing Scale (style-guide documented values) ─────────────────────
      // Tailwind's default scale already covers most of these;
      // these keys make the guide's semantic labels directly usable.
      spacing: {
        "1":   "0.25rem",  // 4px  — tight inline gaps, icon offsets
        "2":   "0.5rem",   // 8px  — badge padding, small internal gaps
        "3":   "0.75rem",  // 12px — component internal gaps
        "4":   "1rem",     // 16px — card padding, form field gaps (base unit)
        "6":   "1.5rem",   // 24px — section internal padding, grid gutter
        "10":  "2.5rem",   // 40px — between sections, hero padding
        "20":  "5rem",     // 80px — full section vertical rhythm
        // Extra values present in the style-guide CSS
        "5":   "1.25rem",  // 20px
        "7":   "1.75rem",  // 28px
        "9":   "2.25rem",  // 36px
        "11":  "2.75rem",  // 44px
        "12":  "3rem",     // 48px
        "14":  "3.5rem",   // 56px
        // Nav/component heights
        "nav-public": "2.875rem", // 46px — public nav height
        "nav-admin":  "2.5rem",   // 40px — admin nav height
        // Max content width
        "content-max": "75rem",   // 1200px
      },

      // ─── Border Radius ─────────────────────────────────────────────────────
      borderRadius: {
        sm: "3px",  // --radius-sm: buttons, small tags
        md: "6px",  // --radius-md: inputs, form fields, panels
        lg: "10px", // --radius-lg: cards, modals
        pill: "100px", // Badges / fully-rounded tags
      },

      // ─── Box Shadow ────────────────────────────────────────────────────────
      // Design is flat — borders only. Only focus rings are defined.
      boxShadow: {
        none: "none",
        "focus-public": "0 0 0 3px rgba(38, 70, 83, 0.1)",    // Keyboard focus — public inputs
        "focus-admin":  "0 0 0 3px rgba(145, 89, 136, 0.15)", // Keyboard focus — admin inputs
      },

      // ─── Max Width ─────────────────────────────────────────────────────────
      maxWidth: {
        content: "75rem",   // 1200px — max content width per imagery spec
        prose:   "56.25rem", // 900px — main content column
      },

      // ─── Line Height ───────────────────────────────────────────────────────
      lineHeight: {
        tight:  "1.2",  // H1 display
        snug:   "1.3",  // H2
        normal: "1.4",  // H3 / minimum for body copy
        relaxed:"1.6",  // Body small, captions, footer links
        loose:  "1.7",  // Body copy (canonical)
      },
    },
  },
  plugins: [],
};

export default config;

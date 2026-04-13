interface PartnerCardProps {
  name: string;
  imageUrl?: string;
  description?: string;
  websiteUrl?: string;
}

export function PartnerCard({ name, imageUrl, description, websiteUrl }: PartnerCardProps) {
  return (
    <div style={{
      background: 'var(--color-white)',
      border: '0.5px solid var(--color-gray-light)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
    }}>

      {/* Image or placeholder — shows nothing extra if no image */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt={name}
          style={{
            width: '100%',
            height: '80px',
            objectFit: 'contain',
          }}
        />
      )}

      {/* Name */}
      <p style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 'var(--fs-body-sm)',
        color: 'var(--color-gray-dark)',
        margin: 0,
      }}>
        {name}
      </p>

      {/* Optional description */}
      {description && (
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-caption)',
          color: 'var(--color-gray-mid)',
          margin: 0,
          lineHeight: 1.5,
        }}>
          {description}
        </p>
      )}

      {/* Optional website link */}
      {websiteUrl && (
        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-caption)',
            color: 'var(--color-teal)',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            marginTop: 'auto',
          }}
        >
          Visit website →
        </a>
      )}

    </div>
  );
}

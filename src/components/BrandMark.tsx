export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path className="brand-stem" d="M18 13v36h29" />
      <rect className="brand-plate brand-plate-inner" x="43" y="39" width="7" height="20" rx="3.5" />
      <rect className="brand-plate brand-plate-outer" x="52" y="42" width="5" height="14" rx="2.5" />
    </svg>
  )
}

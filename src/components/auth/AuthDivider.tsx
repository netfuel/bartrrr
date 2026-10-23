export function AuthDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-5" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-sand" />
      <span className="text-small text-muted" aria-hidden="true">{label}</span>
      <span className="h-px flex-1 bg-sand" />
    </div>
  )
}

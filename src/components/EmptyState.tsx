import type { ReactNode } from 'react'

export default function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return <div className="empty-state">{icon}<strong>{title}</strong><p>{body}</p></div>
}

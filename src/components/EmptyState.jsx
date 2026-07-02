import { Icon } from './ui';

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      {icon && <Icon name={icon} size={40} stroke="var(--text-3)" />}
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-sub">{description}</div>}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}

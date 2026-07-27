import { Search } from 'lucide-react';

export function PageHeader({ title, description, actions }) {
  return (
    <div className="pi-page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="pi-header-actions">{actions}</div>}
    </div>
  );
}

export function Toolbar({ searchPlaceholder = 'Cari', left, right, searchValue, onSearchChange }) {
  return (
    <div className="pi-toolbar">
      <div className="pi-toolbar-left">
        {left}
        <label className="pi-search">
          <Search size={16} />
          <input 
            placeholder={searchPlaceholder} 
            value={searchValue} 
            onChange={onSearchChange} 
          />
        </label>
      </div>
      {right && <div className="pi-toolbar-right">{right}</div>}
    </div>
  );
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button className={`pi-btn pi-btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Select({ children, defaultValue }) {
  return (
    <select className="pi-select" defaultValue={defaultValue}>
      {children}
    </select>
  );
}

export function EmptyState({ title, description }) {
  return (
    <div className="pi-empty-state">
      <div className="pi-empty-mark" />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
  );
}

export function StatusBadge({ active, label }) {
  const text = label || (active ? 'Aktif' : 'Tidak aktif');
  return <span className={`pi-status ${active ? 'is-active' : 'is-muted'}`}>{text}</span>;
}

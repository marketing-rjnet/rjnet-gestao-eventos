import { Icon } from './ui';

export function SearchInput({ value, onChange, placeholder = "Buscar…", onClear }) {
  return (
    <div className="search-input-wrap">
      <Icon name="search" size={15} stroke="var(--text-3)" />
      <input
        type="search"
        className="search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {value && onClear && (
        <button type="button" className="search-input-clear" onClick={onClear} aria-label="Limpar busca">
          <Icon name="x" size={14} stroke="var(--text-3)" />
        </button>
      )}
    </div>
  );
}

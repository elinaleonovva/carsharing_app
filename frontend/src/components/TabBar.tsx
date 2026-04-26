type TabBarProps<T extends string> = {
  items: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
};

export function TabBar<T extends string>({ items, value, onChange }: TabBarProps<T>) {
  return (
    <nav className="tabbar" aria-label="Разделы">
      {items.map((item) => (
        <button
          key={item.value}
          className={item.value === value ? "active" : ""}
          type="button"
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

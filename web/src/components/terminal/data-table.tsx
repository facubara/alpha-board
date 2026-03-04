interface Column<T> {
  key: string;
  header: string;
  render: (row: T, index: number) => React.ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
}

const ALIGN_CLASS = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

export function DataTable<T>({ columns, data, keyExtractor }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-void-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-xs uppercase tracking-widest text-text-tertiary font-sans font-normal pb-2 px-3 ${ALIGN_CLASS[col.align || "left"]}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={keyExtractor(row, i)}
              className="border-b border-void-border last:border-b-0 hover:bg-void-muted transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`font-mono text-sm text-text-primary py-2.5 px-3 ${ALIGN_CLASS[col.align || "left"]}`}
                >
                  {col.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TableProps {
  headers: React.ReactNode[];
  rows: {
    key: string | number;
    cells: React.ReactNode[];
    className?: string;
  }[];
}

export function Table({ headers, rows }: TableProps) {
  return (
    <div className="tbl">
      <table>
        <thead>
          <tr>
            {headers.map((header, idx) => (
              <th key={idx} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.className || ''}>
              {row.cells.map((cell, idx) => (
                <td key={idx}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
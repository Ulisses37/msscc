export type CsvColumn<Row> = {
  header: string;
  getValue: (row: Row) => unknown;
};

function escapeSpreadsheetFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function serializeCsvCell(value: unknown): string {
  const stringValue = value === null || value === undefined ? "" : String(value);
  const safeValue = escapeSpreadsheetFormula(stringValue);

  return `"${safeValue.replaceAll('"', '""')}"`;
}

export function createCsvContent<Row>(rows: Row[], columns: CsvColumn<Row>[]): string {
  const headerRow = columns.map((column) => serializeCsvCell(column.header)).join(",");
  const dataRows = rows.map((row) =>
    columns.map((column) => serializeCsvCell(column.getValue(row))).join(","),
  );

  return `\uFEFF${[headerRow, ...dataRows].join("\r\n")}\r\n`;
}

export function downloadCsv<Row>(filename: string, rows: Row[], columns: CsvColumn<Row>[]): void {
  const blob = new Blob([createCsvContent(rows, columns)], {
    type: "text/csv;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");

  downloadLink.href = objectUrl;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export type CsvColumn<Row> = {
  header: string;
  getValue: (row: Row) => unknown;
};

function escapeSpreadsheetFormula(value: string): string {
  // Prefix formula-leading text so opening a CSV cannot execute record data as a spreadsheet formula.
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

  // A UTF-8 BOM and CRLF rows make names and messages open reliably in desktop spreadsheet apps.
  return `\uFEFF${[headerRow, ...dataRows].join("\r\n")}\r\n`;
}

export function downloadCsv<Row>(filename: string, rows: Row[], columns: CsvColumn<Row>[]): void {
  // Use a temporary object URL to trigger a client-side download without sending data back to the server.
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
  // Release the temporary browser resource after the click has started the download.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

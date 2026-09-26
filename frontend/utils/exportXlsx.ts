import type { Cell, SheetData } from "write-excel-file/browser";

export type XlsxCell = Cell;

export type XlsxColumn<Row> = {
  header: string;
  width: number;
  getCell: (row: Row) => XlsxCell;
};

export function createXlsxSheetData<Row>(rows: Row[], columns: XlsxColumn<Row>[]): SheetData {
  // Build a styled header followed by page-provided typed cells for each exported record.
  const headerRow: XlsxCell[] = columns.map((column) => ({
    value: column.header,
    type: String,
    fontWeight: "bold",
    textColor: "#FFFFFF",
    backgroundColor: "#264653",
    align: "left",
    alignVertical: "center",
    wrap: true,
    height: 24,
  }));
  const dataRows = rows.map((row) => columns.map((column) => column.getCell(row)));

  return [headerRow, ...dataRows];
}

export async function downloadXlsx<Row>(
  filename: string,
  sheetName: string,
  rows: Row[],
  columns: XlsxColumn<Row>[],
): Promise<void> {
  // Load the browser-only writer on demand so normal admin-page visits do not pay its bundle cost.
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const sheetData = createXlsxSheetData(rows, columns);

  await writeExcelFile(sheetData, {
    sheet: sheetName,
    columns: columns.map((column) => ({ width: column.width })),
    // Keep column headings visible while an administrator scrolls through a large worksheet.
    stickyRowsCount: 1,
  }).toFile(filename);
}

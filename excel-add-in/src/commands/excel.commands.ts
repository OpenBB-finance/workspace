/**
 * Recalculates a given range.
 * @param context
 * @param range
 */
export async function reCalculateSheetRange(
  context: Excel.RequestContext,
  range: Excel.Range,
) {
  range.load(["address"]);
  await context.sync();
  console.log(`Recalculating range: ${range.address}`);
  range.calculate();
}

/**
 * Recalculates the current selection.
 * @param event
 */
export async function reCalculateSelection(event: Office.AddinCommands.Event) {
  try {
    await Excel.run(async (context) => {
      const range = context.workbook.getSelectedRange();
      await reCalculateSheetRange(context, range);
    });
  } catch (error) {
    console.error(error);
  }
  event.completed();
}
Office.actions.associate("reCalculateSelection", reCalculateSelection);

/**
 * Recalculates the current worksheet.
 * @param event
 */
export async function reCalculateWorksheet(event: Office.AddinCommands.Event) {
  try {
    await Excel.run(async (context) => {
      const worksheet = context.workbook.worksheets.getActiveWorksheet();
      const range = worksheet.getUsedRange();
      await reCalculateSheetRange(context, range);
    });
  } catch (error) {
    console.error(error);
  }
  event.completed();
}
Office.actions.associate("reCalculateWorksheet", reCalculateWorksheet);

/**
 * Recalculates the current workbook.
 * @param event
 */
export async function reCalculateWorkbook(event: Office.AddinCommands.Event) {
  try {
    await Excel.run(async (context) => {
      const worksheets = context.workbook.worksheets;
      worksheets.load("name");
      await context.sync();

      for (let ws = 0; ws < worksheets.items.length; ws++) {
        const worksheet = worksheets.items[ws];
        const range = worksheet.getUsedRange();
        await reCalculateSheetRange(context, range);
      }
    });
  } catch (error) {
    console.error(error);
  }
  event.completed();
}
Office.actions.associate("reCalculateWorkbook", reCalculateWorkbook);
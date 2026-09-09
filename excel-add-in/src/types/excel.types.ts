export interface FormattedNumber {
  type: "FormattedNumber";
  basicValue: number;
  numberFormat: string;
}
export type RawCell = string | number | boolean | null;
export type Cell = RawCell | FormattedNumber;

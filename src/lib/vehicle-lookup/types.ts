export interface VehicleSpecRow {
  make: string;
  model: string;
  designation: string;
  engine: string;
  year: number;
}

export interface VehiclePartSpecRow extends VehicleSpecRow {
  part_number: string;
  part_column: string;
}

export interface YearRangeSpan {
  from: number;
  to: number;
}

export interface VehicleSpreadsheetData {
  vehicle_specs: VehicleSpecRow[];
  part_specs: VehiclePartSpecRow[];
  known_part_numbers: Set<string>;
}

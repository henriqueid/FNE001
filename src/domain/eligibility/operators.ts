import { type EligibilityOperator, type EligibilityValue } from "./model";

const comparable = (value: EligibilityValue) => (typeof value === "string" ? value.toLocaleLowerCase() : value);

export function compareEligibilityValues(
  observed: EligibilityValue,
  operator: EligibilityOperator,
  parameter: EligibilityValue,
): boolean {
  if (observed == null) return false;
  const left = comparable(observed);
  const right = comparable(parameter);
  switch (operator) {
    case "EQ":
      return left === right;
    case "NE":
      return left !== right;
    case "GT":
      return Number(left) > Number(right);
    case "GTE":
      return Number(left) >= Number(right);
    case "LT":
      return Number(left) < Number(right);
    case "LTE":
      return Number(left) <= Number(right);
    case "IN":
      return Array.isArray(right) && right.some(item => comparable(item) === left);
    case "NOT_IN":
      return Array.isArray(right) && !right.some(item => comparable(item) === left);
  }
}

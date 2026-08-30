/**
 * EveryDollar's own wire format for `GET /app/api/budgets/{uuid}`.
 *
 * This is their shape, not ours — it is described here only so the mapper can
 * translate it. Nothing outside this folder should import these types.
 *
 * Amounts are integer cents throughout, with a sign convention worth stating
 * because it is the source of the app's two original arithmetic bugs:
 *
 *   | field             | income   | expense  |
 *   |-------------------|----------|----------|
 *   | `amountBudgeted`  | positive | positive |
 *   | allocation `amount` | positive | negative |
 *
 * Ids look like `urn:everydollar:budget:{uuid}:item:{n}` and are re-minted every
 * month, so they are never used to match anything across months.
 */
export interface BudgetDetailDto {
  readonly id: string;
  /** First day of the month the budget covers, `YYYY-MM-DD`. */
  readonly date: string;
  readonly bufferAmountCents?: number;
  readonly groups: readonly BudgetGroupDto[];
}

export interface BudgetGroupDto {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  readonly budgetItems: readonly BudgetItemDto[];
}

export interface BudgetItemDto {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  readonly amountBudgeted: number;
  readonly carryOverBalance?: number;
  readonly allocations: readonly AllocationDto[];
}

export interface AllocationDto {
  readonly id: string;
  readonly date: string;
  readonly amount: number;
  readonly label?: string;
  readonly merchant?: string | null;
}

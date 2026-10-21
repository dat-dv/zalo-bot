/** Where a column renders in the phone-width list row. Columns without a slot appear only in the detail sheet. */
export type MobileSlot = 'primary' | 'secondary' | 'trailing';

type MobileColumnShape = {
  id: string;
  mobileSlot?: MobileSlot;
  mobileHeader?: boolean;
};

export type MobileColumnLayout<C> = {
  primary: C | undefined;
  secondary: C[];
  trailing: C | undefined;
  /** Every non-action column, in table order, for the detail sheet body. */
  detail: C[];
  actions: C | undefined;
  /** Columns whose header (e.g. a column filter) is shown in the list's filter strip. */
  headers: C[];
};

export const ACTIONS_COLUMN_ID = 'actions';

/** A table opts into the phone-width list as soon as one column declares a mobile slot. */
export function supportsMobileList(columns: readonly MobileColumnShape[]): boolean {
  return columns.some((column) => column.mobileSlot !== undefined);
}

export function partitionMobileColumns<C extends MobileColumnShape>(
  columns: readonly C[],
): MobileColumnLayout<C> {
  const actions = columns.find((column) => column.id === ACTIONS_COLUMN_ID);
  return {
    primary: columns.find((column) => column.mobileSlot === 'primary'),
    secondary: columns.filter((column) => column.mobileSlot === 'secondary'),
    trailing: columns.find((column) => column.mobileSlot === 'trailing'),
    detail: columns.filter((column) => column.id !== ACTIONS_COLUMN_ID),
    actions,
    headers: columns.filter((column) => column.mobileHeader === true),
  };
}

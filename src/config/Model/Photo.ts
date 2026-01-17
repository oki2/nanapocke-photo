export const TABLE_NAME = process.env.TABLE_NAME_MAIN || "";
export const STATUS = {
  CREATE: "CREATE",
  ACTIVE: "ACTIVE",
  DELETED_LOGICAL: "DELETED_LOGICAL",
  DELETED_PENDING_PURGE: "DELETED_PENDING_PURGE",
  BULK_DELETED: "BULK_DELETED",
  PURGED: "PURGED",
};

export const PRICE_TIER = {
  STANDARD: "STANDARD",
  PREMIUM: "PREMIUM",
};

export const EDITABILITY = {
  EDITABLE: "EDITABLE",
  LOCKED: "LOCKED",
};

export const SALES_STATUS = EDITABILITY;

export const DATE_TYPE = {
  SHOOTING: "SHOOTING",
  UPLOAD: "UPLOAD",
};

export const SORT_KEY = {
  SHOOTING: "SHOOTING",
  UPLOAD: "UPLOAD",
};

export const SORT_ORDER = {
  ASC: "ASC",
  DESC: "DESC",
};

export const SALES_SIZE = {
  PRINT_L: "printl",
  PRINT_2L: "print2l",
  DONWLOAD: "dl",
};

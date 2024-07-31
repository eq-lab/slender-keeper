export interface ReserveData {
    asset: string;
    debt_token: string;
}

interface ReserveConfiguration {
    is_active: boolean;
    borrowing_enabled: boolean;
    liquidity_cap: number;
    pen_order: number;
    util_cap: number;
    discount: number;
}

export interface PoolReserveData {
    reserve_type: string[];
    configuration: ReserveConfiguration;
    lender_ar: number;
    lender_ir: number;
    borrower_ar: number;
    borrower_ir: number;
    last_update_timestamp: number;
    id: number[];
}

export interface PoolAccountPosition {
    npv: bigint;
    debt: bigint;
    discounted_collateral: bigint;
}
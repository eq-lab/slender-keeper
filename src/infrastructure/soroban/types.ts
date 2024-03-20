export interface ReserveData {
    asset: string;
    debt_token: string;
}

export interface PoolReserveData {
    reserve_type: string[]
}

export interface PoolAccountPosition {
    npv: bigint;
    debt: bigint;
    discounted_collateral: bigint;
}
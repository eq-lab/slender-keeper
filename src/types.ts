export interface ReserveData {
    debtToken: string,
    sTokenUnderlyingBalance: bigint,
}

export interface PoolReserveData {
    configuration: Map<string, number | boolean | bigint>,
    lender_ar: bigint,
    lender_ir: bigint,
    borrower_ar: bigint,
    borrower_ir: bigint,
    last_update_timestamp: number,
    s_token_address: string,
    debt_token_address: string,
    id: number[],
}

export interface PoolAccountPosition {
    npv: bigint,
    discounted_collateral_xlm: bigint,
    total_debt_xlm: bigint
}
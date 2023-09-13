export interface ReserveData {
    sToken: string,
    debtToken: string,
    priceFeed: string,
    discount: bigint,
    sTokenSupply?: bigint,
    debtTokenSupply?: bigint,
    sTokenUnderlyingBalance: bigint,
    decimals: number
}

export interface TokenBalance {
    token: string,
    balance: bigint
}

export interface Position {
    collateral: Map<string, TokenBalance>,
    discountedCollateralXlm: bigint,
    totalDebtXlm: bigint,
    debt: Map<string, TokenBalance>,
    npv: bigint
}
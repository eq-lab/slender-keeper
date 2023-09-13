import { Address, Contract, Server, xdr, scValToBigInt, TransactionBuilder, BASE_FEE, Account, TimeoutInfinite, Keypair } from "soroban-client";
import { ReserveData, TokenBalance } from "./types";
import { parseScvToJs } from "./parseScvToJs";
import { FACTOR, KEEPER_PUB, KEEPER_S, PASSPHRASE, PERCENTAGE_FACTOR, POOL_ID, U128_MAX, XLM_NATIVE } from "./consts";

export const getInstanceStorage = async (server: Server, contractId: string) => {
    const ledgerKey = xdr.LedgerKey.contractData(
        new xdr.LedgerKeyContractData({
            contract: new Contract(contractId).address().toScAddress(),
            key: xdr.ScVal.scvLedgerKeyContractInstance(),
            durability: xdr.ContractDataDurability.persistent(),
            bodyType: xdr.ContractEntryBodyType.dataEntry()
        })
    );
    const poolInstanceLedgerEntriesRaw = await server.getLedgerEntries([ledgerKey]);
    const poolInstanceLedgerEntries = xdr.LedgerEntryData.fromXDR(poolInstanceLedgerEntriesRaw.entries[0].xdr, "base64");
    return (poolInstanceLedgerEntries.value() as any).body().value().val().value().storage();
}

export const getTokensFromPool = async (server: Server) => {
    const poolInstanceStorageEntries = await getInstanceStorage(server, POOL_ID);
    const reserves = new Map<string, ReserveData>();
    const reservesReverseMap = {};
    const getDefaultReserve = () => ({ sToken: "", debtToken: "", priceFeed: "", discount: 0n, sTokenUnderlyingBalance: 0n, decimals: 0 });
    for (let i = 0; i < poolInstanceStorageEntries.length; i++) {
        const key = parseScvToJs(poolInstanceStorageEntries[i].key());
        if (key[0] === "PriceFeed") {
            const token = key[1];
            const value = parseScvToJs(poolInstanceStorageEntries[i].val()) as string;
            const reserve = reserves.get(token) || getDefaultReserve();
            reserve.priceFeed = value;
            reserves.set(token, reserve);
        }
        if (key[0] === "ReserveAssetKey") {
            const token = key[1];
            const value = parseScvToJs(poolInstanceStorageEntries[i].val()) as any;
            const { debt_token_address: debtToken, s_token_address: sToken, configuration } = value;
            const reserve = reserves.get(token) || getDefaultReserve();
            reserve.sToken = sToken;
            reserve.debtToken = debtToken;
            reserve.discount = BigInt((configuration.get("discount") / PERCENTAGE_FACTOR) * FACTOR);
            reserve.decimals = configuration.get("decimals");
            reservesReverseMap[sToken] = {lpTokenType: "sToken", token};
            reservesReverseMap[debtToken] = {lpTokenType: "debtToken", token};
            reserves.set(token, reserve);
        }
    }
    // exceeded-limit-fix
    for (let i = 0; i < poolInstanceStorageEntries.length; i++) {
        const key = parseScvToJs(poolInstanceStorageEntries[i].key());
        if (key[0] === "TokenSupply") {
            const lpToken = key[1];
            const value = parseScvToJs(poolInstanceStorageEntries[i].val()) as bigint;
            const { lpTokenType, token } = reservesReverseMap[lpToken];
            const reserve = reserves.get(token);
            if (lpTokenType === "sToken") {
                reserve.sTokenSupply = value; 
            }
            if (lpTokenType === "debtToken") {
                reserve.debtTokenSupply = value;
            }
            reserves.set(token, reserve);
        }
        if (key[0] === "STokenUnderlyingBalance") {
            const sToken = key[1];
            const value = parseScvToJs(poolInstanceStorageEntries[i].val()) as bigint;
            const { token } = reservesReverseMap[sToken];
            const reserve = reserves.get(token);
            reserve.sTokenUnderlyingBalance = value;
            reserves.set(token, reserve);
        }
    }

    for (const [token, reserve] of reserves.entries()) {
        if (reserve.debtTokenSupply === null || reserve.debtTokenSupply === undefined) {
            const debtTokenStorageEntries = await getInstanceStorage(server, reserve.debtToken);
            for(let i = 0; i < debtTokenStorageEntries.length; i++) {
                const key = parseScvToJs(debtTokenStorageEntries[i].key());
                if(key[0] === "TotalSupply") {
                    const value = parseScvToJs(poolInstanceStorageEntries[i].val()) as bigint;
                    const reserve = reserves.get[token];
                    reserve.debtTokenSupply = value;
                    reserves.set(token, reserve);
                }
            }
        }
        if (reserve.sTokenSupply === null || reserve.sTokenSupply === undefined) {
            const sTokenStorageEntries = await getInstanceStorage(server, reserve.sToken);
            for(let i = 0; i < sTokenStorageEntries.length; i++) {
                const key = parseScvToJs(sTokenStorageEntries[i].key());
                if(key[0] === "TotalSupply") {
                    const value = parseScvToJs(poolInstanceStorageEntries[i].val()) as bigint;
                    const reserve = reserves.get[token];
                    reserve.sTokenSupply = value;
                    reserves.set(token, reserve);
                }
            }
        }
        if (reserve.decimals === 0) {
            const key = xdr.ScVal.scvSymbol("METADATA");
            const decimal = await server.getContractData(token, key)
                .then(result => {
                    const entryData = xdr.LedgerEntryData.fromXDR(result.xdr, 'base64');
                    const { decimal } = parseScvToJs(entryData.contractData().body().data().val()) as any;
                    return decimal;
                })
                .catch((r) => {
                    // TODO: work with expired persistent storage
                    if (token === XLM_NATIVE) {
                        return 7;
                    } else {
                        return 9;
                    }
                });
            reserve.decimals = decimal;
            reserves.set(token, reserve);
        }
    }

    return reserves;
}

export const getPrice = async (server: Server, priceFeed: string, token: string) => {
    const priceFeedInstanceStorageEntries = await getInstanceStorage(server, priceFeed);
    for (let i = 0; i < priceFeedInstanceStorageEntries.length; i++) {
        const key = parseScvToJs(priceFeedInstanceStorageEntries[i].key());
        if (key[0] === "Price" && key[1] === token) {
            const value = scValToBigInt(priceFeedInstanceStorageEntries[i].val());
            return value;
        }
    }
}

export function getUserBalance (server: Server, token: string, user: string): Promise<TokenBalance> {
    const key = xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol('Balance'),
        Address.fromString(user).toScVal(),
    ]);
    return server.getContractData(token, key)
        .then(result => {
            const entryData = xdr.LedgerEntryData.fromXDR(result.xdr, 'base64');
            return {token, balance: scValToBigInt(entryData.contractData().body().data().val())};
        })
        .catch((reason) => reason.message.includes("Contract data not found") ? {token, balance: 0n} : Promise.reject(reason)); // need to be bumped
}

export const getNpv = (server: Server, user: string, poolContract: Contract, account: Account) => {
    const operation = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: PASSPHRASE,
    }).addOperation(poolContract.call("account_position", Address.fromString(user).toScVal()))
        .setTimeout(TimeoutInfinite)
        .build();

    return server.prepareTransaction(
        operation,
        PASSPHRASE)
        .then(transaction => server.simulateTransaction(transaction))
        .then(simulateResult => {
            const { npv } = parseScvToJs(simulateResult.result.retval) as any;
            return npv
        });
}

export const getDebtCoeff = (server: Server, token: string, poolContract: Contract, account: Account) => {
    const tokenAddressScVal = new Contract(token).address().toScVal();
    const operation = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: PASSPHRASE,
    }).addOperation(poolContract.call("debt_coeff", tokenAddressScVal))
        .setTimeout(TimeoutInfinite)
        .build();

    return server.prepareTransaction(
        operation,
        PASSPHRASE)
        .then(transaction => server.simulateTransaction(transaction))
        .then(simulateResult => {
            const debtCoeff = parseScvToJs(simulateResult.result.retval) as bigint;
            return debtCoeff;
        });
}

export const tryLiquidate = async (server: Server, poolContract: Contract, who: string) => {
    const account = await server.getAccount(KEEPER_PUB);
    const operation = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: PASSPHRASE,
    }).addOperation(poolContract.call("liquidate", Address.fromString(KEEPER_PUB).toScVal(), Address.fromString(who).toScVal(), xdr.ScVal.scvBool(false)))
        .setTimeout(TimeoutInfinite)
        .build();
    const transaction = await server.prepareTransaction(
        operation,
        process.env.PASSPHRASE);

    transaction.sign(Keypair.fromSecret(KEEPER_S));

    return server.sendTransaction(transaction);
}

export const getUserConfiguration = (server: Server, user: string) => {
    const key = xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol('UserConfig'),
        Address.fromString(user).toScVal(),
    ]);
    return server.getContractData(POOL_ID, key)
        .then(result => {
            const entryData = xdr.LedgerEntryData.fromXDR(result.xdr, 'base64');
            return scValToBigInt(entryData.contractData().body().data().val());
        })
        .catch((reason) => reason.message.includes("Contract data not found") ? U128_MAX : Promise.reject(reason)); // need to be bumped
}
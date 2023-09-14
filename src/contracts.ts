import { Address, Contract, Server, xdr, scValToBigInt, TransactionBuilder, BASE_FEE, TimeoutInfinite, Keypair } from "soroban-client";
import { PoolAccountPosition, PoolReserveData, ReserveData } from "./types";
import { parseScvToJs } from "./parseScvToJs";
import { LIQUIDATOR_ADDRESS, LIQUIDATOR_SECRET, NETWORK_PASSPHRASE, POOL_ID } from "./consts";

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

export const getReserves = async (server: Server) => {
    const poolInstanceStorageEntries = await getInstanceStorage(server, POOL_ID);
    const reserves = new Map<string, ReserveData>();
    const reservesReverseMap = {};
    const getDefaultReserve = () => ({ debtToken: "", sTokenUnderlyingBalance: 0n });
    for (let i = 0; i < poolInstanceStorageEntries.length; i++) {
        const key = parseScvToJs(poolInstanceStorageEntries[i].key());
        if (key[0] === "ReserveAssetKey") {
            const token = key[1];
            const value = parseScvToJs(poolInstanceStorageEntries[i].val()) as PoolReserveData;
            const { debt_token_address: debtToken, s_token_address: sToken } = value;
            const reserve = reserves.get(token) || getDefaultReserve();
            reserve.debtToken = debtToken;
            reservesReverseMap[sToken] = {lpTokenType: "sToken", token};
            reserves.set(token, reserve);
        }
    }
    // exceeded-limit-fix
    for (let i = 0; i < poolInstanceStorageEntries.length; i++) {
        const key = parseScvToJs(poolInstanceStorageEntries[i].key());
        if (key[0] === "STokenUnderlyingBalance") {
            const sToken = key[1];
            const value = parseScvToJs(poolInstanceStorageEntries[i].val()) as bigint;
            const { token } = reservesReverseMap[sToken];
            const reserve = reserves.get(token);
            reserve.sTokenUnderlyingBalance = value;
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

async function simulateTransaction<T> (server: Server, contractAddress: string, call: string, ...args: xdr.ScVal[]): Promise<T> {
    const account = await server.getAccount(LIQUIDATOR_ADDRESS);
    const contract = new Contract(contractAddress);
    const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
    }).addOperation(contract.call(call, ...args))
        .setTimeout(TimeoutInfinite)
        .build();
    
    return server.simulateTransaction(transaction)
        .then(simulateResult => parseScvToJs(simulateResult.result.retval));
}

export const getBalance = async (server: Server, token: string, user: string): Promise<bigint> =>
    simulateTransaction(server, token, "balance", Address.fromString(user).toScVal());

export const getAccountPosition = async (server: Server, user: string): Promise<bigint> =>
    simulateTransaction(server, POOL_ID, "account_position", Address.fromString(user).toScVal());

export const getDebtCoeff = async (server: Server, token: string) => {
    const account = await server.getAccount(LIQUIDATOR_ADDRESS);
    const contract = new Contract(POOL_ID);
    const tokenAddressScVal = new Contract(token).address().toScVal();
    const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
    }).addOperation(contract.call("debt_coeff", tokenAddressScVal))
        .setTimeout(TimeoutInfinite)
        .build();

    return server.simulateTransaction(transaction)
        .then(simulateResult => {
            const debtCoeff = parseScvToJs(simulateResult.result.retval) as bigint;
            return debtCoeff;
        });
}

export const liquidate = async (server: Server, who: string) => {
    const account = await server.getAccount(LIQUIDATOR_ADDRESS);
    const contract = new Contract(POOL_ID);
    const operation = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
    }).addOperation(contract.call("liquidate", Address.fromString(LIQUIDATOR_ADDRESS).toScVal(), Address.fromString(who).toScVal(), xdr.ScVal.scvBool(false)))
        .setTimeout(TimeoutInfinite)
        .build();
    const transaction = await server.prepareTransaction(
        operation,
        process.env.PASSPHRASE);

    transaction.sign(Keypair.fromSecret(LIQUIDATOR_SECRET));

    return server.sendTransaction(transaction);
}

import { Address, BASE_FEE, Contract, Keypair, SorobanRpc, TimeoutInfinite, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import { promisify } from "util";

import { PoolAccountPosition, PoolReserveData, ReserveData } from "./types";
import { LIQUIDATOR_ADDRESS, LIQUIDATOR_SECRET, NETWORK_PASSPHRASE, POOL_ASSETS, POOL_ID } from "../../configuration";
import { convertScvToJs } from "./parseScvToJs";

export async function getReserves(rpc: SorobanRpc.Server): Promise<ReserveData[]> {
    const reserves = POOL_ASSETS
        .split(",")
        .map(asset => getReserve(rpc, asset)
            .then((r) => ({ asset: asset, reserve: r }))
            .catch(() => undefined));

    const reserveData = (await Promise.all(reserves))
        .filter((t) => !!t && t.reserve.reserve_type[0] === "Fungible")
        .map<ReserveData>(r => ({ asset: r.asset, debt_token: r.reserve.reserve_type[2] }));

    return reserveData;
}

export async function getBalance(rpc: SorobanRpc.Server, token: string, user: string): Promise<bigint> {
    return simulateTransaction(rpc, token, "balance", Address.fromString(user).toScVal());
}

export async function getReserve(rpc: SorobanRpc.Server, asset: string): Promise<PoolReserveData> {
    return simulateTransaction(rpc, POOL_ID, "get_reserve", Address.fromString(asset).toScVal());
}

export async function getAccountPosition(rpc: SorobanRpc.Server, user: string): Promise<PoolAccountPosition> {
    return simulateTransaction(rpc, POOL_ID, "account_position", Address.fromString(user).toScVal());
}

export async function getDebtCoeff(rpc: SorobanRpc.Server, token: string): Promise<bigint> {
    return simulateTransaction(rpc, POOL_ID, "debt_coeff", new Contract(token).address().toScVal())
}

export async function liquidate(rpc: SorobanRpc.Server, who: string): Promise<void> {
    return call(rpc, POOL_ID, "liquidate", Address.fromString(LIQUIDATOR_ADDRESS).toScVal(), Address.fromString(who).toScVal());
}

async function simulateTransaction<T>(
    rpc: SorobanRpc.Server,
    contractAddress: string,
    method: string,
    ...args: xdr.ScVal[]
): Promise<T> {
    const caller = await rpc.getAccount(LIQUIDATOR_ADDRESS);
    const contract = new Contract(contractAddress);

    const transaction = new TransactionBuilder(caller, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(contract.call(method, ...(args ?? [])))
        .setTimeout(TimeoutInfinite)
        .build();

    const simulated = await rpc.simulateTransaction(transaction);

    if (SorobanRpc.Api.isSimulationError(simulated)) {
        throw new Error(simulated.error);
    } else if (!simulated.result) {
        throw new Error(`invalid simulation: no result in ${simulated}`);
    }

    return convertScvToJs<T>(simulated.result.retval);
}

async function call(
    rpc: SorobanRpc.Server,
    contractAddress: string,
    method: string,
    ...args: xdr.ScVal[]
): Promise<void> {
    const callerKeys = Keypair.fromSecret(LIQUIDATOR_SECRET);

    const caller = await rpc.getAccount(callerKeys.publicKey());
    const contract = new Contract(contractAddress);

    const operation = new TransactionBuilder(caller, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(contract.call(method, ...(args ?? [])))
        .setTimeout(TimeoutInfinite)
        .build();

    const simulated = (await rpc.simulateTransaction(
        operation,
    )) as SorobanRpc.Api.SimulateTransactionSuccessResponse;

    if (SorobanRpc.Api.isSimulationError(simulated)) {
        throw new Error(simulated.error);
    } else if (!simulated.result) {
        throw new Error(`Invalid simulation: no result in ${simulated}`);
    }

    const transaction = SorobanRpc.assembleTransaction(operation, simulated).build();

    transaction.sign(callerKeys);

    const response = await rpc.sendTransaction(transaction);

    let result: SorobanRpc.Api.GetTransactionResponse;
    let attempts = 15;

    if (response.status == 'ERROR') {
        throw Error(`Failed to send transaction: ${response.errorResult.toXDR('base64')}`);
    }

    do {
        await delay(1000);
        result = await rpc.getTransaction(response.hash);
        attempts--;
    } while (result.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND && attempts > 0);

    if (result.status == SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
        throw Error('Submitted transaction was not found');
    }

    if ('resultXdr' in result) {
        const getResult = result as SorobanRpc.Api.GetTransactionResponse;
        if (getResult.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
            throw new Error('Transaction result is insuccessfull');
        } else {
            return;
        }
    }

    throw Error(`Transaction failed (method: ${method})`);
}

export let delay = promisify((ms, res) => setTimeout(res, ms))

import { populateDbWithBorrowers } from "./sync";
import { getDebtCoeff, getAccountPosition, getReserves, getBalance, liquidate } from "./infrastructure/soroban/contracts";
import { POOL_PRECISION_FACTOR, SOROBAN_URL, LIQUIDATOR_ADDRESS } from "./configuration";
import { SorobanRpc } from "@stellar/stellar-sdk";
import { deleteBorrower, deleteBorrowers, readBorrowers } from "./infrastructure/db/domain";
import { AppDataSource } from "./infrastructure/db/data-source";

async function main() {
    await AppDataSource.initialize()
    const rpc = new SorobanRpc.Server(SOROBAN_URL);

    while (true) {
        await populateDbWithBorrowers(rpc);
        const users = await readBorrowers();
        const reserves = await getReserves(rpc);

        const positionsResults = await Promise.allSettled(users.map(user => getAccountPosition(rpc, user.borrower)));
        const borrowersToLiquidate = [];
        const borrowersToDelete = [];

        for (let i = 0; i < users.length; i++) {
            const positionResult = positionsResults[i];
            const user = users[i];
            if (positionResult.status === 'fulfilled') {
                if (positionResult.value.npv <= 0n && positionResult.value.debt > 0) {
                    borrowersToLiquidate.push(user);
                } else if (positionResult.value.debt === 0n) {
                    borrowersToDelete.push(user);
                }
            }
        }

        await deleteBorrowers(borrowersToDelete);

        const liquidatorBalances = new Map<string, bigint>;
        const borrowersDebt = new Map<string, Map<string, bigint>>;

        for (const { asset, debt_token } of reserves) {
            try {
                const liquidatorBalance = await getBalance(rpc, asset, LIQUIDATOR_ADDRESS);
                liquidatorBalances.set(asset, liquidatorBalance);
            } catch (e) {
                throw Error(`Read liquidator balance error (may be storage expired): ${e}`);
            }

            const debtCoeff = await getDebtCoeff(rpc, asset);

            for (const borrower of borrowersToLiquidate) {
                try {
                    const debtTokenBalance = await getBalance(rpc, debt_token, borrower.borrower);
                    const compoundedDebt = (debtCoeff * debtTokenBalance) / BigInt(POOL_PRECISION_FACTOR);
                    const debts = borrowersDebt.get(asset) || new Map<string, bigint>;
                    debts.set(asset, compoundedDebt);
                    borrowersDebt.set(borrower.borrower, debts);
                } catch (e) {
                    console.warn(`Read borrower balance error: ${e}`);
                    continue;
                }
            }
        }

        const liquidations = [];

        for (const [borrower, debts] of borrowersDebt.entries()) {
            let abortLiquidation = false;
            for (const [token, debt] of debts.entries()) {
                if (liquidatorBalances.get(token) <= debt) {
                    // avoid liquidation for current borrower
                    abortLiquidation = true;
                    break;
                }
            }
            if (abortLiquidation) {
                continue;
            }
            liquidations.push(
                liquidate(rpc, borrower)
                    .then(() => [borrower, undefined])
                    .catch((reason) => [borrower, reason])
            );
            for (const [token, debt] of debts.entries()) {
                const liquidatorBalance = liquidatorBalances.get(token) - debt;
                abortLiquidation = liquidatorBalance <= 0n;
                liquidatorBalances.set(token, liquidatorBalance);
            }
            // avoid liquidation for all further borrowers
            if (abortLiquidation) {
                break;
            }
        }

        const liquidationResults = await Promise.allSettled(liquidations);

        for (const liquidationResult of liquidationResults) {
            if (liquidationResult.status === "fulfilled" && liquidationResult.value[1] == undefined) {
                await deleteBorrower(liquidationResult.value[0]);
            } else {
                console.warn(`Liquidation error: ${liquidationResult}`);
            }
        }
    }
}

main().catch(console.error);

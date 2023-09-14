import {
  Server,
} from "soroban-client";
import { populateDbWithBorrowers } from "./sync";
import { getDebtCoeff, getAccountPosition, getReserves, getBalance, liquidate } from "./contracts";
import { POOL_PRECISION_FACTOR, SOROBAN_URL, LIQUIDATOR_ADDRESS } from "./consts";
import { readBorrowers, deleteBorrower, deleteBorrowers } from "./db";

async function main() {
    const server = new Server(SOROBAN_URL);
    while (true) {
        await populateDbWithBorrowers(server);
        const users = readBorrowers();
        const reserves = await getReserves(server);
    
        const positionsResults = await Promise.allSettled(users.map(user => getAccountPosition(server, user)));
        const borrowersToLiquidate = [];
        const borrowersToDelete = [];

        for (let i = 0; i < users.length; i++) {
            const positionResult = positionsResults[i];
            const user = users[i];
            if (positionResult.status === 'fulfilled') {
                if (positionResult.value.npv <= 0n) {
                    borrowersToLiquidate.push(user);
                } else if (positionResult.value.total_debt_xlm === 0n) {
                    borrowersToDelete.push(user);
                }
            }
        }

        deleteBorrowers(borrowersToDelete);

        const liquidatorBalances = new Map<string, bigint>;
        const borrowersDebt = new Map<string, Map<string, bigint>>;

        for (const [token, { debtToken }] of reserves.entries()) {
            try {
                const liquidatorBalance = await getBalance(server, token, LIQUIDATOR_ADDRESS);
                liquidatorBalances.set(token, liquidatorBalance);
            } catch (e) {
                throw Error(`Read liquidator balance error (may be storage expired): ${e}`);
            }
            const debtCoeff = await getDebtCoeff(server, token);
            for (const borrower of borrowersToLiquidate) {
                try {
                    const debtTokenBalance = await getBalance(server, debtToken, borrower);
                    const compoundedDebt = (debtCoeff * debtTokenBalance) / BigInt(POOL_PRECISION_FACTOR);
                    const debts = borrowersDebt.get(token) || new Map<string, bigint>;
                    debts.set(token, compoundedDebt);
                    borrowersDebt.set(borrower, debts);
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
            abortLiquidation = false;
            liquidations.push(
                liquidate(server, borrower)
                    .then(() => borrower)
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
            if (liquidationResult.status === "fulfilled") {
                deleteBorrower(liquidationResult.value);
            } else {
                console.warn(`Liquidation error: ${liquidationResult.reason}`);
            }
        }
    }
}

main().catch(console.error);

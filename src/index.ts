import {
  Server,
} from "soroban-client";
import { populateDbWithBorrowers } from "./sync";
import { getDebtCoeff, getAccountPosition, getReserves, getBalance, liquidate, getCompoundedDebt } from "./contracts";
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
                if (positionResult.value.npv <= 0n && positionResult.value.debt > 0) {
                    borrowersToLiquidate.push(user);
                } else if (positionResult.value.debt === 0n) {
                    borrowersToDelete.push(user);
                }
            }
        }

        deleteBorrowers(borrowersToDelete);

        for (const [token, { debtToken }] of reserves.entries()) {
            let abortLiquidation = false;
            let liquidatorBalance;
            try {
                liquidatorBalance = await getBalance(server, token, LIQUIDATOR_ADDRESS);
            } catch (e) {
                throw Error(`Read liquidator balance error (may be storage expired): ${e}`);
            }
            const debtCoeff = await getDebtCoeff(server, token);
            for (const borrower of borrowersToLiquidate) {
                let borrowerBalance;
                do {
                    try {
                        borrowerBalance = await getCompoundedDebt(server, borrower, debtToken, debtCoeff);
                    } catch (e) {
                        console.warn(`Read borrower balance error: ${e}\nborrower: ${borrower}\ntoken: ${token}`);
                        break;
                    }

                    if (liquidatorBalance >= borrowerBalance) {
                        try {
                            await liquidate(server, borrower, token);
                            liquidatorBalance -= borrowerBalance;
                        } catch (e) {
                            console.warn(`Liquidation error: ${e}\nborrower: ${borrower}\ntoken: ${token}`);
                            break;
                        }
                    }

                    if (liquidatorBalance <= 0n) {
                        abortLiquidation = true;
                    }
                } while (!abortLiquidation || borrowerBalance !== 0);

                if (abortLiquidation) {
                    break;
                }
            }
        }
    }
}

main().catch(console.error);

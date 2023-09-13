import {
  Server,
  Contract
} from "soroban-client";
import { sync } from "./sync";
import { getDebtCoeff, getNpv, getTokensFromPool, getUserBalance, getUserConfiguration, tryLiquidate } from "./contracts";
import { FACTOR, POOL_ID, SOROBAN_URL, SIMULATE_PUB, KEEPER_PUB, BORROWING_MASK } from "./consts";
import { getUsers, removeUser } from "./db";

async function main() {
    const server = new Server(SOROBAN_URL);
    while (true) {
        await sync(server);
        const users = getUsers();
        const reserves = await getTokensFromPool(server);
    
        const poolContract = new Contract(POOL_ID);
        const account = await server.getAccount(SIMULATE_PUB);
        const npvResults = await Promise.allSettled(users.map(user => getNpv(server, user, poolContract, account)));
        const usersToLiquidate = users.filter((_user, i) => {
            const r = npvResults[i];
            return r.status === 'fulfilled' && r.value <= 0;
        });

        for (const [token, { debtToken }] of reserves.entries()) {
            const debtCoeff = await getDebtCoeff(server, token, poolContract, account);
            for (const user of usersToLiquidate) {
                const [userResult, keeperResult] = await Promise.allSettled([
                    getUserBalance(server, debtToken, user), getUserBalance(server, token, KEEPER_PUB)
                ]);
                if (userResult.status === 'rejected') {
                    console.error(`user balance error: ${userResult.reason}`);
                    continue;
                }
                const { balance: debtTokenBalance } = userResult.value;
                if (keeperResult.status === 'rejected') {
                    console.error(`keeper error: ${keeperResult.reason}`);
                    throw Error("Read keeper balance error (may be storage expired");
                }
                const { balance: keeperBalance } = keeperResult.value;
                const compoundedDebt = (debtCoeff * debtTokenBalance) / BigInt(FACTOR);
                if (keeperBalance >= compoundedDebt) {
                    try {
                        await tryLiquidate(server, poolContract, user);
                    } catch (e) {
                        console.error(`liquidate error: ${e}`);
                    }
                }
            }
        }

        for (const user of users) {
            try {
                const userConfiguration = await getUserConfiguration(server, user);
                if ((userConfiguration & BORROWING_MASK) === 0n) {
                    removeUser(user);
                }

            } catch (e) {
                console.error(`userConfiguration error: ${e}`);
            }
        }
    }
}

main().catch(console.error);

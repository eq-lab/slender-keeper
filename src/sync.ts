import { CONTRACT_CREATION_LEDGER, HORIZON_URL, POOL_ID } from "./configuration";
import { Horizon, NotFoundError, SorobanRpc, humanizeEvents, xdr } from "@stellar/stellar-sdk";
import { insertBorrowers, readLastSyncedLedger, updateLastSyncedLedger } from "./infrastructure/db/domain";
import { delay } from "./infrastructure/soroban/contracts";

export const populateDbWithBorrowers = async (rpc: SorobanRpc.Server) => {
    let lastLedger = (await rpc.getLatestLedger()).sequence;
    const lastSyncedLedger = await readLastSyncedLedger();

    if (lastLedger > lastSyncedLedger) {
        const horizon = new Horizon.Server(HORIZON_URL);
        let retries = parseInt(process.env.GET_TRANSACTIONS_RETRY, 10);
        let currentLedger = lastSyncedLedger === 0 ? parseInt(CONTRACT_CREATION_LEDGER.toString()) : lastSyncedLedger + 1;

        console.log(`Sync from: ${currentLedger} to: ${lastLedger}`);

        while (lastLedger > currentLedger) {
            try {
                const transactions = await horizon.transactions().forLedger(currentLedger).call();
                for (const tx of transactions.records) {
                    const xdrMeta = xdr.TransactionMeta.fromXDR(tx.result_meta_xdr, "base64").v3().sorobanMeta();

                    if (!xdrMeta || !xdrMeta.events())
                        continue;

                    const events = humanizeEvents(xdrMeta.events())
                        .filter(e => e.contractId === POOL_ID && e.topics[0] === 'borrow');
                    const borrower = events.map(e => e.topics[1]);

                    await insertBorrowers(borrower);
                }

                await updateLastSyncedLedger(currentLedger);
            } catch (e) {
                if (e instanceof NotFoundError) {
                    retries -= 1;
                    if (retries === 0) {
                        throw e;
                    }
                    await delay(process.env.GET_TRANSACTIONS_DELAY_MS);
                    continue;
                } else {
                    throw e;
                }
            }

            currentLedger += 1;
            lastLedger = (await rpc.getLatestLedger()).sequence;
        }
    }
}
import { readLastSyncedLedger, updateLastSyncedLedger, insertBorrowers } from "./db";
import { CONTRACT_CREATION_LEDGER, HORIZON_URL, POOL_ID } from "./configuration";
import { Horizon, SorobanRpc, humanizeEvents, xdr } from "@stellar/stellar-sdk";

export const populateDbWithBorrowers = async (rpc: SorobanRpc.Server) => {
    let lastLedger = (await rpc.getLatestLedger()).sequence;
    const lastSyncedLedger = readLastSyncedLedger();

    if (lastLedger > lastSyncedLedger) {
        const horizon = new Horizon.Server(HORIZON_URL);
        let currentLedger = lastSyncedLedger === 0 ? CONTRACT_CREATION_LEDGER : lastSyncedLedger + 1;

        console.log(`Sync from: ${currentLedger} to ${lastLedger}`);

        while (lastLedger > currentLedger) {
            const transactions = await horizon.transactions().forLedger(currentLedger).call();

            for (const tx of transactions.records) {
                const xdrMeta = xdr.TransactionMeta.fromXDR(tx.result_meta_xdr, "base64").v3().sorobanMeta();

                if (!xdrMeta || !xdrMeta.events())
                    continue;

                const events = humanizeEvents(xdrMeta.events())
                    .filter(e => e.contractId === POOL_ID && e.topics[0] === 'borrow');
                const borrower = events.map(e => e.topics[1]);

                insertBorrowers(borrower);
            }

            updateLastSyncedLedger(currentLedger);

            currentLedger += 1;
            lastLedger = (await rpc.getLatestLedger()).sequence;
        }
    }
}
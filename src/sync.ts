import { Server, xdr } from "soroban-client";
import StellarSdk from 'stellar-sdk';
import {humanizeEvents} from 'stellar-base';
import { getLastSyncedLedger, writeLastSyncedLedger, writeUsers } from "./db";
import { CONTRACT_CREATION_LEDGER, HORIZON_URL, POOL_ID } from "./consts";

export const sync = async (server: Server) => {
    let lastLedger = (await server.getLatestLedger()).sequence;
    const lastSyncedLedger = getLastSyncedLedger();
    if (lastLedger > lastSyncedLedger) {
        const horizon = new StellarSdk.Server(HORIZON_URL);
        let currentLedger = lastSyncedLedger === 0 ? CONTRACT_CREATION_LEDGER : lastSyncedLedger + 1;
        console.log(`Sync from: ${currentLedger} to ${lastLedger}`);
        while (lastLedger > currentLedger) {
            const stellarTransactions = (await horizon.transactions().forLedger(currentLedger).call()).records;
            for (const tx of stellarTransactions) {
                let xdrEvents = xdr.TransactionMeta.fromXDR(tx.result_meta_xdr, "base64").v3().sorobanMeta().events();
                const events = humanizeEvents(xdrEvents)
                    .filter(e => e.contractId === POOL_ID && (e.topics[0] === 'borrow' || e.topics[0] === 'repay'));
                writeUsers(events.map(e => e.topics[1]));
            }
            writeLastSyncedLedger(currentLedger);
            currentLedger += 1;
            lastLedger = (await server.getLatestLedger()).sequence;
        }
    }
}
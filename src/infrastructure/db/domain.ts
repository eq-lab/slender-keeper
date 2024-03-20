import { CHAIN, POOL_ID } from "../../configuration"
import { AppDataSource } from "./data-source"
import { SlenderBorrower } from "./entity/SlenderBorrowers"
import { SlenderKeeperState } from "./entity/SlenderKeeperState"

export const readLastSyncedLedger = async () => {
    const slenderKeeperRepository = AppDataSource.getRepository(SlenderKeeperState);
    let currentState = await slenderKeeperRepository.findOneBy({ chain: CHAIN, contractAddress: POOL_ID });
    if (currentState === null || currentState === undefined) {
        currentState = new SlenderKeeperState();
        currentState.lastSynced = 0;
        currentState.chain = CHAIN;
        currentState.contractAddress = POOL_ID;
        await slenderKeeperRepository.save(currentState);
    }
    return currentState.lastSynced;
}

export const updateLastSyncedLedger = async (lastSyncedLedger: number) => {
    const slenderKeeperRepository = AppDataSource.getRepository(SlenderKeeperState);
    const currentState = await slenderKeeperRepository.findOneBy({ chain: CHAIN, contractAddress: POOL_ID });
    currentState.lastSynced = lastSyncedLedger;
    await slenderKeeperRepository.save(currentState);
}

export const readBorrowers = async () => {
    const slenderKeeperRepository = AppDataSource.getRepository(SlenderKeeperState);
    const currentState = await slenderKeeperRepository.findOneBy({ chain: CHAIN, contractAddress: POOL_ID });
    const slenderBorrowerRepository = AppDataSource.getRepository(SlenderBorrower);
    const borrowers = await slenderBorrowerRepository.findBy({ keeperStateId: currentState.id });
    return borrowers;
}

export const insertBorrowers = async (borrowers: string[]) => {
    const slenderKeeperRepository = AppDataSource.getRepository(SlenderKeeperState);
    const currentState = await slenderKeeperRepository.findOneBy({ chain: CHAIN, contractAddress: POOL_ID });
    const slenderBorrowerRepository = AppDataSource.getRepository(SlenderBorrower);
    for (const borrower of borrowers) {
        const b = new SlenderBorrower();
        b.borrower = borrower;
        b.keeperStateId = currentState.id;
        await slenderBorrowerRepository.save(b);
    }
}

export const deleteBorrowers = async (borrowers: string[]) => {
    const slenderKeeperRepository = AppDataSource.getRepository(SlenderKeeperState);
    const currentState = await slenderKeeperRepository.findOneBy({ chain: CHAIN, contractAddress: POOL_ID });
    const slenderBorrowerRepository = AppDataSource.getRepository(SlenderBorrower);
    for (const borrower of borrowers) {
        const b = await slenderBorrowerRepository.findOneBy({ keeperStateId: currentState.id, borrower });
        slenderBorrowerRepository.remove(b);
    }
}